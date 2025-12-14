-- Create tables (mesas)
CREATE TABLE public.tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  number TEXT NOT NULL,
  name TEXT,
  capacity INTEGER,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_tables_tenant ON public.tables(tenant_id, number);

-- Enable RLS for tables
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tables of their tenants"
ON public.tables FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert tables in their tenants"
ON public.tables FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update tables in their tenants"
ON public.tables FOR UPDATE
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete tables"
ON public.tables FOR DELETE
USING (has_tenant_role(tenant_id, 'admin'));

-- Create tabs (comandas)
CREATE TABLE public.tabs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
  customer_name TEXT,
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  user_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_tabs_tenant_status ON public.tabs(tenant_id, status);
CREATE INDEX idx_tabs_table ON public.tabs(table_id);

-- Enable RLS for tabs
ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tabs of their tenants"
ON public.tabs FOR SELECT
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert tabs in their tenants"
ON public.tabs FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update tabs in their tenants"
ON public.tabs FOR UPDATE
USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete tabs"
ON public.tabs FOR DELETE
USING (has_tenant_role(tenant_id, 'admin'));

-- Create tab_items (itens da comanda)
CREATE TABLE public.tab_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID NOT NULL REFERENCES public.tabs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC(14,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  discount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  added_by UUID,
  notes TEXT
);

CREATE INDEX idx_tab_items_tab ON public.tab_items(tab_id);

-- Enable RLS for tab_items
ALTER TABLE public.tab_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tab_items through tabs"
ON public.tab_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.tabs t
  WHERE t.id = tab_items.tab_id AND user_belongs_to_tenant(t.tenant_id)
));

CREATE POLICY "Users can insert tab_items through tabs"
ON public.tab_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tabs t
  WHERE t.id = tab_items.tab_id AND user_belongs_to_tenant(t.tenant_id)
));

CREATE POLICY "Users can update tab_items through tabs"
ON public.tab_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.tabs t
  WHERE t.id = tab_items.tab_id AND user_belongs_to_tenant(t.tenant_id)
));

CREATE POLICY "Users can delete tab_items through tabs"
ON public.tab_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.tabs t
  WHERE t.id = tab_items.tab_id AND user_belongs_to_tenant(t.tenant_id)
));