-- Create RPC function for atomic tenant creation
CREATE OR REPLACE FUNCTION public.create_tenant_for_user(
  p_name TEXT,
  p_document TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_segment TEXT DEFAULT NULL
)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant public.tenants;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.tenants (name, document, phone, segment)
  VALUES (p_name, p_document, p_phone, p_segment)
  RETURNING * INTO v_tenant;

  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (v_tenant.id, v_user_id, 'admin');

  RETURN v_tenant;
END;
$$;

-- Remove trigger no longer needed
DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;