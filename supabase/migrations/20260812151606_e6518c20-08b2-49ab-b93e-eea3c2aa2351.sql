-- 1) tenants: remove permissive direct insert; creation only via security-definer RPCs
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON public.tenants;

-- 2) cash_sessions: explicit deny of deletion for regular tenant users (super admins keep ALL policy)
DROP POLICY IF EXISTS "Tenant users cannot delete cash sessions" ON public.cash_sessions;
CREATE POLICY "Tenant users cannot delete cash sessions"
ON public.cash_sessions
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (is_super_admin());

-- 3) system_users: defense-in-depth trigger guard against privilege escalation
CREATE OR REPLACE FUNCTION public.guard_system_users_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    -- allow the very first super admin bootstrap only when table is empty
    IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM public.system_users) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Only super admins can modify system_users';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_system_users_write ON public.system_users;
CREATE TRIGGER trg_guard_system_users_write
BEFORE INSERT OR UPDATE OR DELETE ON public.system_users
FOR EACH ROW EXECUTE FUNCTION public.guard_system_users_write();