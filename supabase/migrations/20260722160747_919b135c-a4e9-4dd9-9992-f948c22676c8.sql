
-- 1) cash_movements: admin-only UPDATE/DELETE
DROP POLICY IF EXISTS "Admins can update cash movements" ON public.cash_movements;
CREATE POLICY "Admins can update cash movements" ON public.cash_movements
  FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role))
  WITH CHECK (has_tenant_role(tenant_id, 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete cash movements" ON public.cash_movements;
CREATE POLICY "Admins can delete cash movements" ON public.cash_movements
  FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));

-- 2) employees: restrict UPDATE to admins
DROP POLICY IF EXISTS "Users can update employees in their tenants" ON public.employees;
CREATE POLICY "Admins can update employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role))
  WITH CHECK (has_tenant_role(tenant_id, 'admin'::app_role));

-- 3) Revoke EXECUTE from PUBLIC/anon on all SECURITY DEFINER functions in public
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon',
                   r.proname, r.args);
  END LOOP;
END $$;

-- 4) Revoke EXECUTE from authenticated on non-client (trigger/utility/internal) functions
REVOKE ALL ON FUNCTION public.assert_tenant_access() FROM authenticated;
REVOKE ALL ON FUNCTION public.auto_add_tenant_creator() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE ALL ON FUNCTION public.update_weighted_avg_cost(uuid, numeric, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION public.seed_default_payment_methods(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.generate_internal_barcode(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.credit_loyalty_points(uuid, uuid, uuid, numeric) FROM authenticated;
REVOKE ALL ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb, jsonb) FROM authenticated;
