
-- Create super_admin role enum if needed
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_role') THEN
    CREATE TYPE public.system_role AS ENUM ('super_admin', 'user');
  END IF;
END $$;

-- Create system_users table for global permissions (super admins)
CREATE TABLE IF NOT EXISTS public.system_users (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role system_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;

-- Super admins can see all system users
CREATE POLICY "Super admins can view all system_users"
ON public.system_users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.user_id = auth.uid() AND su.role = 'super_admin'
  )
  OR user_id = auth.uid()
);

-- Super admins can manage system users
CREATE POLICY "Super admins can manage system_users"
ON public.system_users
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.system_users su 
    WHERE su.user_id = auth.uid() AND su.role = 'super_admin'
  )
);

-- Function to check if user is super admin (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.system_users
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- Update existing RLS policies to allow super admins access to everything

-- Tenants: Super admins can view all tenants
CREATE POLICY "Super admins can view all tenants"
ON public.tenants
FOR SELECT
USING (is_super_admin());

-- Tenants: Super admins can manage all tenants
CREATE POLICY "Super admins can manage all tenants"
ON public.tenants
FOR ALL
USING (is_super_admin());

-- Tenant_users: Super admins can view all tenant_users
CREATE POLICY "Super admins can view all tenant_users"
ON public.tenant_users
FOR SELECT
USING (is_super_admin());

-- Tenant_users: Super admins can manage all tenant_users
CREATE POLICY "Super admins can manage all tenant_users"
ON public.tenant_users
FOR ALL
USING (is_super_admin());

-- Products: Super admins can access all
CREATE POLICY "Super admins can access all products"
ON public.products
FOR ALL
USING (is_super_admin());

-- Sales: Super admins can access all
CREATE POLICY "Super admins can access all sales"
ON public.sales
FOR ALL
USING (is_super_admin());

-- Sale_items: Super admins can access all
CREATE POLICY "Super admins can access all sale_items"
ON public.sale_items
FOR ALL
USING (is_super_admin());

-- Customers: Super admins can access all
CREATE POLICY "Super admins can access all customers"
ON public.customers
FOR ALL
USING (is_super_admin());

-- Financial_entries: Super admins can access all
CREATE POLICY "Super admins can access all financial_entries"
ON public.financial_entries
FOR ALL
USING (is_super_admin());

-- Stock_movements: Super admins can access all
CREATE POLICY "Super admins can access all stock_movements"
ON public.stock_movements
FOR ALL
USING (is_super_admin());

-- Tables: Super admins can access all
CREATE POLICY "Super admins can access all tables"
ON public.tables
FOR ALL
USING (is_super_admin());

-- Tabs: Super admins can access all
CREATE POLICY "Super admins can access all tabs"
ON public.tabs
FOR ALL
USING (is_super_admin());

-- Tab_items: Super admins can access all
CREATE POLICY "Super admins can access all tab_items"
ON public.tab_items
FOR ALL
USING (is_super_admin());

-- Insert the super admin user
INSERT INTO public.system_users (user_id, role)
VALUES ('996525c1-7951-4b2d-a7cd-1f835ce5445a', 'super_admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'super_admin';
