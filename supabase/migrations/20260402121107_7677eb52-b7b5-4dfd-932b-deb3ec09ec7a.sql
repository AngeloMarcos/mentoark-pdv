
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text DEFAULT 'atendente',
  phone text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employees of their tenants"
  ON public.employees FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert employees in their tenants"
  ON public.employees FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update employees in their tenants"
  ON public.employees FOR UPDATE TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can delete employees"
  ON public.employees FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Super admins can access all employees"
  ON public.employees FOR ALL TO public
  USING (is_super_admin());
