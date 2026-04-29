-- =============================================
-- SPRINT 10: Blindagem multitenant + LGPD
-- =============================================

-- 1) Função utilitária: validar tenant_id no INSERT
CREATE OR REPLACE FUNCTION public.assert_tenant_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permite super_admin operar em qualquer tenant
  IF public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'tenant_id é obrigatório';
  END IF;

  IF NOT public.user_belongs_to_tenant(NEW.tenant_id) THEN
    RAISE EXCEPTION 'Acesso negado: usuário não pertence ao tenant %', NEW.tenant_id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 2) Aplicar trigger em todas as tabelas com tenant_id
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts','audit_logs','cash_movements','cash_registers','cash_sessions',
    'customer_credits','customer_points','customers','employees',
    'financial_categories','financial_entries','fiscal_documents',
    'inventory_counts','payment_methods','printer_configs','product_barcodes',
    'product_lots','products','promotions','purchase_orders','sale_returns',
    'sales','stock_movements','suppliers','tables','tabs','tenant_invitations'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_assert_tenant ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_assert_tenant BEFORE INSERT OR UPDATE OF tenant_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.assert_tenant_access()',
      t
    );
  END LOOP;
END $$;

-- 3) RPCs de estoque: aceitar tenant_id explícito (defesa em profundidade)
CREATE OR REPLACE FUNCTION public.increment_stock(p_product_id uuid, p_quantity numeric, p_tenant_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.products WHERE id = p_product_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF p_tenant_id IS NOT NULL AND p_tenant_id <> v_tenant THEN
    RAISE EXCEPTION 'Tenant divergente';
  END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.products
    SET stock_current = COALESCE(stock_current,0) + p_quantity, updated_at = now()
    WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_quantity numeric, p_tenant_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.products WHERE id = p_product_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;
  IF p_tenant_id IS NOT NULL AND p_tenant_id <> v_tenant THEN
    RAISE EXCEPTION 'Tenant divergente';
  END IF;
  IF NOT public.user_belongs_to_tenant(v_tenant) AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;
  UPDATE public.products
    SET stock_current = COALESCE(stock_current,0) - p_quantity, updated_at = now()
    WHERE id = p_product_id;
END;
$$;

-- 4) get_current_tenant_id: lê do JWT claim ou do tenant ativo (heurística: primeiro tenant)
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.tenant_id', true), '')::uuid;
$$;

-- =============================================
-- 5) LGPD: consentimentos
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL,           -- 'terms', 'privacy', 'marketing', 'cookies'
  version text NOT NULL,                 -- ex: '2026-04-29-v1'
  accepted boolean NOT NULL DEFAULT true,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user ON public.user_consents(user_id, consent_type);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own consents" ON public.user_consents
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Users insert own consents" ON public.user_consents
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 6) LGPD: solicitações de exclusão de conta
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending | processed | cancelled
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own deletion request" ON public.account_deletion_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_super_admin());

CREATE POLICY "Users insert own deletion request" ON public.account_deletion_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Super admins update deletion requests" ON public.account_deletion_requests
  FOR UPDATE USING (public.is_super_admin());

-- 7) LGPD: export dos dados do usuário (JSON)
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT jsonb_build_object(
    'user_id', v_user_id,
    'exported_at', now(),
    'tenants', (SELECT jsonb_agg(row_to_json(t)) FROM public.tenant_users tu JOIN public.tenants t ON t.id = tu.tenant_id WHERE tu.user_id = v_user_id),
    'consents', (SELECT jsonb_agg(row_to_json(c)) FROM public.user_consents c WHERE c.user_id = v_user_id),
    'sales_created', (SELECT jsonb_agg(row_to_json(s)) FROM public.sales s WHERE s.user_id = v_user_id),
    'cash_sessions', (SELECT jsonb_agg(row_to_json(cs)) FROM public.cash_sessions cs WHERE cs.user_id = v_user_id),
    'audit_logs', (SELECT jsonb_agg(row_to_json(a)) FROM public.audit_logs a WHERE a.user_id = v_user_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 8) Super admin: criar tenant + convidar admin em uma operação
CREATE OR REPLACE FUNCTION public.super_create_tenant_with_admin(
  p_name text,
  p_document text,
  p_phone text,
  p_segment text,
  p_admin_email text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_token text;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super admins podem executar esta ação';
  END IF;

  INSERT INTO public.tenants (name, document, phone, segment)
  VALUES (p_name, p_document, p_phone, p_segment)
  RETURNING id INTO v_tenant_id;

  v_token := encode(gen_random_bytes(24), 'hex');

  INSERT INTO public.tenant_invitations (tenant_id, email, role, token, expires_at, created_by)
  VALUES (v_tenant_id, lower(p_admin_email), 'admin', v_token, now() + interval '7 days', auth.uid());

  -- Seed de payment methods padrão
  PERFORM public.seed_default_payment_methods(v_tenant_id);

  RETURN jsonb_build_object('tenant_id', v_tenant_id, 'invitation_token', v_token);
END;
$$;

-- 9) Super admin: métricas globais
CREATE OR REPLACE FUNCTION public.super_get_metrics()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super admins';
  END IF;

  RETURN jsonb_build_object(
    'total_tenants', (SELECT count(*) FROM public.tenants),
    'total_users', (SELECT count(DISTINCT user_id) FROM public.tenant_users),
    'total_sales', (SELECT count(*) FROM public.sales),
    'sales_last_30d', (SELECT count(*) FROM public.sales WHERE created_at > now() - interval '30 days'),
    'revenue_last_30d', (SELECT COALESCE(SUM(net_total),0) FROM public.sales WHERE created_at > now() - interval '30 days'),
    'tenants_active_30d', (SELECT count(DISTINCT tenant_id) FROM public.sales WHERE created_at > now() - interval '30 days')
  );
END;
$$;

-- 10) Super admin: listar tenants com stats
CREATE OR REPLACE FUNCTION public.super_list_tenants()
RETURNS TABLE(
  id uuid, name text, document text, segment text, phone text,
  created_at timestamptz, user_count bigint, sales_count bigint, revenue_30d numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Apenas super admins';
  END IF;

  RETURN QUERY
  SELECT
    t.id, t.name, t.document, t.segment, t.phone, t.created_at,
    (SELECT count(*) FROM public.tenant_users tu WHERE tu.tenant_id = t.id),
    (SELECT count(*) FROM public.sales s WHERE s.tenant_id = t.id),
    (SELECT COALESCE(SUM(net_total),0) FROM public.sales s WHERE s.tenant_id = t.id AND s.created_at > now() - interval '30 days')
  FROM public.tenants t
  ORDER BY t.created_at DESC;
END;
$$;