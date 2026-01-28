-- Tabela para armazenar movimentações de pontos de fidelidade
CREATE TABLE public.customer_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('earn', 'redeem', 'expire', 'manual')),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  description TEXT,
  expires_at DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_customer_points_customer ON customer_points(customer_id);
CREATE INDEX idx_customer_points_tenant ON customer_points(tenant_id);
CREATE INDEX idx_customer_points_expires ON customer_points(expires_at) WHERE expires_at IS NOT NULL;

-- Habilitar RLS
ALTER TABLE public.customer_points ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Super admins can access all customer_points"
  ON public.customer_points FOR ALL
  USING (is_super_admin());

CREATE POLICY "Users can view customer_points of their tenants"
  ON public.customer_points FOR SELECT
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert customer_points in their tenants"
  ON public.customer_points FOR INSERT
  WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update customer_points in their tenants"
  ON public.customer_points FOR UPDATE
  USING (user_belongs_to_tenant(tenant_id));

-- Função para calcular saldo de pontos do cliente
CREATE OR REPLACE FUNCTION public.get_customer_points(p_customer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE 
      WHEN movement_type = 'earn' THEN points
      WHEN movement_type = 'manual' AND points > 0 THEN points
      WHEN movement_type = 'redeem' THEN -points
      WHEN movement_type = 'expire' THEN -points
      WHEN movement_type = 'manual' AND points < 0 THEN points
      ELSE 0
    END
  ), 0)::INTEGER
  FROM public.customer_points
  WHERE customer_id = p_customer_id
  AND (expires_at IS NULL OR expires_at >= CURRENT_DATE);
$$;

-- Função para creditar pontos automaticamente em uma venda
CREATE OR REPLACE FUNCTION public.credit_loyalty_points(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_sale_id UUID,
  p_sale_amount NUMERIC
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_points_per_currency INTEGER;
  v_points_to_credit INTEGER;
  v_expiration_days INTEGER;
BEGIN
  -- Busca configurações do tenant
  SELECT settings INTO v_settings FROM tenants WHERE id = p_tenant_id;
  
  -- Verifica se fidelidade está habilitada
  IF NOT COALESCE((v_settings->>'loyalty_enabled')::BOOLEAN, FALSE) THEN
    RETURN 0;
  END IF;
  
  v_points_per_currency := COALESCE((v_settings->>'loyalty_points_per_currency')::INTEGER, 10);
  v_expiration_days := COALESCE((v_settings->>'loyalty_points_expiration_days')::INTEGER, 365);
  
  -- Calcula pontos: cada R$1 = X pontos
  v_points_to_credit := FLOOR(p_sale_amount * v_points_per_currency);
  
  IF v_points_to_credit > 0 THEN
    INSERT INTO customer_points (tenant_id, customer_id, points, movement_type, sale_id, description, expires_at)
    VALUES (
      p_tenant_id, 
      p_customer_id, 
      v_points_to_credit, 
      'earn', 
      p_sale_id,
      'Pontos por compra',
      CURRENT_DATE + v_expiration_days
    );
  END IF;
  
  RETURN v_points_to_credit;
END;
$$;

-- Função para resgatar pontos
CREATE OR REPLACE FUNCTION public.redeem_loyalty_points(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_points INTEGER,
  p_description TEXT DEFAULT 'Resgate de pontos'
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings JSONB;
  v_current_points INTEGER;
  v_currency_per_points INTEGER;
  v_min_redeem INTEGER;
  v_discount_value NUMERIC;
BEGIN
  -- Busca configurações do tenant
  SELECT settings INTO v_settings FROM tenants WHERE id = p_tenant_id;
  
  -- Verifica se fidelidade está habilitada
  IF NOT COALESCE((v_settings->>'loyalty_enabled')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Programa de fidelidade não está habilitado';
  END IF;
  
  -- Busca saldo atual
  v_current_points := get_customer_points(p_customer_id);
  
  IF v_current_points < p_points THEN
    RAISE EXCEPTION 'Saldo de pontos insuficiente. Disponível: %', v_current_points;
  END IF;
  
  v_currency_per_points := COALESCE((v_settings->>'loyalty_currency_per_points')::INTEGER, 100);
  v_min_redeem := COALESCE((v_settings->>'loyalty_min_redeem_points')::INTEGER, 100);
  
  IF p_points < v_min_redeem THEN
    RAISE EXCEPTION 'Mínimo para resgate: % pontos', v_min_redeem;
  END IF;
  
  -- Calcula valor do desconto
  v_discount_value := p_points::NUMERIC / v_currency_per_points;
  
  -- Registra o resgate
  INSERT INTO customer_points (tenant_id, customer_id, points, movement_type, description)
  VALUES (p_tenant_id, p_customer_id, p_points, 'redeem', p_description);
  
  RETURN v_discount_value;
END;
$$;