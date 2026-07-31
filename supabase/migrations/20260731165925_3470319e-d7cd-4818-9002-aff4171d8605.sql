
-- 1. Revoke EXECUTE from anon on all SECURITY DEFINER functions in public
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, PUBLIC', r.sig);
  END LOOP;
END $$;

-- 2. Revoke EXECUTE from authenticated on internal-only helpers/triggers
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN (
        'assert_tenant_access','auto_add_tenant_creator','mirror_cash_movement_to_financial',
        'trg_audit_row','set_updated_at','update_updated_at_column',
        'get_current_tenant_id','user_belongs_to_tenant','has_tenant_role','is_super_admin',
        'consume_lots_fefo','decrement_stock','increment_stock','credit_loyalty_points',
        'log_audit_event','seed_default_payment_methods','update_weighted_avg_cost'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated, PUBLIC', r.sig);
  END LOOP;
END $$;

-- 3. cash_sessions policies: restrict to authenticated role
DROP POLICY IF EXISTS "Users can view sessions of their tenants" ON public.cash_sessions;
DROP POLICY IF EXISTS "Users can insert sessions in their tenants" ON public.cash_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.cash_sessions;
DROP POLICY IF EXISTS "Super admins can access all sessions" ON public.cash_sessions;

CREATE POLICY "Users can view sessions of their tenants"
  ON public.cash_sessions FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert sessions in their tenants"
  ON public.cash_sessions FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can update their own sessions"
  ON public.cash_sessions FOR UPDATE TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id)
         AND (user_id = auth.uid() OR public.has_tenant_role(tenant_id, 'admin'::app_role)))
  WITH CHECK (public.user_belongs_to_tenant(tenant_id)
         AND (user_id = auth.uid() OR public.has_tenant_role(tenant_id, 'admin'::app_role)));

CREATE POLICY "Super admins can access all sessions"
  ON public.cash_sessions FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- 4. Storage: tenant-scoped product images (path = <tenant_id>/<product_id>/<file>)
DROP POLICY IF EXISTS product_images_read ON storage.objects;
DROP POLICY IF EXISTS product_images_write ON storage.objects;
DROP POLICY IF EXISTS product_images_update ON storage.objects;
DROP POLICY IF EXISTS product_images_delete ON storage.objects;

CREATE POLICY product_images_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images'
         AND public.user_belongs_to_tenant(NULLIF((storage.foldername(name))[1], '')::uuid));

CREATE POLICY product_images_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images'
         AND public.user_belongs_to_tenant(NULLIF((storage.foldername(name))[1], '')::uuid));

CREATE POLICY product_images_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images'
         AND public.user_belongs_to_tenant(NULLIF((storage.foldername(name))[1], '')::uuid))
  WITH CHECK (bucket_id = 'product-images'
         AND public.user_belongs_to_tenant(NULLIF((storage.foldername(name))[1], '')::uuid));

CREATE POLICY product_images_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images'
         AND public.user_belongs_to_tenant(NULLIF((storage.foldername(name))[1], '')::uuid));
