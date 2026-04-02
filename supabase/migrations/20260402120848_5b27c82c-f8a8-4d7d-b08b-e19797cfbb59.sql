CREATE TRIGGER on_tenant_created
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_tenant_creator();