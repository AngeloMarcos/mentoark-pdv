
CREATE UNIQUE INDEX IF NOT EXISTS ux_cash_sessions_one_open_per_register
  ON public.cash_sessions (tenant_id, register_id)
  WHERE status = 'open';

ALTER TABLE public.cash_sessions
  ADD COLUMN IF NOT EXISTS discrepancy_by_method jsonb;

CREATE OR REPLACE FUNCTION public.mirror_cash_movement_to_financial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.movement_type IN ('supply','withdrawal') THEN
    INSERT INTO public.financial_entries (
      tenant_id, entry_date, type, description, amount, payment_method
    ) VALUES (
      NEW.tenant_id,
      CURRENT_DATE,
      CASE WHEN NEW.movement_type = 'supply' THEN 'income' ELSE 'expense' END,
      COALESCE(NEW.description,
        CASE WHEN NEW.movement_type = 'supply' THEN 'Suprimento de caixa' ELSE 'Sangria de caixa' END),
      NEW.amount,
      COALESCE(NEW.payment_method, 'dinheiro')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_cash_movement ON public.cash_movements;
CREATE TRIGGER trg_mirror_cash_movement
  AFTER INSERT ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.mirror_cash_movement_to_financial();

CREATE OR REPLACE FUNCTION public.adjust_stock(
  p_product_id uuid,
  p_delta numeric,
  p_reason text DEFAULT 'Ajuste manual'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
  v_new_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT tenant_id INTO v_tenant
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  IF NOT public.user_belongs_to_tenant(v_tenant) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  UPDATE public.products
    SET stock_current = COALESCE(stock_current, 0) + p_delta,
        updated_at = now()
    WHERE id = p_product_id
    RETURNING stock_current INTO v_new_stock;

  INSERT INTO public.stock_movements (
    tenant_id, product_id, movement_type, quantity, description
  ) VALUES (
    v_tenant, p_product_id, 'adjustment', p_delta, p_reason
  );

  RETURN v_new_stock;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_stock(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, numeric, text) TO authenticated;
