-- ============ ENUM ============
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'waiter';

-- ============ PRODUCTION STATIONS ============
CREATE TABLE public.production_stations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_stations TO authenticated;
GRANT ALL ON public.production_stations TO service_role;
ALTER TABLE public.production_stations ENABLE ROW LEVEL SECURITY;

-- ============ MENUS ============
CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  available_from time,
  available_to time,
  days_of_week integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menus TO authenticated;
GRANT ALL ON public.menus TO service_role;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_sections TO authenticated;
GRANT ALL ON public.menu_sections TO service_role;
ALTER TABLE public.menu_sections ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.menu_sections(id) ON DELETE CASCADE,
  station_id uuid REFERENCES public.production_stations(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  prep_minutes integer NOT NULL DEFAULT 15,
  available boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  serves_people integer,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items TO authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_select integer NOT NULL DEFAULT 0,
  max_select integer NOT NULL DEFAULT 1,
  required boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_options TO authenticated;
GRANT ALL ON public.menu_item_options TO service_role;
ALTER TABLE public.menu_item_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_item_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.menu_item_options(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_delta numeric(12,2) NOT NULL DEFAULT 0,
  available boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_option_values TO authenticated;
GRANT ALL ON public.menu_item_option_values TO service_role;
ALTER TABLE public.menu_item_option_values ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.menu_item_recipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric(12,4) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_recipe TO authenticated;
GRANT ALL ON public.menu_item_recipe TO service_role;
ALTER TABLE public.menu_item_recipe ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number integer NOT NULL,
  order_type text NOT NULL DEFAULT 'mesa',
  status text NOT NULL DEFAULT 'received',
  tab_id uuid REFERENCES public.tabs(id) ON DELETE SET NULL,
  table_id uuid REFERENCES public.tables(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  waiter_id uuid,
  created_by uuid,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  service_fee numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  station_id uuid REFERENCES public.production_stations(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  options_total numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.order_item_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  option_name text NOT NULL,
  value_name text NOT NULL,
  price_delta numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_item_options TO authenticated;
GRANT ALL ON public.order_item_options TO service_role;
ALTER TABLE public.order_item_options ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.delivery_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_name text,
  phone text,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  reference_point text,
  courier_name text,
  estimated_minutes integer,
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_info TO authenticated;
GRANT ALL ON public.delivery_info TO service_role;
ALTER TABLE public.delivery_info ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES + TRIGGERS ============
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'production_stations','menus','menu_sections','menu_items','menu_item_options',
    'menu_item_option_values','menu_item_recipe','orders','order_items',
    'order_item_options','delivery_info'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I FOR SELECT TO authenticated
      USING (public.user_belongs_to_tenant(tenant_id) OR public.is_super_admin());
    $f$, t || '_select', t);
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I FOR INSERT TO authenticated
      WITH CHECK (public.user_belongs_to_tenant(tenant_id));
    $f$, t || '_insert', t);
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I FOR UPDATE TO authenticated
      USING (public.user_belongs_to_tenant(tenant_id))
      WITH CHECK (public.user_belongs_to_tenant(tenant_id));
    $f$, t || '_update', t);
    EXECUTE format($f$
      CREATE POLICY %1$I ON public.%2$I FOR DELETE TO authenticated
      USING (public.has_tenant_role(tenant_id, 'admin') OR public.has_tenant_role(tenant_id, 'manager'));
    $f$, t || '_delete', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access();',
      'trg_' || t || '_tenant', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'production_stations','menus','menu_sections','menu_items','orders','order_items','delivery_info'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      'trg_' || t || '_updated', t);
  END LOOP;
END $$;

CREATE INDEX idx_orders_tenant_status ON public.orders(tenant_id, status);
CREATE INDEX idx_orders_tab ON public.orders(tab_id);
CREATE INDEX idx_order_items_order ON public.order_items(order_id);
CREATE INDEX idx_menu_items_section ON public.menu_items(section_id);

-- ============ TABS / TABLES EXTENSIONS ============
ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS people_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS service_fee_pct numeric(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS couvert_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS merged_into_tab_id uuid REFERENCES public.tabs(id) ON DELETE SET NULL;

-- ============ REALTIME ============
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.order_items REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;