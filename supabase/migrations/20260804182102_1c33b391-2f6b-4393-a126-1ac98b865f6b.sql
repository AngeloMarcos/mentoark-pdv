-- 1. Auto-bind tenant creator as admin
DROP TRIGGER IF EXISTS trg_auto_add_tenant_creator ON public.tenants;
CREATE TRIGGER trg_auto_add_tenant_creator
AFTER INSERT ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.auto_add_tenant_creator();

-- 2. tenant_users: prevent admins from altering their own membership/role
DROP POLICY IF EXISTS "Admins can manage tenant_users" ON public.tenant_users;

CREATE POLICY "Admins can add tenant members"
ON public.tenant_users FOR INSERT TO authenticated
WITH CHECK (has_tenant_role(tenant_id, 'admin'::app_role) AND user_id <> auth.uid());

CREATE POLICY "Admins can update other tenant members"
ON public.tenant_users FOR UPDATE TO authenticated
USING (has_tenant_role(tenant_id, 'admin'::app_role) AND user_id <> auth.uid())
WITH CHECK (has_tenant_role(tenant_id, 'admin'::app_role) AND user_id <> auth.uid());

CREATE POLICY "Admins can remove other tenant members"
ON public.tenant_users FOR DELETE TO authenticated
USING (has_tenant_role(tenant_id, 'admin'::app_role) AND user_id <> auth.uid());

-- 3. employees: allow a user to view their own employee record
DROP POLICY IF EXISTS "Employees can view their own record" ON public.employees;
CREATE POLICY "Employees can view their own record"
ON public.employees FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 4. account_deletion_requests: immutable identity/timestamp fields
DROP POLICY IF EXISTS "Super admins update deletion requests" ON public.account_deletion_requests;
CREATE POLICY "Super admins update deletion requests"
ON public.account_deletion_requests FOR UPDATE TO authenticated
USING (is_super_admin())
WITH CHECK (is_super_admin());

CREATE OR REPLACE FUNCTION public.guard_account_deletion_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Campos imutáveis do pedido de exclusão não podem ser alterados'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.status NOT IN ('pending','approved','rejected','processed','cancelled') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_account_deletion_request_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_account_deletion_request_update ON public.account_deletion_requests;
CREATE TRIGGER trg_guard_account_deletion_request_update
BEFORE UPDATE ON public.account_deletion_requests
FOR EACH ROW EXECUTE FUNCTION public.guard_account_deletion_request_update();

-- 5. Revoke client EXECUTE on internal SECURITY DEFINER helper not used by the app
REVOKE ALL ON FUNCTION public.get_current_tenant_id() FROM PUBLIC, anon, authenticated;