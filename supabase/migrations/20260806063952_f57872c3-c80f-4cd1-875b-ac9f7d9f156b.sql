ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_name text;

ALTER TABLE public.sale_items ALTER COLUMN product_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.close_restaurant_tab(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_tab_id uuid := (p_payload->>'tab_id')::uuid;
  v_tab public.tabs;
  v_tenant uuid;
  v_discount numeric := COALESCE((p_payload->>'discount')::numeric, 0);
  v_service_pct numeric := COALESCE((p_payload->>'service_fee_pct')::numeric, 0);
  v_couvert numeric := COALESCE((p_payload->>'couvert_total')::numeric, 0);
  v_customer uuid := NULLIF(p_payload->>'customer_id','')::uuid;
  v_subtotal numeric := 0;
  v_service numeric := 0;
  v_total numeric := 0;
  v_sale_id uuid;
  v_session uuid;
  v_pay jsonb;
  v_code text;
  v_amount numeric;
  v_is_credit boolean;
  v_first_code text;
  v_rec RECORD;
  v_category uuid;
  v_customer_name text;
  v_due_days integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO v_tab FROM public.tabs WHERE id = v_tab_id FOR UPDATE;
  IF v_tab.id IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;

  v_tenant := v_tab.tenant_id;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v_tab.status <> 'open' THEN RAISE EXCEPTION 'Comanda já está fechada'; END IF;

  -- Subtotal: itens diretos da comanda + itens de pedidos ativos
  SELECT COALESCE(SUM(ti.total), 0) INTO v_subtotal
  FROM public.tab_items ti WHERE ti.tab_id = v_tab_id;

  SELECT v_subtotal + COALESCE(SUM(oi.total), 0) INTO v_subtotal
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.tab_id = v_tab_id
    AND o.status <> 'cancelled'
    AND oi.status <> 'cancelled';

  v_service := ROUND(v_subtotal * v_service_pct / 100.0, 2);
  v_total := ROUND(v_subtotal + v_service + v_couvert - v_discount, 2);
  IF v_total < 0 THEN RAISE EXCEPTION 'Total não pode ser negativo'; END IF;

  SELECT id INTO v_session FROM public.cash_sessions
  WHERE tenant_id = v_tenant AND status = 'open'
  ORDER BY opened_at DESC LIMIT 1;

  SELECT p->>'payment_method_code' INTO v_first_code
  FROM jsonb_array_elements(COALESCE(p_payload->'payments','[]'::jsonb)) p LIMIT 1;

  INSERT INTO public.sales (
    tenant_id, datetime, user_id, customer_id, gross_total, discount_total,
    net_total, payment_method, notes, session_id
  ) VALUES (
    v_tenant, now(), v_user, v_customer,
    ROUND(v_subtotal + v_service + v_couvert, 2), v_discount, v_total,
    COALESCE(v_first_code, 'dinheiro'),
    COALESCE(NULLIF(p_payload->>'notes',''), 'Comanda ' || COALESCE(v_tab.customer_name, substr(v_tab_id::text,1,8))),
    v_session
  ) RETURNING id INTO v_sale_id;

  -- Itens diretos (produtos): baixam estoque agora
  FOR v_rec IN
    SELECT ti.product_id, ti.quantity, ti.unit_price, COALESCE(ti.discount,0) AS discount, ti.total, p.name
    FROM public.tab_items ti
    JOIN public.products p ON p.id = ti.product_id
    WHERE ti.tab_id = v_tab_id
  LOOP
    INSERT INTO public.sale_items (sale_id, product_id, item_name, quantity, unit_price, discount, total)
    VALUES (v_sale_id, v_rec.product_id, v_rec.name, v_rec.quantity, v_rec.unit_price, v_rec.discount, v_rec.total);

    UPDATE public.products
      SET stock_current = COALESCE(stock_current,0) - v_rec.quantity, updated_at = now()
      WHERE id = v_rec.product_id AND tenant_id = v_tenant;

    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, sale_id, description)
    VALUES (v_tenant, v_rec.product_id, 'sale', v_rec.quantity, v_sale_id, 'Fechamento de comanda');

    PERFORM public.consume_lots_fefo(v_tenant, v_rec.product_id, v_rec.quantity);
  END LOOP;

  -- Itens de pedidos (cardápio): estoque já baixado via ficha técnica
  FOR v_rec IN
    SELECT oi.menu_item_id, oi.item_name, oi.quantity,
           (oi.unit_price + COALESCE(oi.options_total,0)) AS unit_price, oi.total
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE o.tab_id = v_tab_id AND o.status <> 'cancelled' AND oi.status <> 'cancelled'
  LOOP
    INSERT INTO public.sale_items (sale_id, menu_item_id, item_name, quantity, unit_price, discount, total)
    VALUES (v_sale_id, v_rec.menu_item_id, v_rec.item_name, v_rec.quantity, v_rec.unit_price, 0, v_rec.total);
  END LOOP;

  -- Pagamentos
  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'payments','[]'::jsonb)) LOOP
    v_code := v_pay->>'payment_method_code';
    v_amount := (v_pay->>'amount')::numeric - COALESCE((v_pay->>'change_amount')::numeric, 0);

    SELECT EXISTS (
      SELECT 1 FROM public.payment_methods pm
      WHERE pm.tenant_id = v_tenant AND pm.code = v_code AND pm.type = 'credit'
    ) OR v_code = 'fiado' INTO v_is_credit;

    INSERT INTO public.sale_payments (
      sale_id, payment_method_id, payment_method_code, amount, change_amount, installments
    ) VALUES (
      v_sale_id, NULLIF(v_pay->>'payment_method_id','')::uuid, v_code,
      (v_pay->>'amount')::numeric, COALESCE((v_pay->>'change_amount')::numeric,0),
      COALESCE((v_pay->>'installments')::int, 1)
    );

    IF v_is_credit THEN
      IF v_customer IS NULL THEN
        RAISE EXCEPTION 'Venda no fiado exige um cliente vinculado';
      END IF;

      SELECT name INTO v_customer_name FROM public.customers WHERE id = v_customer AND tenant_id = v_tenant;
      SELECT COALESCE((settings->>'fiado_due_days')::int, 30) INTO v_due_days FROM public.tenants WHERE id = v_tenant;

      SELECT id INTO v_category FROM public.financial_categories
        WHERE tenant_id = v_tenant AND type = 'receita' AND name = 'Vendas a Prazo' LIMIT 1;
      IF v_category IS NULL THEN
        INSERT INTO public.financial_categories (tenant_id, name, type, color)
        VALUES (v_tenant, 'Vendas a Prazo', 'receita', '#22c55e') RETURNING id INTO v_category;
      END IF;

      INSERT INTO public.accounts (
        tenant_id, type, description, amount, due_date, status,
        category_id, party_name, customer_id, notes, created_by
      ) VALUES (
        v_tenant, 'receber',
        'Comanda a prazo - ' || COALESCE(v_customer_name, 'Cliente'),
        v_amount, CURRENT_DATE + COALESCE(v_due_days, 30), 'aberta',
        v_category, v_customer_name, v_customer,
        'Gerado pelo fechamento de comanda. Venda: ' || v_sale_id::text, v_user
      );
    ELSE
      IF v_session IS NOT NULL THEN
        INSERT INTO public.cash_movements (
          tenant_id, session_id, user_id, movement_type, amount, payment_method, sale_id, description
        ) VALUES (
          v_tenant, v_session, v_user, 'sale', v_amount, v_code, v_sale_id, 'Fechamento de comanda'
        );
      END IF;

      INSERT INTO public.financial_entries (
        tenant_id, entry_date, type, description, amount, payment_method, sale_id
      ) VALUES (
        v_tenant, CURRENT_DATE, 'income', 'Fechamento de comanda', v_amount, v_code, v_sale_id
      );
    END IF;
  END LOOP;

  IF v_customer IS NOT NULL THEN
    PERFORM public.credit_loyalty_points(v_tenant, v_customer, v_sale_id, v_total);
  END IF;

  UPDATE public.orders SET status = 'closed'
    WHERE tab_id = v_tab_id AND status NOT IN ('cancelled','closed');

  UPDATE public.tabs
    SET status = 'closed', closed_at = now(),
        service_fee_pct = v_service_pct, couvert_total = v_couvert
    WHERE id = v_tab_id;

  IF v_tab.table_id IS NOT NULL THEN
    UPDATE public.tables SET status = 'available' WHERE id = v_tab.table_id;
  END IF;

  RETURN jsonb_build_object(
    'sale_id', v_sale_id, 'subtotal', v_subtotal,
    'service_fee', v_service, 'total', v_total
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.close_restaurant_tab(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_restaurant_tab(jsonb) TO authenticated;