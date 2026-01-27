-- Sprint 4: Advanced Stock Management
-- Create product_lots table for lot/batch tracking with expiry
CREATE TABLE public.product_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  manufacture_date DATE,
  expiry_date DATE,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 0,
  cost_price NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'active',
  supplier_info TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, product_id, lot_number)
);

-- Create inventory_counts table for inventory/stock counts
CREATE TABLE public.inventory_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  completed_by UUID,
  total_products INTEGER DEFAULT 0,
  total_difference_value NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create inventory_count_items table for individual count items
CREATE TABLE public.inventory_count_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id UUID NOT NULL REFERENCES public.inventory_counts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  expected_quantity NUMERIC(12,3) NOT NULL,
  counted_quantity NUMERIC(12,3),
  difference NUMERIC(12,3),
  difference_value NUMERIC(12,2),
  adjustment_reason TEXT,
  counted_by UUID,
  counted_at TIMESTAMPTZ
);

-- Alter products table to add new columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price NUMERIC(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_min_qty NUMERIC(12,3) DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weighted_avg_cost NUMERIC(12,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS controls_lot BOOLEAN DEFAULT false;

-- Enable RLS on new tables
ALTER TABLE public.product_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_count_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_lots
CREATE POLICY "Users can view lots of their tenants" ON public.product_lots
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert lots in their tenants" ON public.product_lots
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update lots in their tenants" ON public.product_lots
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete lots" ON public.product_lots
  FOR DELETE USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Super admins can access all lots" ON public.product_lots
  FOR ALL USING (is_super_admin());

-- RLS Policies for inventory_counts
CREATE POLICY "Users can view inventory_counts of their tenants" ON public.inventory_counts
  FOR SELECT USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert inventory_counts in their tenants" ON public.inventory_counts
  FOR INSERT WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update inventory_counts in their tenants" ON public.inventory_counts
  FOR UPDATE USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete inventory_counts" ON public.inventory_counts
  FOR DELETE USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Super admins can access all inventory_counts" ON public.inventory_counts
  FOR ALL USING (is_super_admin());

-- RLS Policies for inventory_count_items (via FK to inventory_counts)
CREATE POLICY "Users can view inventory_count_items through counts" ON public.inventory_count_items
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = inventory_count_items.count_id AND user_belongs_to_tenant(ic.tenant_id)
  ));

CREATE POLICY "Users can insert inventory_count_items through counts" ON public.inventory_count_items
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = inventory_count_items.count_id AND user_belongs_to_tenant(ic.tenant_id)
  ));

CREATE POLICY "Users can update inventory_count_items through counts" ON public.inventory_count_items
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = inventory_count_items.count_id AND user_belongs_to_tenant(ic.tenant_id)
  ));

CREATE POLICY "Admins can delete inventory_count_items" ON public.inventory_count_items
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.inventory_counts ic
    WHERE ic.id = inventory_count_items.count_id AND has_tenant_role(ic.tenant_id, 'admin')
  ));

CREATE POLICY "Super admins can access all inventory_count_items" ON public.inventory_count_items
  FOR ALL USING (is_super_admin());

-- Function to update weighted average cost
CREATE OR REPLACE FUNCTION public.update_weighted_avg_cost(
  p_product_id UUID,
  p_incoming_qty NUMERIC,
  p_incoming_cost NUMERIC
) RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_current_stock NUMERIC;
  v_current_wac NUMERIC;
  v_new_wac NUMERIC;
BEGIN
  -- Get current stock and weighted average cost
  SELECT COALESCE(stock_current, 0), COALESCE(weighted_avg_cost, cost_price, 0)
  INTO v_current_stock, v_current_wac
  FROM public.products
  WHERE id = p_product_id;
  
  -- Calculate new weighted average cost
  IF (v_current_stock + p_incoming_qty) > 0 THEN
    v_new_wac := (v_current_stock * v_current_wac + p_incoming_qty * p_incoming_cost) 
                 / (v_current_stock + p_incoming_qty);
  ELSE
    v_new_wac := p_incoming_cost;
  END IF;
  
  -- Update the product
  UPDATE public.products
  SET weighted_avg_cost = ROUND(v_new_wac, 2)
  WHERE id = p_product_id;
  
  RETURN v_new_wac;
END;
$$;

-- Function to get expiring products
CREATE OR REPLACE FUNCTION public.get_expiring_products(
  p_tenant_id UUID,
  p_days_ahead INTEGER DEFAULT 30
) RETURNS TABLE(
  lot_id UUID,
  product_id UUID,
  product_name TEXT,
  lot_number TEXT,
  expiry_date DATE,
  quantity NUMERIC,
  days_until_expiry INTEGER,
  status TEXT
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT 
    pl.id as lot_id,
    pl.product_id,
    p.name as product_name,
    pl.lot_number,
    pl.expiry_date,
    pl.quantity,
    (pl.expiry_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    CASE 
      WHEN pl.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN pl.expiry_date <= CURRENT_DATE + p_days_ahead THEN 'expiring'
      ELSE 'ok'
    END as status
  FROM public.product_lots pl
  JOIN public.products p ON p.id = pl.product_id
  WHERE pl.tenant_id = p_tenant_id
    AND pl.status = 'active'
    AND pl.quantity > 0
    AND pl.expiry_date IS NOT NULL
    AND pl.expiry_date <= CURRENT_DATE + p_days_ahead
  ORDER BY pl.expiry_date ASC;
$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_lots_tenant_product ON public.product_lots(tenant_id, product_id);
CREATE INDEX IF NOT EXISTS idx_product_lots_expiry ON public.product_lots(expiry_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_inventory_counts_tenant ON public.inventory_counts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_count_items_count ON public.inventory_count_items(count_id);