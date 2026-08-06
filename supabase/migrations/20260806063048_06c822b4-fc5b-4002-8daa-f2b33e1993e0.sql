-- Seed default production stations
CREATE OR REPLACE FUNCTION public.seed_default_stations(p_tenant_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.production_stations WHERE tenant_id = p_tenant_id) THEN
    INSERT INTO public.production_stations (tenant_id, name, code, display_order) VALUES
      (p_tenant_id, 'Cozinha', 'cozinha', 1),
      (p_tenant_id, 'Bar', 'bar', 2),
      (p_tenant_id, 'Chapa', 'chapa', 3);
  END IF;
END $$;

-- Consume / restore recipe ingredients
CREATE OR REPLACE FUNCTION public.apply_recipe_stock(p_tenant_id uuid, p_menu_item_id uuid, p_quantity numeric, p_direction integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT product_id, quantity FROM public.menu_item_recipe
    WHERE tenant_id = p_tenant_id AND menu_item_id = p_menu_item_id
  LOOP
    UPDATE public.products
      SET stock_current = COALESCE(stock_current,0) + (p_direction * r.quantity * p_quantity),
          updated_at = now()
      WHERE id = r.product_id AND tenant_id = p_tenant_id;

    INSERT INTO public.stock_movements (tenant_id, product_id, movement_type, quantity, description)
    VALUES (p_tenant_id, r.product_id,
      CASE WHEN p_direction < 0 THEN 'sale' ELSE 'return' END,
      r.quantity * p_quantity,
      CASE WHEN p_direction < 0 THEN 'Consumo por pedido (ficha técnica)' ELSE 'Estorno de pedido (ficha técnica)' END);

    IF p_direction < 0 THEN
      PERFORM public.consume_lots_fefo(p_tenant_id, r.product_id, r.quantity * p_quantity);
    END IF;
  END LOOP;
END $$;

-- Create order
CREATE OR REPLACE FUNCTION public.create_restaurant_order(p_payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_tenant uuid := (p_payload->>'tenant_id')::uuid;
  v_user uuid := auth.uid();
  v_type text := COALESCE(p_payload->>'order_type','mesa');
  v_tab uuid := NULLIF(p_payload->>'tab_id','')::uuid;
  v_table uuid := NULLIF(p_payload->>'table_id','')::uuid;
  v_customer uuid := NULLIF(p_payload->>'customer_id','')::uuid;
  v_delivery jsonb := p_payload->'delivery';
  v_service_pct numeric := COALESCE((p_payload->>'service_fee_pct')::numeric, 0);
  v_delivery_fee numeric := COALESCE((p_payload->>'delivery_fee')::numeric, 0);
  v_discount numeric := COALESCE((p_payload->>'discount')::numeric, 0);
  v_order uuid;
  v_number integer;
  v_item jsonb;
  v_opt jsonb;
  v_mi RECORD;
  v_qty numeric;
  v_opt_total numeric;
  v_line numeric;
  v_subtotal numeric := 0;
  v_item_id uuid;
  v_service numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v_type NOT IN ('mesa','balcao','delivery') THEN RAISE EXCEPTION 'Tipo de pedido inválido'; END IF;

  SELECT COALESCE(MAX(order_number),0) + 1 INTO v_number
  FROM public.orders WHERE tenant_id = v_tenant;

  INSERT INTO public.orders (
    tenant_id, order_number, order_type, status, tab_id, table_id, customer_id,
    waiter_id, created_by, delivery_fee, discount, notes
  ) VALUES (
    v_tenant, v_number, v_type, 'received', v_tab, v_table, v_customer,
    v_user, v_user, v_delivery_fee, v_discount, NULLIF(p_payload->>'notes','')
  ) RETURNING id INTO v_order;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'items','[]'::jsonb)) LOOP
    SELECT * INTO v_mi FROM public.menu_items
      WHERE id = (v_item->>'menu_item_id')::uuid AND tenant_id = v_tenant;
    IF v_mi.id IS NULL THEN RAISE EXCEPTION 'Item do cardápio não encontrado'; END IF;
    IF NOT v_mi.available THEN RAISE EXCEPTION 'Item indisponível: %', v_mi.name; END IF;

    v_qty := COALESCE((v_item->>'quantity')::numeric, 1);
    v_opt_total := 0;
    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options','[]'::jsonb)) LOOP
      v_opt_total := v_opt_total + COALESCE((v_opt->>'price_delta')::numeric, 0);
    END LOOP;

    v_line := ROUND((v_mi.price + v_opt_total) * v_qty, 2);
    v_subtotal := v_subtotal + v_line;

    INSERT INTO public.order_items (
      tenant_id, order_id, menu_item_id, station_id, item_name, quantity,
      unit_price, options_total, total, notes, status
    ) VALUES (
      v_tenant, v_order, v_mi.id, v_mi.station_id, v_mi.name, v_qty,
      v_mi.price, v_opt_total, v_line, NULLIF(v_item->>'notes',''), 'pending'
    ) RETURNING id INTO v_item_id;

    FOR v_opt IN SELECT * FROM jsonb_array_elements(COALESCE(v_item->'options','[]'::jsonb)) LOOP
      INSERT INTO public.order_item_options (tenant_id, order_item_id, option_name, value_name, price_delta)
      VALUES (v_tenant, v_item_id, v_opt->>'option_name', v_opt->>'value_name',
              COALESCE((v_opt->>'price_delta')::numeric,0));
    END LOOP;

    PERFORM public.apply_recipe_stock(v_tenant, v_mi.id, v_qty, -1);
  END LOOP;

  v_service := ROUND(v_subtotal * v_service_pct / 100, 2);

  UPDATE public.orders
    SET subtotal = v_subtotal,
        service_fee = v_service,
        total = v_subtotal + v_service + v_delivery_fee - v_discount,
        confirmed_at = now()
    WHERE id = v_order;

  IF v_type = 'delivery' AND v_delivery IS NOT NULL THEN
    INSERT INTO public.delivery_info (
      tenant_id, order_id, recipient_name, phone, zip_code, street, number,
      complement, neighborhood, city, state, reference_point, estimated_minutes
    ) VALUES (
      v_tenant, v_order, v_delivery->>'recipient_name', v_delivery->>'phone',
      v_delivery->>'zip_code', v_delivery->>'street', v_delivery->>'number',
      v_delivery->>'complement', v_delivery->>'neighborhood', v_delivery->>'city',
      v_delivery->>'state', v_delivery->>'reference_point',
      NULLIF(v_delivery->>'estimated_minutes','')::int
    );
  END IF;

  RETURN v_order;
END $$;

-- Order status
CREATE OR REPLACE FUNCTION public.set_order_status(p_order_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid; v_old text; v_it RECORD;
BEGIN
  SELECT tenant_id, status INTO v_tenant, v_old FROM public.orders WHERE id = p_order_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_status NOT IN ('received','preparing','ready','dispatched','delivered','closed','cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  IF p_status = 'cancelled' AND v_old <> 'cancelled' THEN
    FOR v_it IN SELECT menu_item_id, quantity FROM public.order_items
      WHERE order_id = p_order_id AND menu_item_id IS NOT NULL LOOP
      PERFORM public.apply_recipe_stock(v_tenant, v_it.menu_item_id, v_it.quantity, 1);
    END LOOP;
  END IF;

  UPDATE public.orders SET
    status = p_status,
    ready_at = CASE WHEN p_status = 'ready' THEN now() ELSE ready_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
    closed_at = CASE WHEN p_status IN ('closed','cancelled') THEN now() ELSE closed_at END
  WHERE id = p_order_id;
END $$;

CREATE OR REPLACE FUNCTION public.set_order_item_status(p_item_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid; v_order uuid;
BEGIN
  SELECT tenant_id, order_id INTO v_tenant, v_order FROM public.order_items WHERE id = p_item_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_status NOT IN ('pending','preparing','ready','delivered','cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;

  UPDATE public.order_items SET
    status = p_status,
    started_at = CASE WHEN p_status = 'preparing' THEN now() ELSE started_at END,
    ready_at = CASE WHEN p_status = 'ready' THEN now() ELSE ready_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END
  WHERE id = p_item_id;

  -- Roll up order status
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order AND status IN ('pending','preparing')) THEN
    UPDATE public.orders SET status = 'ready', ready_at = COALESCE(ready_at, now())
      WHERE id = v_order AND status IN ('received','preparing');
  ELSIF EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order AND status = 'preparing') THEN
    UPDATE public.orders SET status = 'preparing' WHERE id = v_order AND status = 'received';
  END IF;
END $$;

-- Merge / transfer tabs
CREATE OR REPLACE FUNCTION public.merge_tabs(p_source_tab uuid, p_target_tab uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid; v_target_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.tabs WHERE id = p_source_tab;
  SELECT tenant_id INTO v_target_tenant FROM public.tabs WHERE id = p_target_tab;
  IF v_tenant IS NULL OR v_target_tenant IS NULL OR v_tenant <> v_target_tenant THEN
    RAISE EXCEPTION 'Comandas inválidas';
  END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;

  UPDATE public.tab_items SET tab_id = p_target_tab WHERE tab_id = p_source_tab;
  UPDATE public.orders SET tab_id = p_target_tab WHERE tab_id = p_source_tab;
  UPDATE public.tabs SET status = 'closed', closed_at = now(), merged_into_tab_id = p_target_tab
    WHERE id = p_source_tab;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_tab(p_tab_id uuid, p_table_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_tenant uuid; v_old_table uuid;
BEGIN
  SELECT tenant_id, table_id INTO v_tenant, v_old_table FROM public.tabs WHERE id = p_tab_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Comanda não encontrada'; END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF p_table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tables WHERE id = p_table_id AND tenant_id = v_tenant
  ) THEN RAISE EXCEPTION 'Mesa inválida'; END IF;

  UPDATE public.tabs SET table_id = p_table_id WHERE id = p_tab_id;
  UPDATE public.orders SET table_id = p_table_id WHERE tab_id = p_tab_id;
  IF v_old_table IS NOT NULL THEN
    UPDATE public.tables SET status = 'free' WHERE id = v_old_table;
  END IF;
  IF p_table_id IS NOT NULL THEN
    UPDATE public.tables SET status = 'occupied' WHERE id = p_table_id;
  END IF;
END $$;

REVOKE EXECUTE ON FUNCTION public.apply_recipe_stock(uuid, uuid, numeric, integer) FROM anon, authenticated;