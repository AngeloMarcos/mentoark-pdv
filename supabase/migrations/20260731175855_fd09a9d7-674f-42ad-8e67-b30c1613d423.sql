CREATE OR REPLACE FUNCTION public.checkout_sale_transaction(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant uuid := (p_payload->>'tenant_id')::uuid;
  v_user uuid := auth.uid();
  v_session uuid := NULLIF(p_payload->>'session_id','')::uuid;
  v_customer uuid := NULLIF(p_payload->>'customer_id','')::uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_pay jsonb;
  v_code text;
  v_amount numeric;
  v_is_credit boolean;
  v_settings jsonb;
  v_due_days integer;
  v_category uuid;
  v_customer_name text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Empresa não informada'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  SELECT settings INTO v_settings FROM public.tenants WHERE id = v_tenant;
  v_due_days := COALESCE((v_settings->>'fiado_due_days')::int, 30);

  INSERT INTO public.sales (
    tenant_id, datetime, user_id, customer_id, gross_total, discount_total,
    net_total, payment_method, notes, session_id
  ) VALUES (
    v_tenant, now(), v_user, v_customer,
    COALESCE((p_payload->>'gross_total')::numeric,0),
    COALESCE((p_payload->>'discount_total')::numeric,0),
    COALESCE((p_payload->>'net_total')::numeric,0),
    COALESCE(p_payload->>'payment_method','dinheiro'),
    NULLIF(p_payload->>'notes',''),
    v_session
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items','[]'::jsonb)) LOOP
    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, discount, total)
    VALUES (
      v_sale_id, (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount')::numeric,0), (v_item->>'total')::numeric
    );

    UPDATE public.products
      SET stock_current = COALESCE(stock_current,0) - (v_item->>'quantity')::numeric,
          updated_at = now()
      WHERE id = (v_item->>'product_id')::uuid AND tenant_id = v_tenant;

    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, sale_id, description)
    VALUES (v_tenant, (v_item->>'product_id')::uuid, 'sale', (v_item->>'quantity')::numeric, v_sale_id, 'Venda no PDV');

    PERFORM public.consume_lots_fefo(v_tenant, (v_item->>'product_id')::uuid, (v_item->>'quantity')::numeric);
  END LOOP;

  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'payments','[]'::jsonb)) LOOP
    v_code := v_pay->>'payment_method_code';
    v_amount := (v_pay->>'amount')::numeric - COALESCE((v_pay->>'change_amount')::numeric,0);

    SELECT EXISTS (
      SELECT 1 FROM public.payment_methods pm
      WHERE pm.tenant_id = v_tenant AND pm.code = v_code AND pm.type = 'credit'
    ) OR v_code = 'fiado' INTO v_is_credit;

    INSERT INTO public.sale_payments (
      sale_id, payment_method_id, payment_method_code, amount, change_amount, installments, authorization_code
    ) VALUES (
      v_sale_id, NULLIF(v_pay->>'payment_method_id','')::uuid,
      v_code, (v_pay->>'amount')::numeric,
      COALESCE((v_pay->>'change_amount')::numeric,0),
      COALESCE((v_pay->>'installments')::int,1),
      NULLIF(v_pay->>'authorization_code','')
    );

    IF v_is_credit THEN
      IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Venda no fiado exige um cliente vinculado';
      END IF;

      SELECT name INTO v_customer_name FROM public.customers WHERE id = v_customer AND tenant_id = v_tenant;

      SELECT id INTO v_category FROM public.financial_categories
        WHERE tenant_id = v_tenant AND type = 'receita' AND name = 'Vendas a Prazo' LIMIT 1;

      IF v_category IS NULL THEN
        INSERT INTO public.financial_categories (tenant_id, name, type, color)
        VALUES (v_tenant, 'Vendas a Prazo', 'receita', '#22c55e')
        RETURNING id INTO v_category;
      END IF;

      INSERT INTO public.accounts (
        tenant_id, type, description, amount, due_date, status,
        category_id, party_name, customer_id, notes, created_by
      ) VALUES (
        v_tenant, 'receber',
        'Venda a prazo - ' || COALESCE(v_customer_name, 'Cliente'),
        v_amount, CURRENT_DATE + v_due_days, 'aberta',
        v_category, v_customer_name, v_customer,
        'Gerado automaticamente pela venda no PDV (fiado). Venda: ' || v_sale_id::text,
        v_user
      );
    ELSE
      IF v_session IS NOT NULL THEN
        INSERT INTO public.cash_movements (
          tenant_id, session_id, user_id, movement_type, amount, payment_method, sale_id, description
        ) VALUES (
          v_tenant, v_session, v_user, 'sale', v_amount, v_code, v_sale_id, 'Venda no PDV'
        );
      END IF;

      INSERT INTO public.financial_entries (
        tenant_id, entry_date, type, description, amount, payment_method, sale_id
      ) VALUES (
        v_tenant, CURRENT_DATE, 'income', 'Venda no PDV', v_amount, v_code, v_sale_id
      );
    END IF;
  END LOOP;

  IF v_customer IS NOT NULL THEN
    PERFORM public.credit_loyalty_points(v_tenant, v_customer, v_sale_id,
      COALESCE((p_payload->>'net_total')::numeric,0));
  END IF;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.checkout_sale_transaction(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.checkout_sale_transaction(jsonb) TO authenticated, service_role;