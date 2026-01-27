-- Sprint 2: Controle de Caixa Avançado

-- Caixas/PDVs configurados
CREATE TABLE public.cash_registers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- Índices
CREATE INDEX idx_cash_registers_tenant ON public.cash_registers(tenant_id);

-- RLS para cash_registers
ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view registers of their tenants"
ON public.cash_registers FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can manage registers"
ON public.cash_registers FOR ALL
USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Super admins can access all registers"
ON public.cash_registers FOR ALL
USING (is_super_admin());

-- Sessões de caixa (abertura/fechamento)
CREATE TABLE public.cash_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  register_id UUID NOT NULL REFERENCES public.cash_registers(id),
  user_id UUID NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12,2),
  expected_balance NUMERIC(12,2),
  difference NUMERIC(12,2),
  difference_reason TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open, closed
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_cash_sessions_tenant ON public.cash_sessions(tenant_id);
CREATE INDEX idx_cash_sessions_register ON public.cash_sessions(register_id);
CREATE INDEX idx_cash_sessions_status ON public.cash_sessions(status);
CREATE INDEX idx_cash_sessions_opened_at ON public.cash_sessions(opened_at);

-- RLS para cash_sessions
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sessions of their tenants"
ON public.cash_sessions FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert sessions in their tenants"
ON public.cash_sessions FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update their own sessions"
ON public.cash_sessions FOR UPDATE
USING (user_belongs_to_tenant(tenant_id) AND (user_id = auth.uid() OR has_tenant_role(tenant_id, 'admin')));

CREATE POLICY "Super admins can access all sessions"
ON public.cash_sessions FOR ALL
USING (is_super_admin());

-- Movimentações de caixa (sangria, suprimento, vendas)
CREATE TABLE public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.cash_sessions(id),
  movement_type TEXT NOT NULL, -- opening, sale, supply, withdrawal, closing
  payment_method TEXT,
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  sale_id UUID REFERENCES public.sales(id),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_cash_movements_tenant ON public.cash_movements(tenant_id);
CREATE INDEX idx_cash_movements_session ON public.cash_movements(session_id);
CREATE INDEX idx_cash_movements_type ON public.cash_movements(movement_type);
CREATE INDEX idx_cash_movements_created ON public.cash_movements(created_at);

-- RLS para cash_movements
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view movements of their tenants"
ON public.cash_movements FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert movements in their tenants"
ON public.cash_movements FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Super admins can access all movements"
ON public.cash_movements FOR ALL
USING (is_super_admin());

-- Adicionar session_id à tabela sales para vincular vendas a sessões
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.cash_sessions(id);
CREATE INDEX IF NOT EXISTS idx_sales_session ON public.sales(session_id);

-- Função para calcular saldo esperado de uma sessão
CREATE OR REPLACE FUNCTION public.calculate_expected_balance(p_session_id UUID)
RETURNS NUMERIC(12,2)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_opening NUMERIC(12,2);
  v_movements NUMERIC(12,2);
BEGIN
  -- Pega saldo inicial
  SELECT opening_balance INTO v_opening
  FROM public.cash_sessions
  WHERE id = p_session_id;
  
  -- Soma movimentações (positivas e negativas)
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type IN ('sale', 'supply', 'opening') THEN amount
      WHEN movement_type = 'withdrawal' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_movements
  FROM public.cash_movements
  WHERE session_id = p_session_id;
  
  RETURN COALESCE(v_opening, 0) + v_movements;
END;
$$;