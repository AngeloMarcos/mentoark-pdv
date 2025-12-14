-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'operator');

-- Tabela de tenants (empresas)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  document TEXT,
  phone TEXT,
  segment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Ligação usuário -> tenant (um usuário pode pertencer a vários tenants)
CREATE TABLE public.tenant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'operator',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);

-- Produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  internal_code TEXT,
  barcode TEXT,
  category TEXT,
  sale_price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2),
  stock_current NUMERIC(14,3) DEFAULT 0,
  unit TEXT DEFAULT 'UN',
  min_stock NUMERIC(14,3),
  active BOOLEAN DEFAULT true,
  extra_attributes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_products_tenant_name ON public.products(tenant_id, name);
CREATE INDEX idx_products_tenant_barcode ON public.products(tenant_id, barcode);

-- Clientes
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  document TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_customers_tenant_name ON public.customers(tenant_id, name);

-- Vendas
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  datetime TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID REFERENCES public.customers(id),
  gross_total NUMERIC(12,2) NOT NULL,
  discount_total NUMERIC(12,2) DEFAULT 0,
  net_total NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sales_tenant_datetime ON public.sales(tenant_id, datetime);
CREATE INDEX idx_sales_tenant_payment ON public.sales(tenant_id, payment_method);

-- Itens da venda
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL
);

CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON public.sale_items(product_id);

-- Movimentações de estoque
CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('sale', 'purchase', 'adjustment_plus', 'adjustment_minus')),
  quantity NUMERIC(14,3) NOT NULL,
  description TEXT,
  sale_id UUID REFERENCES public.sales(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_stock_movements_tenant_product ON public.stock_movements(tenant_id, product_id);

-- Lançamentos financeiros
CREATE TABLE public.financial_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT,
  sale_id UUID REFERENCES public.sales(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_financial_entries_tenant_date ON public.financial_entries(tenant_id, entry_date);

-- ========================================
-- FUNÇÕES DE SEGURANÇA (Security Definer)
-- ========================================

-- Função para obter tenants do usuário atual
CREATE OR REPLACE FUNCTION public.get_user_tenants()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
$$;

-- Função para verificar se usuário tem role específica em um tenant
CREATE OR REPLACE FUNCTION public.has_tenant_role(_tenant_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário pertence a um tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = auth.uid()
      AND tenant_id = _tenant_id
  )
$$;

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para products
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- ========================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_entries ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLÍTICAS RLS - TENANTS
-- ========================================

CREATE POLICY "Users can view their tenants"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (id IN (SELECT public.get_user_tenants()));

CREATE POLICY "Users can create tenants"
  ON public.tenants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update their tenants"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (public.has_tenant_role(id, 'admin'));

-- ========================================
-- POLÍTICAS RLS - TENANT_USERS
-- ========================================

CREATE POLICY "Users can view tenant_users of their tenants"
  ON public.tenant_users FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT public.get_user_tenants()));

CREATE POLICY "Users can create their own tenant_user link"
  ON public.tenant_users FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage tenant_users"
  ON public.tenant_users FOR ALL
  TO authenticated
  USING (public.has_tenant_role(tenant_id, 'admin'));

-- ========================================
-- POLÍTICAS RLS - PRODUCTS
-- ========================================

CREATE POLICY "Users can view products of their tenants"
  ON public.products FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert products in their tenants"
  ON public.products FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update products in their tenants"
  ON public.products FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  TO authenticated
  USING (public.has_tenant_role(tenant_id, 'admin'));

-- ========================================
-- POLÍTICAS RLS - CUSTOMERS
-- ========================================

CREATE POLICY "Users can view customers of their tenants"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert customers in their tenants"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update customers in their tenants"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete customers"
  ON public.customers FOR DELETE
  TO authenticated
  USING (public.has_tenant_role(tenant_id, 'admin'));

-- ========================================
-- POLÍTICAS RLS - SALES
-- ========================================

CREATE POLICY "Users can view sales of their tenants"
  ON public.sales FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert sales in their tenants"
  ON public.sales FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update sales in their tenants"
  ON public.sales FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

-- ========================================
-- POLÍTICAS RLS - SALE_ITEMS
-- ========================================

CREATE POLICY "Users can view sale_items through sales"
  ON public.sale_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
      AND public.user_belongs_to_tenant(s.tenant_id)
    )
  );

CREATE POLICY "Users can insert sale_items through sales"
  ON public.sale_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_id
      AND public.user_belongs_to_tenant(s.tenant_id)
    )
  );

-- ========================================
-- POLÍTICAS RLS - STOCK_MOVEMENTS
-- ========================================

CREATE POLICY "Users can view stock_movements of their tenants"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert stock_movements in their tenants"
  ON public.stock_movements FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

-- ========================================
-- POLÍTICAS RLS - FINANCIAL_ENTRIES
-- ========================================

CREATE POLICY "Users can view financial_entries of their tenants"
  ON public.financial_entries FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert financial_entries in their tenants"
  ON public.financial_entries FOR INSERT
  TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update financial_entries in their tenants"
  ON public.financial_entries FOR UPDATE
  TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete financial_entries"
  ON public.financial_entries FOR DELETE
  TO authenticated
  USING (public.has_tenant_role(tenant_id, 'admin'));