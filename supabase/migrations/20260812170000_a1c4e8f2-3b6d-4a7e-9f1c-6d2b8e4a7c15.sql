-- Corrige políticas de UPDATE que só verificavam vínculo com o tenant
-- (user_belongs_to_tenant), sem checar o papel do usuário. Isso permitia
-- que qualquer membro do tenant (inclusive garçom/estoquista, que nem têm
-- acesso aos módulos de PDV/Financeiro na tela) alterasse vendas,
-- lançamentos financeiros, contas e créditos de cliente diretamente pela
-- API, ignorando as permissões definidas em PERMISSION_MAP
-- (src/lib/permissions.ts). Segue o mesmo padrão já aplicado a
-- cash_movements e employees na migração 20260722160747.

-- 1) sales: só admin/gerente corrigem uma venda já registrada
DROP POLICY IF EXISTS "Users can update sales in their tenants" ON public.sales;
CREATE POLICY "Admins and managers can update sales"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
  )
  WITH CHECK (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
  );

-- 2) financial_entries: só papéis com acesso ao módulo financeiro
DROP POLICY IF EXISTS "Users can update financial_entries in their tenants" ON public.financial_entries;
CREATE POLICY "Financial roles can update financial_entries"
  ON public.financial_entries FOR UPDATE
  TO authenticated
  USING (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
    OR has_tenant_role(tenant_id, 'financial'::app_role)
  )
  WITH CHECK (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
    OR has_tenant_role(tenant_id, 'financial'::app_role)
  );

-- 3) accounts: mesmo critério do financeiro
DROP POLICY IF EXISTS "Users can update accounts in their tenants" ON public.accounts;
CREATE POLICY "Financial roles can update accounts"
  ON public.accounts FOR UPDATE
  TO authenticated
  USING (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
    OR has_tenant_role(tenant_id, 'financial'::app_role)
  )
  WITH CHECK (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
    OR has_tenant_role(tenant_id, 'financial'::app_role)
  );

-- 4) customer_credits: papéis com acesso a Clientes (dashboard/pdv/financeiro)
DROP POLICY IF EXISTS "Users can update customer_credits in their tenants" ON public.customer_credits;
CREATE POLICY "Customer-facing roles can update customer_credits"
  ON public.customer_credits FOR UPDATE
  TO authenticated
  USING (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
    OR has_tenant_role(tenant_id, 'operator'::app_role)
    OR has_tenant_role(tenant_id, 'cashier'::app_role)
    OR has_tenant_role(tenant_id, 'financial'::app_role)
  )
  WITH CHECK (
    has_tenant_role(tenant_id, 'admin'::app_role)
    OR has_tenant_role(tenant_id, 'manager'::app_role)
    OR has_tenant_role(tenant_id, 'operator'::app_role)
    OR has_tenant_role(tenant_id, 'cashier'::app_role)
    OR has_tenant_role(tenant_id, 'financial'::app_role)
  );

-- 5) pay_account: a RPC (SECURITY DEFINER) tinha a mesma lacuna — validava
-- só o vínculo com o tenant, não o papel. Mantém o restante do corpo igual.
CREATE OR REPLACE FUNCTION public.pay_account(
  p_account_id UUID,
  p_paid_at DATE,
  p_paid_amount NUMERIC,
  p_payment_method TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO v_account FROM public.accounts WHERE id = p_account_id;

  IF v_account.id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  IF NOT (
    has_tenant_role(v_account.tenant_id, 'admin'::app_role)
    OR has_tenant_role(v_account.tenant_id, 'manager'::app_role)
    OR has_tenant_role(v_account.tenant_id, 'financial'::app_role)
  ) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  IF v_account.status = 'paga' THEN
    RAISE EXCEPTION 'Conta já está paga';
  END IF;

  UPDATE public.accounts
  SET status = 'paga',
      paid_at = p_paid_at,
      paid_amount = p_paid_amount,
      payment_method = p_payment_method,
      updated_at = now()
  WHERE id = p_account_id;

  -- Lança em financial_entries para alimentar o fluxo de caixa
  INSERT INTO public.financial_entries (
    tenant_id, entry_date, type, description, amount, payment_method
  ) VALUES (
    v_account.tenant_id,
    p_paid_at,
    CASE WHEN v_account.type = 'receber' THEN 'income' ELSE 'expense' END,
    v_account.description,
    p_paid_amount,
    p_payment_method
  );
END;
$$;
