REVOKE EXECUTE ON FUNCTION public.super_create_tenant_with_admin(text,text,text,text,text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.super_get_metrics() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.super_list_tenants() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.export_my_data() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assert_tenant_access() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_current_tenant_id() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.super_create_tenant_with_admin(text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_get_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.super_list_tenants() TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_tenant_id() TO authenticated;