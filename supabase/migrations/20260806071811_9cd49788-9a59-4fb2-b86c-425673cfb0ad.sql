-- 1) Revoke PUBLIC/anon EXECUTE on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.apply_recipe_stock(uuid, uuid, numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.seed_default_stations(uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.create_restaurant_order(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.merge_tabs(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_order_item_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_order_status(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_tab(uuid, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_restaurant_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_tabs(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_item_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_tab(uuid, uuid) TO authenticated;

-- 2) employees: remove self-select of sensitive HR columns, expose safe self profile RPC
DROP POLICY IF EXISTS "Employees can view their own record" ON public.employees;

CREATE OR REPLACE FUNCTION public.get_my_employee_profile()
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  name text,
  role text,
  department text,
  phone text,
  email text,
  active boolean,
  hire_date date,
  photo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.tenant_id, e.name, e.role, e.department, e.phone, e.email,
         e.active, e.hire_date, e.photo_url
  FROM public.employees e
  WHERE e.user_id = auth.uid()
    AND e.deleted_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.get_my_employee_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_employee_profile() TO authenticated;

-- 3) suppliers: only admins may modify supplier records (bank/PIX data)
DROP POLICY IF EXISTS "Users can update suppliers in their tenants" ON public.suppliers;
DROP POLICY IF EXISTS "Users can insert suppliers in their tenants" ON public.suppliers;

CREATE POLICY "Admins can insert suppliers"
ON public.suppliers FOR INSERT TO authenticated
WITH CHECK (has_tenant_role(tenant_id, 'admin'::app_role) OR is_super_admin());

CREATE POLICY "Admins can update suppliers"
ON public.suppliers FOR UPDATE TO authenticated
USING (has_tenant_role(tenant_id, 'admin'::app_role) OR is_super_admin())
WITH CHECK (has_tenant_role(tenant_id, 'admin'::app_role) OR is_super_admin());

-- 4) tenant_users: server-side guard on role grants
CREATE OR REPLACE FUNCTION public.guard_tenant_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- allow the automatic creator binding (no auth context / bootstrap)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = auth.uid() AND TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Você não pode alterar seu próprio papel';
  END IF;

  IF NOT public.has_tenant_role(NEW.tenant_id, 'admin'::app_role) THEN
    -- bootstrap: first member of a tenant may be created by its creator
    IF EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = NEW.tenant_id) THEN
      RAISE EXCEPTION 'Apenas administradores da empresa podem gerenciar membros';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_tenant_user_role_change_trg ON public.tenant_users;
CREATE TRIGGER guard_tenant_user_role_change_trg
BEFORE INSERT OR UPDATE ON public.tenant_users
FOR EACH ROW EXECUTE FUNCTION public.guard_tenant_user_role_change();

REVOKE ALL ON FUNCTION public.guard_tenant_user_role_change() FROM PUBLIC, anon, authenticated;