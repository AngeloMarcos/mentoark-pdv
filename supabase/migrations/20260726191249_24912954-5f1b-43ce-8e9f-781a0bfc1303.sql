
-- 1. Employees: restrict full SELECT to admins; expose limited view for tenant members
DROP POLICY IF EXISTS "Users can view employees of their tenants" ON public.employees;
CREATE POLICY "Admins can view full employees"
  ON public.employees FOR SELECT
  USING (has_tenant_role(tenant_id, 'admin'::app_role) OR is_super_admin());

CREATE OR REPLACE VIEW public.employees_basic
WITH (security_invoker = true) AS
SELECT id, tenant_id, name, role, phone, active, department, created_at
FROM public.employees
WHERE user_belongs_to_tenant(tenant_id) OR is_super_admin();

GRANT SELECT ON public.employees_basic TO authenticated;

-- Allow tenant members to SELECT limited fields via the view.
-- View uses security_invoker, so we need an additional RLS policy allowing
-- non-admin members to read rows too but only via the view. Simplest: add
-- a permissive policy that only exposes rows when accessed via view (can't
-- distinguish easily) — instead, keep view accessible by re-granting SELECT
-- through a SECURITY DEFINER wrapper.
DROP VIEW public.employees_basic;

CREATE OR REPLACE FUNCTION public.list_employees_basic(p_tenant_id uuid, p_active_only boolean DEFAULT true)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  name text,
  role text,
  phone text,
  active boolean,
  department text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.tenant_id, e.name, e.role, e.phone, e.active, e.department
  FROM public.employees e
  WHERE e.tenant_id = p_tenant_id
    AND (user_belongs_to_tenant(p_tenant_id) OR is_super_admin())
    AND (NOT p_active_only OR e.active = true)
  ORDER BY e.name;
$$;

REVOKE ALL ON FUNCTION public.list_employees_basic(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_employees_basic(uuid, boolean) TO authenticated;

-- 2. Suppliers: restrict full SELECT to admins; provide basic RPC for tenant members
DROP POLICY IF EXISTS "Users can view suppliers of their tenants" ON public.suppliers;
CREATE POLICY "Admins can view full suppliers"
  ON public.suppliers FOR SELECT
  USING (has_tenant_role(tenant_id, 'admin'::app_role) OR is_super_admin());

CREATE OR REPLACE FUNCTION public.list_suppliers_basic(p_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  name text,
  fantasy_name text,
  document text,
  phone text,
  email text,
  city text,
  state text,
  category text,
  payment_terms text,
  due_days integer,
  active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.tenant_id, s.name, s.fantasy_name, s.document,
         s.phone, s.email, s.city, s.state, s.category, s.payment_terms,
         s.due_days, s.active
  FROM public.suppliers s
  WHERE s.tenant_id = p_tenant_id
    AND (user_belongs_to_tenant(p_tenant_id) OR is_super_admin());
$$;

REVOKE ALL ON FUNCTION public.list_suppliers_basic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_suppliers_basic(uuid) TO authenticated;

-- 3. customer_points: allow admins to delete corrections
CREATE POLICY "Admins can delete customer_points"
  ON public.customer_points FOR DELETE
  USING (has_tenant_role(tenant_id, 'admin'::app_role) OR is_super_admin());

-- 4. account_deletion_requests: super admin delete
CREATE POLICY "Super admins can delete deletion requests"
  ON public.account_deletion_requests FOR DELETE
  USING (is_super_admin());

-- 5. tenants: allow tenant admins to delete their own tenant
CREATE POLICY "Admins can delete their tenants"
  ON public.tenants FOR DELETE
  USING (has_tenant_role(id, 'admin'::app_role) OR is_super_admin());

-- 6. Revoke EXECUTE from authenticated on purely-internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.validate_ean(text) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_internal_barcode(uuid) FROM authenticated, anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb, jsonb) FROM authenticated, anon, PUBLIC;
