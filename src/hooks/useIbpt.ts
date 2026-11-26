import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { indexRates, type IbptMeta, type IbptRate } from "@/lib/ibpt";

export interface IbptVersion extends IbptMeta {
  total_rows: number;
  imported_at: string;
}

/** Versão da tabela IBPT importada pela empresa (null se nunca importou). */
export function useIbptVersion() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["ibpt-version", currentTenant?.id],
    enabled: !!currentTenant,
    queryFn: async (): Promise<IbptVersion | null> => {
      const { data, error } = await supabase
        .from("ibpt_versions" as never)
        .select("uf, versao, chave, fonte, vigencia_inicio, vigencia_fim, total_rows, imported_at")
        .eq("tenant_id" as never, currentTenant!.id as never)
        .maybeSingle();
      if (error) throw error;
      return (data as IbptVersion | null) ?? null;
    },
  });
}

/** Alíquotas só dos NCMs pedidos (uma venda tem poucos itens). */
export async function fetchIbptRates(tenantId: string, ncms: Array<string | null | undefined>) {
  const list = [...new Set(ncms.map((n) => String(n ?? "").replace(/\D/g, "")).filter((n) => n.length === 8))];
  if (list.length === 0) return indexRates([]);
  const { data, error } = await supabase
    .from("ibpt_rates" as never)
    .select("ncm, ex, nacional_federal, importados_federal, estadual, municipal")
    .eq("tenant_id" as never, tenantId as never)
    .in("ncm" as never, list as never);
  if (error) throw error;
  const rows = ((data ?? []) as IbptRate[]).map((r) => ({
    ...r,
    nacional_federal: Number(r.nacional_federal),
    importados_federal: Number(r.importados_federal),
    estadual: Number(r.estadual),
    municipal: Number(r.municipal),
  }));
  return indexRates(rows);
}

export function useImportIbpt() {
  const { currentTenant } = useTenant();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ rates, meta }: { rates: IbptRate[]; meta: IbptMeta }) => {
      if (!currentTenant) throw new Error("Empresa não selecionada");
      // Formato compacto: ~10 mil linhas cabem numa chamada só (atômica no banco).
      const rows = rates.map((r) => [r.ncm, r.ex, r.nacional_federal, r.importados_federal, r.estadual, r.municipal]);
      const { data, error } = await supabase.rpc("import_ibpt_table" as never, {
        p_tenant: currentTenant.id,
        p_meta: meta,
        p_rows: rows,
      } as never);
      if (error) throw error;
      return Number(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ibpt-version"] });
      qc.invalidateQueries({ queryKey: ["fiscal-readiness"] });
    },
  });
}
