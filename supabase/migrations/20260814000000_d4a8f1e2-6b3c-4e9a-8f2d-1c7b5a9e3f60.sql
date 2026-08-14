-- Bug real encontrado ao testar a auto-hospedagem: a trigger
-- auto_add_tenant_creator (criada em 20260808201033, dispara em
-- AFTER INSERT ON tenants) ja insere o criador como admin em
-- tenant_users. A funcao create_tenant_for_user (criada antes, em
-- 20260402145406) faz esse mesmo INSERT de novo, sem ON CONFLICT.
-- Resultado: toda vez que um usuario cria uma empresa nova pela tela de
-- onboarding, a trigger insere primeiro e o INSERT explicito da funcao
-- quebra com "duplicate key value violates unique constraint
-- tenant_users_tenant_id_user_id_key", revertendo a criação da empresa
-- inteira (mesma transação). Isso afeta qualquer conta nova desde que a
-- trigger foi criada — provavelmente a causa de "erro ao criar empresa"
-- relatado por usuários novos.
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

  -- auto_add_tenant_creator (trigger AFTER INSERT em tenants) ja insere
  -- essa linha; ON CONFLICT evita duplicate key quando o trigger roda
  -- primeiro (é sempre o caso, pois triggers AFTER INSERT disparam
  -- antes do controle voltar para esta função).
  INSERT INTO public.tenant_users (tenant_id, user_id, role)
  VALUES (v_tenant.id, v_user_id, 'admin')
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  RETURN v_tenant;
END;
$$;
