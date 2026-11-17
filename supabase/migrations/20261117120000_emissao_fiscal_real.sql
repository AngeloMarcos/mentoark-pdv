-- Emissão fiscal real (Focus NFe) — base de dados
--
-- 1. fiscal_credentials: tokens da API de emissão por empresa. Só o
--    serviço pdv_fiscal (service_role) lê e grava. Nenhuma policy para
--    anon/authenticated: o navegador nunca vê os tokens.
-- 2. fiscal_documents: colunas para o retorno da SEFAZ (provedor, ref,
--    mensagem, QR Code, contingência, payload para reenvio).
-- 3. Trava: documento de provedor real (≠ 'simulado') só pode ser criado,
--    alterado ou apagado pelo serviço fiscal. Sem isso, um usuário com
--    acesso à API poderia gravar uma nota "autorizada" que nunca passou
--    pela SEFAZ, ou marcar como cancelada uma nota que segue válida.

-- 1. Credenciais -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiscal_credentials (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'focus_nfe',
  token_homologacao text,
  token_producao text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fiscal_credentials FROM anon, authenticated;
GRANT ALL ON public.fiscal_credentials TO service_role;

DROP TRIGGER IF EXISTS trg_fiscal_credentials_updated_at ON public.fiscal_credentials;
CREATE TRIGGER trg_fiscal_credentials_updated_at
  BEFORE UPDATE ON public.fiscal_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Colunas novas em fiscal_documents --------------------------------------
ALTER TABLE public.fiscal_documents
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'simulado',
  ADD COLUMN IF NOT EXISTS ref text,
  ADD COLUMN IF NOT EXISTS status_sefaz text,
  ADD COLUMN IF NOT EXISTS mensagem_sefaz text,
  ADD COLUMN IF NOT EXISTS qrcode_url text,
  ADD COLUMN IF NOT EXISTS xml_url text,
  ADD COLUMN IF NOT EXISTS contingencia boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payload jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_documents_ref
  ON public.fiscal_documents(ref) WHERE ref IS NOT NULL;

-- Uma nota real "viva" por venda e tipo (evita emitir duas vezes a mesma venda
-- quando o caixa clica duas vezes ou a rede repete a requisição).
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_documents_sale_real
  ON public.fiscal_documents(sale_id, document_type)
  WHERE provider <> 'simulado' AND status NOT IN ('cancelado', 'rejeitado', 'denegado');

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_retry
  ON public.fiscal_documents(status, updated_at)
  WHERE provider <> 'simulado' AND status IN ('pendente', 'processando');

-- 3. Trava de integridade ---------------------------------------------------
-- auth.role() lê o claim "role" do JWT da requisição (inclusive dentro de
-- funções SECURITY DEFINER como cancel_fiscal_document). Sem JWT nenhum
-- (manutenção via psql), a trava não se aplica.
CREATE OR REPLACE FUNCTION public.guard_real_fiscal_documents()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_claims text := current_setting('request.jwt.claims', true);
  v_role text := auth.role();
  v_provider text;
BEGIN
  IF v_claims IS NULL OR v_claims = '' OR v_role = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_provider := NEW.provider;
  ELSIF TG_OP = 'UPDATE' THEN
    v_provider := CASE WHEN OLD.provider <> 'simulado' THEN OLD.provider ELSE NEW.provider END;
  ELSE
    v_provider := OLD.provider;
  END IF;

  IF v_provider IS DISTINCT FROM 'simulado' THEN
    RAISE EXCEPTION 'Documento fiscal real só pode ser alterado pelo serviço de emissão'
      USING ERRCODE = '42501';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_real_fiscal_documents ON public.fiscal_documents;
CREATE TRIGGER trg_guard_real_fiscal_documents
  BEFORE INSERT OR UPDATE OR DELETE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_real_fiscal_documents();

-- 4. Remove o CSC que ficava legível no navegador ---------------------------
-- O CSC passa a ser cadastrado na Focus (painel ou API de empresas) na
-- implantação; o PDV não precisa mais guardá-lo.
UPDATE public.tenants
   SET settings = jsonb_set(settings, '{fiscal}', (settings->'fiscal') - 'token_csc' - 'id_csc')
 WHERE settings ? 'fiscal'
   AND ((settings->'fiscal') ? 'token_csc' OR (settings->'fiscal') ? 'id_csc');
