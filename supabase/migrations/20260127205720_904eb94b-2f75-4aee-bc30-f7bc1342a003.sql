-- Payment methods table (configurable by tenant)
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('money', 'card_credit', 'card_debit', 'pix', 'voucher', 'credit', 'check')),
  requires_change BOOLEAN DEFAULT false,
  allows_installments BOOLEAN DEFAULT false,
  max_installments INTEGER DEFAULT 1,
  fee_percentage NUMERIC(5,2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Sale payments table (supports mixed payments)
CREATE TABLE public.sale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method_id UUID REFERENCES public.payment_methods(id),
  payment_method_code TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  change_amount NUMERIC(12,2) DEFAULT 0,
  installments INTEGER DEFAULT 1,
  authorization_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer credits table (store credit / vouchers)
CREATE TABLE public.customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  used_amount NUMERIC(12,2) DEFAULT 0,
  origin_type TEXT NOT NULL CHECK (origin_type IN ('return', 'promotion', 'purchase', 'manual')),
  origin_id UUID,
  description TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_methods
CREATE POLICY "Super admins can access all payment_methods"
ON public.payment_methods FOR ALL
USING (is_super_admin());

CREATE POLICY "Users can view payment_methods of their tenants"
ON public.payment_methods FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage payment_methods"
ON public.payment_methods FOR ALL
USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Users can insert payment_methods in their tenants"
ON public.payment_methods FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

-- RLS Policies for sale_payments
CREATE POLICY "Super admins can access all sale_payments"
ON public.sale_payments FOR ALL
USING (is_super_admin());

CREATE POLICY "Users can view sale_payments through sales"
ON public.sale_payments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = sale_payments.sale_id
  AND user_belongs_to_tenant(s.tenant_id)
));

CREATE POLICY "Users can insert sale_payments through sales"
ON public.sale_payments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales s
  WHERE s.id = sale_payments.sale_id
  AND user_belongs_to_tenant(s.tenant_id)
));

-- RLS Policies for customer_credits
CREATE POLICY "Super admins can access all customer_credits"
ON public.customer_credits FOR ALL
USING (is_super_admin());

CREATE POLICY "Users can view customer_credits of their tenants"
ON public.customer_credits FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert customer_credits in their tenants"
ON public.customer_credits FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update customer_credits in their tenants"
ON public.customer_credits FOR UPDATE
USING (user_belongs_to_tenant(tenant_id));

-- Create indexes for performance
CREATE INDEX idx_payment_methods_tenant ON public.payment_methods(tenant_id);
CREATE INDEX idx_payment_methods_active ON public.payment_methods(tenant_id, active);
CREATE INDEX idx_sale_payments_sale ON public.sale_payments(sale_id);
CREATE INDEX idx_customer_credits_customer ON public.customer_credits(customer_id);
CREATE INDEX idx_customer_credits_tenant ON public.customer_credits(tenant_id);

-- Function to seed default payment methods for a tenant
CREATE OR REPLACE FUNCTION public.seed_default_payment_methods(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only seed if tenant has no payment methods
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

-- Function to get available customer credit
CREATE OR REPLACE FUNCTION public.get_available_credit(p_customer_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount - used_amount), 0)
  FROM public.customer_credits
  WHERE customer_id = p_customer_id
  AND (expires_at IS NULL OR expires_at >= CURRENT_DATE)
  AND (amount - used_amount) > 0;
$$;