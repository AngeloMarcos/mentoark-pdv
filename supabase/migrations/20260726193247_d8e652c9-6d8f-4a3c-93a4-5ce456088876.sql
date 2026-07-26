
DROP VIEW IF EXISTS public.products_active;
DROP VIEW IF EXISTS public.customers_active;

CREATE VIEW public.products_active WITH (security_invoker = true) AS
  SELECT * FROM public.products WHERE deleted_at IS NULL;
CREATE VIEW public.customers_active WITH (security_invoker = true) AS
  SELECT * FROM public.customers WHERE deleted_at IS NULL;
GRANT SELECT ON public.products_active TO authenticated;
GRANT SELECT ON public.customers_active TO authenticated;

REVOKE ALL ON FUNCTION public.trg_audit_row() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trg_audit_row() TO service_role;
