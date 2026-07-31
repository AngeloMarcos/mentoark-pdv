
CREATE OR REPLACE FUNCTION public.checkout_sale_transaction(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid := (p_payload->>'tenant_id')::uuid;
  v_user uuid := auth.uid();
  v_session uuid := NULLIF(p_payload->>'session_id','')::uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_pay jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Empresa não informada'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  INSERT INTO public.sales (
    tenant_id, datetime, user_id, customer_id, gross_total, discount_total,
    net_total, payment_method, notes, session_id
  ) VALUES (
    v_tenant, now(), v_user,
    NULLIF(p_payload->>'customer_id','')::uuid,
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
    INSERT INTO public.sale_payments (
      sale_id, payment_method_id, payment_method_code, amount, change_amount, installments, authorization_code
    ) VALUES (
      v_sale_id, NULLIF(v_pay->>'payment_method_id','')::uuid,
      v_pay->>'payment_method_code', (v_pay->>'amount')::numeric,
      COALESCE((v_pay->>'change_amount')::numeric,0),
      COALESCE((v_pay->>'installments')::int,1),
      NULLIF(v_pay->>'authorization_code','')
    );

    IF v_session IS NOT NULL THEN
      INSERT INTO public.cash_movements (
        tenant_id, session_id, user_id, movement_type, amount, payment_method, sale_id, description
      ) VALUES (
        v_tenant, v_session, v_user, 'sale',
        (v_pay->>'amount')::numeric - COALESCE((v_pay->>'change_amount')::numeric,0),
        v_pay->>'payment_method_code', v_sale_id, 'Venda no PDV'
      );
    END IF;

    INSERT INTO public.financial_entries (
      tenant_id, entry_date, type, description, amount, payment_method, sale_id
    ) VALUES (
      v_tenant, CURRENT_DATE, 'income', 'Venda no PDV',
      (v_pay->>'amount')::numeric - COALESCE((v_pay->>'change_amount')::numeric,0),
      v_pay->>'payment_method_code', v_sale_id
    );
  END LOOP;

  IF NULLIF(p_payload->>'customer_id','') IS NOT NULL THEN
    PERFORM public.credit_loyalty_points(v_tenant, (p_payload->>'customer_id')::uuid, v_sale_id,
      COALESCE((p_payload->>'net_total')::numeric,0));
  END IF;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id);
END;
$$;

REVOKE ALL ON FUNCTION public.checkout_sale_transaction(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_sale_transaction(jsonb) TO authenticated;
