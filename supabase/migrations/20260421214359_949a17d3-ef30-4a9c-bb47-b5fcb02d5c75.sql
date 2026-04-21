-- ============ TABELAS ============

CREATE TABLE public.sale_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL,
  reason TEXT NOT NULL,
  reason_type TEXT NOT NULL DEFAULT 'other',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  refund_method TEXT NOT NULL,
  refund_reference_id UUID,
  notes TEXT,
  session_id UUID REFERENCES public.cash_sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sale_returns_tenant ON public.sale_returns(tenant_id);
CREATE INDEX idx_sale_returns_sale ON public.sale_returns(sale_id);
CREATE INDEX idx_sale_returns_created_at ON public.sale_returns(created_at DESC);

CREATE TABLE public.sale_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE RESTRICT,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(12,3) NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_sale_return_items_return ON public.sale_return_items(return_id);
CREATE INDEX idx_sale_return_items_sale_item ON public.sale_return_items(sale_item_id);

-- ============ RLS ============

ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sale_returns of their tenants"
  ON public.sale_returns FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert sale_returns in their tenants"
  ON public.sale_returns FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete sale_returns"
  ON public.sale_returns FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));

CREATE POLICY "Super admins can access all sale_returns"
  ON public.sale_returns FOR ALL
  USING (is_super_admin());

CREATE POLICY "Users can view sale_return_items through returns"
  ON public.sale_return_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.sale_returns r
    WHERE r.id = sale_return_items.return_id
      AND user_belongs_to_tenant(r.tenant_id)
  ));

CREATE POLICY "Users can insert sale_return_items through returns"
  ON public.sale_return_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sale_returns r
    WHERE r.id = sale_return_items.return_id
      AND user_belongs_to_tenant(r.tenant_id)
  ));

CREATE POLICY "Super admins can access all sale_return_items"
  ON public.sale_return_items FOR ALL
  USING (is_super_admin());

-- ============ RPC ATÔMICA ============

CREATE OR REPLACE FUNCTION public.process_sale_return(
  p_sale_id UUID,
  p_reason TEXT,
  p_reason_type TEXT,
  p_refund_method TEXT,
  p_notes TEXT,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_customer_id UUID;
  v_return_id UUID;
  v_total NUMERIC(12,2) := 0;
  v_session_id UUID;
  v_item JSONB;
  v_sale_item RECORD;
  v_already_returned NUMERIC(12,3);
  v_qty NUMERIC(12,3);
  v_line_total NUMERIC(12,2);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Carrega venda
  SELECT tenant_id, customer_id INTO v_tenant_id, v_customer_id
  FROM public.sales WHERE id = p_sale_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  IF NOT user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta venda';
  END IF;

  IF p_refund_method NOT IN ('store_credit','cash','pix') THEN
    RAISE EXCEPTION 'Forma de reembolso inválida';
  END IF;

  IF p_refund_method = 'store_credit' AND v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Crédito em loja exige cliente vinculado à venda';
  END IF;

  -- Sessão de caixa aberta (se reembolso em dinheiro)
  IF p_refund_method IN ('cash','pix') THEN
    SELECT id INTO v_session_id
    FROM public.cash_sessions
    WHERE tenant_id = v_tenant_id AND status = 'open'
    ORDER BY opened_at DESC LIMIT 1;

    IF v_session_id IS NULL THEN
      RAISE EXCEPTION 'Não há caixa aberto para registrar o reembolso';
    END IF;
  END IF;

  -- Cria devolução
  INSERT INTO public.sale_returns (
    tenant_id, sale_id, created_by, reason, reason_type,
    total_amount, refund_method, notes, session_id
  ) VALUES (
    v_tenant_id, p_sale_id, v_user_id, p_reason, p_reason_type,
    0, p_refund_method, p_notes, v_session_id
  )
  RETURNING id INTO v_return_id;

  -- Itens
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::NUMERIC;

    SELECT si.*, si.unit_price AS u_price INTO v_sale_item
    FROM public.sale_items si
    WHERE si.id = (v_item->>'sale_item_id')::UUID
      AND si.sale_id = p_sale_id;

    IF v_sale_item.id IS NULL THEN
      RAISE EXCEPTION 'Item de venda inválido';
    END IF;

    SELECT COALESCE(SUM(quantity),0) INTO v_already_returned
    FROM public.sale_return_items
    WHERE sale_item_id = v_sale_item.id;

    IF (v_already_returned + v_qty) > v_sale_item.quantity THEN
      RAISE EXCEPTION 'Quantidade a devolver excede a vendida';
    END IF;

    v_line_total := ROUND(v_qty * v_sale_item.u_price, 2);
    v_total := v_total + v_line_total;

    INSERT INTO public.sale_return_items (
      return_id, sale_item_id, product_id, quantity, unit_price, total
    ) VALUES (
      v_return_id, v_sale_item.id, v_sale_item.product_id,
      v_qty, v_sale_item.u_price, v_line_total
    );

    -- Estorna estoque
    UPDATE public.products
    SET stock_current = COALESCE(stock_current,0) + v_qty,
        updated_at = now()
    WHERE id = v_sale_item.product_id;

    INSERT INTO public.stock_movements (
      tenant_id, product_id, movement_type, quantity, sale_id, description
    ) VALUES (
      v_tenant_id, v_sale_item.product_id, 'return', v_qty, p_sale_id,
      'Devolução ref. venda'
    );
  END LOOP;

  -- Atualiza total
  UPDATE public.sale_returns SET total_amount = v_total WHERE id = v_return_id;

  -- Reembolso
  IF p_refund_method = 'store_credit' THEN
    INSERT INTO public.customer_credits (
      tenant_id, customer_id, amount, origin_type, origin_id,
      description, expires_at
    ) VALUES (
      v_tenant_id, v_customer_id, v_total, 'sale_return', v_return_id,
      'Crédito de devolução', CURRENT_DATE + 365
    );
  ELSE
    INSERT INTO public.cash_movements (
      tenant_id, session_id, user_id, movement_type, amount,
      payment_method, sale_id, description
    ) VALUES (
      v_tenant_id, v_session_id, v_user_id, 'withdrawal', v_total,
      p_refund_method, p_sale_id, 'Reembolso de devolução'
    );

    INSERT INTO public.financial_entries (
      tenant_id, entry_date, type, description, amount, payment_method, sale_id
    ) VALUES (
      v_tenant_id, CURRENT_DATE, 'expense',
      'Reembolso de devolução', v_total, p_refund_method, p_sale_id
    );
  END IF;

  RETURN v_return_id;
END;
$$;