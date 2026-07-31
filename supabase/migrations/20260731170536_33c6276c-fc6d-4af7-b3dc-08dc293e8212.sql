CREATE OR REPLACE FUNCTION public.seed_default_payment_methods(p_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'Acesso negado a esta empresa';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.payment_methods WHERE tenant_id = p_tenant_id) THEN
    INSERT INTO public.payment_methods (tenant_id, code, name, type, requires_change, allows_installments, max_installments, display_order)
    VALUES
      (p_tenant_id, 'dinheiro', 'Dinheiro', 'money', true, false, 1, 1),
      (p_tenant_id, 'pix', 'PIX', 'pix', false, false, 1, 2),
      (p_tenant_id, 'cartao_debito', 'Cartão de Débito', 'card_debit', false, false, 1, 3),
      (p_tenant_id, 'cartao_credito', 'Cartão de Crédito', 'card_credit', false, true, 12, 4),
      (p_tenant_id, 'fiado', 'Fiado/Crediário', 'credit', false, false, 1, 5);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_payment_methods(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_payment_methods(uuid) TO authenticated, service_role;