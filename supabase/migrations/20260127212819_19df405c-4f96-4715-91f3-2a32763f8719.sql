-- Fix tenant_users authorization bypass vulnerability
-- This migration removes the insecure self-assignment policy and implements
-- a secure trigger-based approach for tenant creation

-- 1. Drop the insecure INSERT policy that allows self-assignment to any tenant
DROP POLICY IF EXISTS "Users can create their own tenant_user link" ON public.tenant_users;

-- 2. Create a SECURITY DEFINER function to automatically add tenant creator as admin
-- This function runs with elevated privileges and is called by the trigger
CREATE OR REPLACE FUNCTION public.auto_add_tenant_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically add the authenticated user who created the tenant as an admin
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (NEW.id, auth.uid(), 'admin');
  RETURN NEW;
END;
$$;

-- 3. Create trigger to execute the function after tenant creation
DROP TRIGGER IF EXISTS tenant_creator_trigger ON public.tenants;
CREATE TRIGGER tenant_creator_trigger
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_tenant_creator();

-- 4. Note: The existing policies remain in place:
-- - "Admins can manage tenant_users" - allows admins to add/remove users from their tenant
-- - "Super admins can manage all tenant_users" - allows super admins full control
-- These policies are secure as they require existing admin/super_admin privileges