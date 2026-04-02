

## Fix: Tenant creation 403 RLS error

### Root Cause
The `tenants` INSERT works, but PostgREST's `Prefer: return=representation` (from `.select()`) applies SELECT RLS policies to return the row. The SELECT policy uses `get_user_tenants()` which checks `tenant_users`. The AFTER INSERT trigger adds the user to `tenant_users`, but at the point PostgREST evaluates the SELECT policy, the trigger's insert may not yet be visible — causing "violates row-level security policy."

### Solution
Create a `SECURITY DEFINER` RPC function `create_tenant_for_user()` that:
1. Inserts into `tenants`
2. Inserts into `tenant_users` (admin role)
3. Returns the new tenant row

This bypasses RLS entirely and guarantees atomicity.

### Changes

**1. Database migration** — new RPC function:
```sql
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
```

**2. `src/hooks/useTenants.ts`** — change `useCreateTenant` to call `supabase.rpc('create_tenant_for_user', {...})` instead of `.from('tenants').insert(...)`.

**3. Remove the AFTER INSERT trigger** on `tenants` (no longer needed since the RPC handles both inserts):
```sql
DROP TRIGGER IF EXISTS on_tenant_created ON public.tenants;
```

### Technical Details
- The RPC function is `SECURITY DEFINER`, so it runs with elevated privileges and bypasses all RLS
- It still checks `auth.uid()` internally for safety
- The trigger is removed to avoid duplicate `tenant_users` entries
- No frontend UI changes needed — only the mutation call changes

