-- Promoções
CREATE TABLE public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
  scope TEXT NOT NULL DEFAULT 'all' CHECK (scope IN ('all','category','products')),
  category TEXT,
  product_ids UUID[],
  min_quantity NUMERIC(12,3) DEFAULT 1,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX promotions_tenant_active_idx ON public.promotions(tenant_id, active);
CREATE INDEX promotions_dates_idx ON public.promotions(tenant_id, starts_at, ends_at);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions_select_own_tenant" ON public.promotions
  FOR SELECT TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "promotions_insert_own_tenant" ON public.promotions
  FOR INSERT TO authenticated
  WITH CHECK (public.user_belongs_to_tenant(tenant_id) AND created_by = auth.uid());

CREATE POLICY "promotions_update_own_tenant" ON public.promotions
  FOR UPDATE TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

CREATE POLICY "promotions_delete_own_tenant" ON public.promotions
  FOR DELETE TO authenticated
  USING (public.user_belongs_to_tenant(tenant_id));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER promotions_set_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Função: lista promoções aplicáveis a um produto agora
CREATE OR REPLACE FUNCTION public.get_applicable_promotions(
  p_tenant_id UUID,
  p_product_id UUID
)
RETURNS SETOF public.promotions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.*
  FROM public.promotions p
  LEFT JOIN public.products pr ON pr.id = p_product_id AND pr.tenant_id = p_tenant_id
  WHERE p.tenant_id = p_tenant_id
    AND p.active = TRUE
    AND (p.starts_at IS NULL OR p.starts_at <= now())
    AND (p.ends_at   IS NULL OR p.ends_at   >= now())
    AND (
      p.scope = 'all'
      OR (p.scope = 'category' AND p.category IS NOT NULL AND pr.category = p.category)
      OR (p.scope = 'products' AND p_product_id = ANY(p.product_ids))
    )
  ORDER BY p.created_at DESC;
$$;