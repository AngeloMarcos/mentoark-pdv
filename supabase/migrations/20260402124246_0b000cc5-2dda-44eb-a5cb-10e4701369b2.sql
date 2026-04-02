-- Remove duplicate trigger
DROP TRIGGER IF EXISTS tenant_creator_trigger ON public.tenants;

-- Remove duplicate unique constraint
ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_tenant_user_unique;

-- Make the remaining trigger's function use ON CONFLICT to be safe
CREATE OR REPLACE FUNCTION public.auto_add_tenant_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'admin')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;