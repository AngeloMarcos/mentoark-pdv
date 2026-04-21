-- ============ TABELAS ============

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  payment_terms TEXT,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_tenant ON public.suppliers(tenant_id);
CREATE INDEX idx_suppliers_name ON public.suppliers(tenant_id, name);

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  order_number TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  expected_date DATE,
  received_date DATE,
  total_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  freight NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_orders_tenant ON public.purchase_orders(tenant_id);
CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders(supplier_id);
CREATE INDEX idx_purchase_orders_status ON public.purchase_orders(tenant_id, status);

CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_ordered NUMERIC(12,3) NOT NULL CHECK (quantity_ordered > 0),
  quantity_received NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_purchase_order_items_order ON public.purchase_order_items(order_id);

-- ============ TRIGGERS UPDATED_AT ============

CREATE TRIGGER update_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RLS ============

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;

-- suppliers
CREATE POLICY "Users can view suppliers of their tenants"
  ON public.suppliers FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "Users can insert suppliers in their tenants"
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "Users can update suppliers in their tenants"
  ON public.suppliers FOR UPDATE TO authenticated
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "Admins can delete suppliers"
  ON public.suppliers FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));
CREATE POLICY "Super admins can access all suppliers"
  ON public.suppliers FOR ALL USING (is_super_admin());

-- purchase_orders
CREATE POLICY "Users can view purchase_orders of their tenants"
  ON public.purchase_orders FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "Users can insert purchase_orders in their tenants"
  ON public.purchase_orders FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(tenant_id));
CREATE POLICY "Users can update purchase_orders in their tenants"
  ON public.purchase_orders FOR UPDATE TO authenticated
  USING (user_belongs_to_tenant(tenant_id));
CREATE POLICY "Admins can delete purchase_orders"
  ON public.purchase_orders FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));
CREATE POLICY "Super admins can access all purchase_orders"
  ON public.purchase_orders FOR ALL USING (is_super_admin());

-- purchase_order_items
CREATE POLICY "Users can view purchase_order_items through orders"
  ON public.purchase_order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.order_id AND user_belongs_to_tenant(po.tenant_id)));
CREATE POLICY "Users can insert purchase_order_items through orders"
  ON public.purchase_order_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.order_id AND user_belongs_to_tenant(po.tenant_id)));
CREATE POLICY "Users can update purchase_order_items through orders"
  ON public.purchase_order_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.order_id AND user_belongs_to_tenant(po.tenant_id)));
CREATE POLICY "Users can delete purchase_order_items through orders"
  ON public.purchase_order_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.purchase_orders po
    WHERE po.id = purchase_order_items.order_id AND user_belongs_to_tenant(po.tenant_id)));
CREATE POLICY "Super admins can access all purchase_order_items"
  ON public.purchase_order_items FOR ALL USING (is_super_admin());

-- ============ RPC: RECEIVE PURCHASE ORDER ITEMS ============

CREATE OR REPLACE FUNCTION public.receive_purchase_order_items(
  p_order_id UUID,
  p_items JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_status TEXT;
  v_item JSONB;
  v_oi RECORD;
  v_qty NUMERIC(12,3);
  v_total_ordered NUMERIC := 0;
  v_total_received NUMERIC := 0;
  v_new_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT tenant_id, status INTO v_tenant_id, v_status
  FROM public.purchase_orders WHERE id = p_order_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF NOT user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_status NOT IN ('sent','partially_received') THEN
    RAISE EXCEPTION 'Pedido precisa estar enviado ou parcialmente recebido para receber itens';
  END IF;

  -- Processa itens recebidos
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

    -- Atualiza item
    UPDATE public.purchase_order_items
    SET quantity_received = quantity_received + v_qty
    WHERE id = v_oi.id;

    -- Atualiza estoque + WAC
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
  END LOOP;

  -- Recalcula status
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

  RETURN v_new_status;
END;
$$;