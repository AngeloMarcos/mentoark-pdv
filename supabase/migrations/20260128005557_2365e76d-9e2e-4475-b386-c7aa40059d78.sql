-- 1. Expand tenants table with settings and subscription fields
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
  "currency": "BRL",
  "timezone": "America/Sao_Paulo",
  "fiscal_enabled": false,
  "logo_url": null,
  "address": null,
  "email": null,
  "receipt_footer": null,
  "low_stock_alert_threshold": 10,
  "allow_negative_stock": false
}'::jsonb;

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';

ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- 2. Create tenant_invitations table
CREATE TABLE public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'operator',
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email)
);

-- Index for fast token lookup
CREATE INDEX idx_tenant_invitations_token ON public.tenant_invitations(token);

-- Enable RLS
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_invitations
CREATE POLICY "Super admins can access all invitations"
ON public.tenant_invitations FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can view invitations of their tenant"
ON public.tenant_invitations FOR SELECT
USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Admins can create invitations for their tenant"
ON public.tenant_invitations FOR INSERT
WITH CHECK (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Admins can update invitations of their tenant"
ON public.tenant_invitations FOR UPDATE
USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Admins can delete invitations of their tenant"
ON public.tenant_invitations FOR DELETE
USING (has_tenant_role(tenant_id, 'admin'));

-- 3. Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for audit_logs
CREATE POLICY "Super admins can access all audit_logs"
ON public.audit_logs FOR ALL
USING (is_super_admin());

CREATE POLICY "Admins can view audit_logs of their tenant"
ON public.audit_logs FOR SELECT
USING (has_tenant_role(tenant_id, 'admin'));

CREATE POLICY "Users can insert audit_logs in their tenants"
ON public.audit_logs FOR INSERT
WITH CHECK (user_belongs_to_tenant(tenant_id));

-- 4. Function to accept invitation (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation tenant_invitations%ROWTYPE;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;
  
  -- Find valid invitation
  SELECT * INTO v_invitation
  FROM tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > now();
    
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite invalido ou expirado';
  END IF;
  
  -- Add user to tenant
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (v_invitation.tenant_id, v_user_id, v_invitation.role)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = v_invitation.role;
  
  -- Mark invitation as accepted
  UPDATE tenant_invitations
  SET accepted_at = now()
  WHERE id = v_invitation.id;
  
  RETURN v_invitation.tenant_id;
END;
$$;

-- 5. Function to get invitation info by token (public for non-authenticated users)
CREATE OR REPLACE FUNCTION public.get_invitation_info(p_token TEXT)
RETURNS TABLE(
  tenant_name TEXT,
  role app_role,
  email TEXT,
  expires_at TIMESTAMPTZ,
  is_valid BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.name as tenant_name,
    i.role,
    i.email,
    i.expires_at,
    (i.accepted_at IS NULL AND i.expires_at > now()) as is_valid
  FROM tenant_invitations i
  JOIN tenants t ON t.id = i.tenant_id
  WHERE i.token = p_token;
$$;

-- 6. Function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_tenant_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_data, new_data)
  VALUES (p_tenant_id, auth.uid(), p_action, p_entity_type, p_entity_id, p_old_data, p_new_data)
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 7. Add unique constraint to tenant_users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenant_users_tenant_user_unique'
  ) THEN
    ALTER TABLE public.tenant_users ADD CONSTRAINT tenant_users_tenant_user_unique UNIQUE (tenant_id, user_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;