-- Tabela IBPT ("De Olho no Imposto") por empresa — Lei 12.741/2012.
--
-- O cupom e a NFC-e precisam mostrar o valor aproximado dos tributos. Antes o
-- sistema usava 5% fixo; agora usa as alíquotas do IBPT por NCM.
--
-- O arquivo é gerado pelo IBPT para o CNPJ da empresa (tem a "chave" dela) e
-- vale por um período curto, então fica por empresa e é trocado inteiro a cada
-- importação. Usuários só leem; a escrita é feita pela função
-- import_ibpt_table, só por admin, numa única transação: se o arquivo falhar
-- no meio, a tabela anterior continua valendo.

CREATE TABLE IF NOT EXISTS public.ibpt_rates (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  ncm text NOT NULL CHECK (ncm ~ '^[0-9]{8}$'),
  ex text NOT NULL DEFAULT '',
  nacional_federal numeric(7,2) NOT NULL DEFAULT 0 CHECK (nacional_federal >= 0),
  importados_federal numeric(7,2) NOT NULL DEFAULT 0 CHECK (importados_federal >= 0),
  estadual numeric(7,2) NOT NULL DEFAULT 0 CHECK (estadual >= 0),
  municipal numeric(7,2) NOT NULL DEFAULT 0 CHECK (municipal >= 0),
  PRIMARY KEY (tenant_id, ncm, ex)
);

CREATE TABLE IF NOT EXISTS public.ibpt_versions (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  uf char(2),
  versao text,
  chave text,
  fonte text,
  vigencia_inicio date,
  vigencia_fim date,
  total_rows integer NOT NULL DEFAULT 0,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid
);

ALTER TABLE public.ibpt_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibpt_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ibpt_rates, public.ibpt_versions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ibpt_rates, public.ibpt_versions FROM authenticated;
GRANT SELECT ON public.ibpt_rates, public.ibpt_versions TO authenticated;
GRANT ALL ON public.ibpt_rates, public.ibpt_versions TO service_role;

DROP POLICY IF EXISTS ibpt_rates_select ON public.ibpt_rates;
CREATE POLICY ibpt_rates_select ON public.ibpt_rates
  FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id));

DROP POLICY IF EXISTS ibpt_versions_select ON public.ibpt_versions;
CREATE POLICY ibpt_versions_select ON public.ibpt_versions
  FOR SELECT TO authenticated USING (public.user_belongs_to_tenant(tenant_id));

-- p_meta: { uf, versao, chave, fonte, vigencia_inicio, vigencia_fim } (datas AAAA-MM-DD)
-- p_rows: [[ncm, ex, nacional_federal, importados_federal, estadual, municipal], ...]
CREATE OR REPLACE FUNCTION public.import_ibpt_table(p_tenant uuid, p_meta jsonb, p_rows jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.has_tenant_role(p_tenant, 'admin') OR public.is_super_admin()) THEN
    RAISE EXCEPTION 'Só o administrador da empresa pode importar a tabela IBPT';
  END IF;
  IF jsonb_typeof(p_rows) <> 'array' OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'Arquivo IBPT sem linhas de NCM';
  END IF;

  DELETE FROM public.ibpt_rates WHERE tenant_id = p_tenant;

  INSERT INTO public.ibpt_rates (tenant_id, ncm, ex, nacional_federal, importados_federal, estadual, municipal)
  SELECT p_tenant, r->>0, COALESCE(r->>1, ''),
         (r->>2)::numeric, (r->>3)::numeric, (r->>4)::numeric, (r->>5)::numeric
    FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (tenant_id, ncm, ex) DO UPDATE SET
    nacional_federal = EXCLUDED.nacional_federal,
    importados_federal = EXCLUDED.importados_federal,
    estadual = EXCLUDED.estadual,
    municipal = EXCLUDED.municipal;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  INSERT INTO public.ibpt_versions (tenant_id, uf, versao, chave, fonte, vigencia_inicio, vigencia_fim, total_rows, imported_at, imported_by)
  VALUES (
    p_tenant,
    NULLIF(upper(p_meta->>'uf'), ''),
    NULLIF(p_meta->>'versao', ''),
    NULLIF(p_meta->>'chave', ''),
    NULLIF(p_meta->>'fonte', ''),
    NULLIF(p_meta->>'vigencia_inicio', '')::date,
    NULLIF(p_meta->>'vigencia_fim', '')::date,
    v_count, now(), auth.uid()
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    uf = EXCLUDED.uf, versao = EXCLUDED.versao, chave = EXCLUDED.chave, fonte = EXCLUDED.fonte,
    vigencia_inicio = EXCLUDED.vigencia_inicio, vigencia_fim = EXCLUDED.vigencia_fim,
    total_rows = EXCLUDED.total_rows, imported_at = EXCLUDED.imported_at, imported_by = EXCLUDED.imported_by;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.import_ibpt_table(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_ibpt_table(uuid, jsonb, jsonb) TO authenticated;
