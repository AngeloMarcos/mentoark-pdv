-- Fiscal columns on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ncm text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cfop text DEFAULT '5102';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cst_icms text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS csosn text DEFAULT '400';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cest text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS origem integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS icms_aliquota numeric(5,2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS pis_aliquota numeric(5,2) DEFAULT 0.65;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cofins_aliquota numeric(5,2) DEFAULT 3.0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unidade_medida text DEFAULT 'UN';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ean text;

-- fiscal_documents table
CREATE TABLE IF NOT EXISTS public.fiscal_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  sale_id uuid,
  document_type text NOT NULL DEFAULT 'nfce',
  status text NOT NULL DEFAULT 'simulado',
  numero_nota integer,
  serie text NOT NULL DEFAULT '001',
  chave_acesso text,
  xml_content text,
  danfe_url text,
  protocolo text,
  valor_total numeric(12,2) NOT NULL DEFAULT 0,
  valor_impostos numeric(12,2) NOT NULL DEFAULT 0,
  ambiente text NOT NULL DEFAULT 'homologacao',
  obs text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_documents_tenant ON public.fiscal_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_sale ON public.fiscal_documents(sale_id);
CREATE INDEX IF NOT EXISTS idx_fiscal_documents_status ON public.fiscal_documents(status);

ALTER TABLE public.fiscal_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view fiscal_documents of their tenants"
  ON public.fiscal_documents FOR SELECT TO authenticated
  USING (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Users can insert fiscal_documents in their tenants"
  ON public.fiscal_documents FOR INSERT TO authenticated
  WITH CHECK (user_belongs_to_tenant(tenant_id));

CREATE POLICY "Admins can update fiscal_documents"
  ON public.fiscal_documents FOR UPDATE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));

CREATE POLICY "Admins can delete fiscal_documents"
  ON public.fiscal_documents FOR DELETE TO authenticated
  USING (has_tenant_role(tenant_id, 'admin'::app_role));

CREATE POLICY "Super admins can access all fiscal_documents"
  ON public.fiscal_documents FOR ALL
  USING (is_super_admin());

CREATE TRIGGER trg_fiscal_documents_updated_at
  BEFORE UPDATE ON public.fiscal_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Atomic RPC: reserve next fiscal number and create the document
CREATE OR REPLACE FUNCTION public.generate_fiscal_document(
  p_sale_id uuid,
  p_document_type text DEFAULT 'nfce'
) RETURNS public.fiscal_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_tenant_id uuid;
  v_settings jsonb;
  v_fiscal jsonb;
  v_serie text;
  v_proximo integer;
  v_ambiente text;
  v_uf text;
  v_cnpj text;
  v_total numeric(12,2);
  v_chave text;
  v_aamm text;
  v_cnf text;
  v_cuf text;
  v_dv integer;
  v_sum integer := 0;
  v_pesos int[] := ARRAY[2,3,4,5,6,7,8,9];
  v_i int;
  v_digit int;
  v_doc public.fiscal_documents;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT s.tenant_id, s.net_total INTO v_tenant_id, v_total
  FROM public.sales s WHERE s.id = p_sale_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada';
  END IF;

  IF NOT user_belongs_to_tenant(v_tenant_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- Lock the tenant row to prevent duplicate numbers
  SELECT settings INTO v_settings FROM public.tenants WHERE id = v_tenant_id FOR UPDATE;
  v_fiscal := COALESCE(v_settings->'fiscal', '{}'::jsonb);
  v_serie := COALESCE(v_fiscal->>'serie_nfce', v_fiscal->>'nfce_series', '001');
  v_proximo := COALESCE((v_fiscal->>'proximo_numero')::int, (v_fiscal->>'nfce_number')::int, 1);
  v_ambiente := COALESCE(v_fiscal->>'ambiente', v_fiscal->>'environment', 'homologacao');
  v_uf := COALESCE(v_fiscal->>'uf', 'SP');
  v_cnpj := regexp_replace(COALESCE(v_fiscal->>'cnpj', v_fiscal->>'emitter_cnpj', '00000000000000'), '\D', '', 'g');
  v_cnpj := lpad(v_cnpj, 14, '0');

  -- Map UF -> cUF (basic table)
  v_cuf := CASE upper(v_uf)
    WHEN 'AC' THEN '12' WHEN 'AL' THEN '27' WHEN 'AP' THEN '16' WHEN 'AM' THEN '13'
    WHEN 'BA' THEN '29' WHEN 'CE' THEN '23' WHEN 'DF' THEN '53' WHEN 'ES' THEN '32'
    WHEN 'GO' THEN '52' WHEN 'MA' THEN '21' WHEN 'MT' THEN '51' WHEN 'MS' THEN '50'
    WHEN 'MG' THEN '31' WHEN 'PA' THEN '15' WHEN 'PB' THEN '25' WHEN 'PR' THEN '41'
    WHEN 'PE' THEN '26' WHEN 'PI' THEN '22' WHEN 'RJ' THEN '33' WHEN 'RN' THEN '24'
    WHEN 'RS' THEN '43' WHEN 'RO' THEN '11' WHEN 'RR' THEN '14' WHEN 'SC' THEN '42'
    WHEN 'SP' THEN '35' WHEN 'SE' THEN '28' WHEN 'TO' THEN '17'
    ELSE '35' END;

  v_aamm := to_char(now(), 'YYMM');
  v_cnf := lpad((floor(random()*100000000))::text, 8, '0');

  -- Build 43 digits
  v_chave := v_cuf || v_aamm || v_cnpj || '65' || lpad(v_serie,3,'0') || lpad(v_proximo::text,9,'0') || '1' || v_cnf;

  -- DV módulo 11
  v_sum := 0;
  FOR v_i IN 0..42 LOOP
    v_digit := substring(v_chave, 43 - v_i, 1)::int;
    v_sum := v_sum + v_digit * v_pesos[(v_i % 8) + 1];
  END LOOP;
  v_dv := 11 - (v_sum % 11);
  IF v_dv >= 10 THEN v_dv := 0; END IF;
  v_chave := v_chave || v_dv::text;

  -- Insert document
  INSERT INTO public.fiscal_documents (
    tenant_id, sale_id, document_type, status, numero_nota, serie,
    chave_acesso, valor_total, valor_impostos, ambiente, created_by
  ) VALUES (
    v_tenant_id, p_sale_id, p_document_type, 'simulado', v_proximo, v_serie,
    v_chave, COALESCE(v_total,0), ROUND(COALESCE(v_total,0) * 0.05, 2), v_ambiente, v_user_id
  ) RETURNING * INTO v_doc;

  -- Increment counter atomically
  v_fiscal := jsonb_set(v_fiscal, '{proximo_numero}', to_jsonb(v_proximo + 1), true);
  v_settings := jsonb_set(COALESCE(v_settings,'{}'::jsonb), '{fiscal}', v_fiscal, true);
  UPDATE public.tenants SET settings = v_settings WHERE id = v_tenant_id;

  RETURN v_doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_fiscal_document(
  p_id uuid,
  p_reason text DEFAULT NULL
) RETURNS public.fiscal_documents
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc public.fiscal_documents;
BEGIN
  SELECT * INTO v_doc FROM public.fiscal_documents WHERE id = p_id;
  IF v_doc.id IS NULL THEN RAISE EXCEPTION 'Documento não encontrado'; END IF;
  IF NOT has_tenant_role(v_doc.tenant_id, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Apenas administradores podem cancelar';
  END IF;
  UPDATE public.fiscal_documents
    SET status = 'cancelado',
        obs = COALESCE(p_reason, obs),
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO v_doc;
  RETURN v_doc;
END;
$$;