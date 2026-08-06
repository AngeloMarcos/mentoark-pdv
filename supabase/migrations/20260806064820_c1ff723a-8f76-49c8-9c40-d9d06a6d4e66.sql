DROP POLICY IF EXISTS "Super admins can manage system_users" ON public.system_users;
DROP POLICY IF EXISTS "Super admins can view all system_users" ON public.system_users;

CREATE POLICY "Users can view own system_user row"
ON public.system_users FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Super admins can view all system_users"
ON public.system_users FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can insert system_users"
ON public.system_users FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update system_users"
ON public.system_users FOR UPDATE TO authenticated
USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can delete system_users"
ON public.system_users FOR DELETE TO authenticated
USING (public.is_super_admin() AND user_id <> auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_users TO authenticated;
GRANT ALL ON public.system_users TO service_role;