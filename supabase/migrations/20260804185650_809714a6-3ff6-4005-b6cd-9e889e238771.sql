DROP POLICY IF EXISTS "Users can insert audit_logs in their tenants" ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;

DROP POLICY IF EXISTS "Users can insert employees in their tenants" ON public.employees;
CREATE POLICY "Admins can insert employees"
ON public.employees FOR INSERT TO authenticated
WITH CHECK (has_tenant_role(tenant_id, 'admin'::app_role));