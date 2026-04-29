-- 2) Expand employees table with HR fields
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS cpf TEXT,
  ADD COLUMN IF NOT EXISTS rg TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS termination_date DATE,
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_employees_user_id ON public.employees(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_tenant_active ON public.employees(tenant_id, active);

-- 3) Track last seen for users
CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own activity" ON public.user_activity;
CREATE POLICY "Users can view their own activity"
  ON public.user_activity FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.user_id = user_activity.user_id
      AND tu.tenant_id IN (SELECT get_user_tenants())
  ));

DROP POLICY IF EXISTS "Users can upsert their own activity" ON public.user_activity;
CREATE POLICY "Users can upsert their own activity"
  ON public.user_activity FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own activity" ON public.user_activity;
CREATE POLICY "Users can update their own activity"
  ON public.user_activity FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- 4) RPC to get tenant members with auth info (admins only)
CREATE OR REPLACE FUNCTION public.get_tenant_members(p_tenant_id UUID)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  role app_role,
  created_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_tenant_role(p_tenant_id, 'admin') AND NOT is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  RETURN QUERY
  SELECT
    tu.user_id,
    au.email::TEXT,
    tu.role,
    tu.created_at,
    ua.last_seen
  FROM public.tenant_users tu
  LEFT JOIN auth.users au ON au.id = tu.user_id
  LEFT JOIN public.user_activity ua ON ua.user_id = tu.user_id
  WHERE tu.tenant_id = p_tenant_id
  ORDER BY tu.created_at;
END;
$$;

-- 5) Trigger to keep employees.updated_at fresh
DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();