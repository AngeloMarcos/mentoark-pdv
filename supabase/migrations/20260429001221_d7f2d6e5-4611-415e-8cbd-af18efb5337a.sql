-- ============================================
-- FINANCIAL CATEGORIES
-- ============================================
CREATE TABLE public.financial_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_financial_categories_tenant ON public.financial_categories(tenant_id);

ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view financial_categories of their tenants"
  ON public.financial_categories FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert financial_categories in their tenants"
  ON public.financial_categories FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update financial_categories in their tenants"
  ON public.financial_categories FOR UPDATE TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete financial_categories"
  ON public.financial_categories FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));

CREATE POLICY "Super admins can access all financial_categories"
  ON public.financial_categories FOR ALL
  USING (is_super_admin());

CREATE TRIGGER trg_financial_categories_updated
  BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ACCOUNTS (payable / receivable)
-- ============================================
CREATE TABLE public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pagar', 'receber')),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','paga','vencida','cancelada')),
  category_id UUID REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  party_name TEXT,
  customer_id UUID,
  notes TEXT,
  paid_at DATE,
  paid_amount NUMERIC(12,2),
  payment_method TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_tenant ON public.accounts(tenant_id);
CREATE INDEX idx_accounts_type ON public.accounts(tenant_id, type);
CREATE INDEX idx_accounts_status ON public.accounts(tenant_id, status);
CREATE INDEX idx_accounts_due ON public.accounts(tenant_id, due_date);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accounts of their tenants"
  ON public.accounts FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert accounts in their tenants"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(tenant_id) AND created_by = auth.uid());

CREATE POLICY "Users can update accounts in their tenants"
  ON public.accounts FOR UPDATE TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete accounts"
  ON public.accounts FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));

CREATE POLICY "Super admins can access all accounts"
  ON public.accounts FOR ALL
  USING (is_super_admin());

CREATE TRIGGER trg_accounts_updated
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RPC: mark account as paid (atomic, also creates financial_entry)
-- ============================================
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

  IF NOT user_belongs_to_tenant(v_account.tenant_id) THEN
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

-- ============================================
-- RPC: get_financial_dashboard summary
-- ============================================
CREATE OR REPLACE FUNCTION public.get_financial_dashboard(
  p_tenant_id UUID,
  p_start DATE,
  p_end DATE
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_income NUMERIC := 0;
  v_expense NUMERIC := 0;
  v_to_receive NUMERIC := 0;
  v_to_pay NUMERIC := 0;
BEGIN
  IF NOT user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_income
  FROM public.financial_entries
  WHERE tenant_id = p_tenant_id AND type = 'income'
    AND entry_date BETWEEN p_start AND p_end;

  SELECT COALESCE(SUM(amount), 0) INTO v_expense
  FROM public.financial_entries
  WHERE tenant_id = p_tenant_id AND type = 'expense'
    AND entry_date BETWEEN p_start AND p_end;

  SELECT COALESCE(SUM(amount), 0) INTO v_to_receive
  FROM public.accounts
  WHERE tenant_id = p_tenant_id AND type = 'receber'
    AND status IN ('aberta','vencida');

  SELECT COALESCE(SUM(amount), 0) INTO v_to_pay
  FROM public.accounts
  WHERE tenant_id = p_tenant_id AND type = 'pagar'
    AND status IN ('aberta','vencida');

  RETURN jsonb_build_object(
    'income', v_income,
    'expense', v_expense,
    'balance', v_income - v_expense,
    'to_receive', v_to_receive,
    'to_pay', v_to_pay
  );
END;
$$;

-- ============================================
-- Seed default categories for existing tenants
-- ============================================
INSERT INTO public.financial_categories (tenant_id, name, type, color)
SELECT t.id, c.name, c.type, c.color
FROM public.tenants t
CROSS JOIN (VALUES
  ('Vendas',       'receita', '#10B981'),
  ('Serviços',     'receita', '#06B6D4'),
  ('Outros',       'receita', '#8B5CF6'),
  ('Aluguel',      'despesa', '#EF4444'),
  ('Fornecedores', 'despesa', '#F59E0B'),
  ('Salários',     'despesa', '#EC4899'),
  ('Impostos',     'despesa', '#6366F1'),
  ('Manutenção',   'despesa', '#84CC16')
) AS c(name, type, color)
ON CONFLICT DO NOTHING;