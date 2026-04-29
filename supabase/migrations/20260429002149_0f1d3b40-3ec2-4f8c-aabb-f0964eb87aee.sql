-- ============================================
-- Expand suppliers
-- ============================================
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS fantasy_name TEXT,
  ADD COLUMN IF NOT EXISTS state_registration TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS street TEXT,
  ADD COLUMN IF NOT EXISTS number TEXT,
  ADD COLUMN IF NOT EXISTS complement TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_agency TEXT,
  ADD COLUMN IF NOT EXISTS bank_account TEXT,
  ADD COLUMN IF NOT EXISTS pix_key TEXT,
  ADD COLUMN IF NOT EXISTS due_days INTEGER NOT NULL DEFAULT 30;

-- ============================================
-- Recreate receive RPC: now also creates an Account Payable
-- ============================================
CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
  p_order_id UUID,
  p_items JSONB,
  p_due_date DATE DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_status TEXT;
  v_supplier_id UUID;
  v_supplier_name TEXT;
  v_supplier_due_days INTEGER;
  v_order_number TEXT;
  v_item JSONB;
  v_oi RECORD;
  v_qty NUMERIC(12,3);
  v_total_ordered NUMERIC := 0;
  v_total_received NUMERIC := 0;
  v_new_status TEXT;
  v_received_total NUMERIC := 0;
  v_category_id UUID;
  v_due DATE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT po.tenant_id, po.status, po.supplier_id, po.order_number, s.name, COALESCE(s.due_days, 30)
    INTO v_tenant_id, v_status, v_supplier_id, v_order_number, v_supplier_name, v_supplier_due_days
  FROM public.purchase_orders po
  LEFT JOIN public.suppliers s ON s.id = po.supplier_id
  WHERE po.id = p_order_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_status NOT IN ('sent','partially_received') THEN
    RAISE EXCEPTION 'Pedido precisa estar enviado ou parcialmente recebido para receber itens';
  END IF;

  -- Process received items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity_received')::NUMERIC;
    IF v_qty <= 0 THEN CONTINUE; END IF;

    SELECT * INTO v_oi FROM public.purchase_order_items
    WHERE id = (v_item->>'item_id')::UUID AND order_id = p_order_id;

    IF v_oi.id IS NULL THEN
      RAISE EXCEPTION 'Item de pedido inválido';
    END IF;

    IF (v_oi.quantity_received + v_qty) > v_oi.quantity_ordered THEN
      RAISE EXCEPTION 'Quantidade recebida excede a pedida';
    END IF;

    UPDATE public.purchase_order_items
    SET quantity_received = quantity_received + v_qty
    WHERE id = v_oi.id;

    PERFORM public.update_weighted_avg_cost(v_oi.product_id, v_qty, v_oi.unit_cost);

    UPDATE public.products
    SET stock_current = COALESCE(stock_current,0) + v_qty,
        cost_price = v_oi.unit_cost,
        updated_at = now()
    WHERE id = v_oi.product_id;

    INSERT INTO public.stock_movements (
      tenant_id, product_id, movement_type, quantity, description
    ) VALUES (
      v_tenant_id, v_oi.product_id, 'purchase', v_qty,
      'Recebimento de pedido de compra'
    );

    v_received_total := v_received_total + ROUND(v_qty * v_oi.unit_cost, 2);
  END LOOP;

  -- Recompute order status
  SELECT COALESCE(SUM(quantity_ordered),0), COALESCE(SUM(quantity_received),0)
  INTO v_total_ordered, v_total_received
  FROM public.purchase_order_items WHERE order_id = p_order_id;

  IF v_total_received >= v_total_ordered THEN
    v_new_status := 'received';
  ELSIF v_total_received > 0 THEN
    v_new_status := 'partially_received';
  ELSE
    v_new_status := v_status;
  END IF;

  UPDATE public.purchase_orders
  SET status = v_new_status,
      received_date = CASE WHEN v_new_status = 'received' THEN CURRENT_DATE ELSE received_date END
  WHERE id = p_order_id;

  -- Create Account Payable for this received batch
  IF v_received_total > 0 THEN
    v_due := COALESCE(p_due_date, CURRENT_DATE + v_supplier_due_days);

    SELECT id INTO v_category_id
    FROM public.financial_categories
    WHERE tenant_id = v_tenant_id AND type = 'despesa' AND name = 'Fornecedores'
    LIMIT 1;

    INSERT INTO public.accounts (
      tenant_id, type, description, amount, due_date,
      status, category_id, party_name, notes, created_by
    ) VALUES (
      v_tenant_id,
      'pagar',
      'Compra ' || COALESCE('#' || v_order_number, '') || ' - ' || COALESCE(v_supplier_name, 'Fornecedor'),
      v_received_total,
      v_due,
      'aberta',
      v_category_id,
      v_supplier_name,
      'Gerado automaticamente pelo recebimento de pedido de compra',
      v_user_id
    );
  END IF;

  RETURN v_new_status;
END;
$$;