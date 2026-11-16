import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useProducts } from "@/hooks/useProducts";
import { computeTaxes, computeTaxReport } from "@/lib/tax/client";
import {
  normalizeTaxConfig,
  productTaxFields,
  type TaxConfig,
  type TaxItemInput,
  type TaxReport,
  type TaxReportSale,
  type TaxResult,
} from "@/lib/tax/engine";

/** Configuração da reforma tributária do tenant (settings.fiscal.reforma). */
export function useTaxConfig(): TaxConfig {
  const { settings } = useCompanySettings();
  const raw = (settings.fiscal as Record<string, unknown> | undefined)?.reforma;
  return useMemo(() => normalizeTaxConfig(raw), [raw]);
}

/**
 * Calcula os tributos do carrinho no Web Worker. Devolve o último resultado
 * válido; respostas de cálculos antigos (fora de ordem) são descartadas.
 */
export function useCartTaxes(items: TaxItemInput[], config: TaxConfig): TaxResult | null {
  const [result, setResult] = useState<TaxResult | null>(null);

  useEffect(() => {
    if (!config.enabled || items.length === 0) {
      setResult(null);
      return;
    }
    let cancelled = false;
    computeTaxes(items, config).then((res) => {
      if (!cancelled) setResult(res);
    });
    return () => {
      cancelled = true;
    };
  }, [items, config]);

  return result;
}

const PAGE = 1000;

interface SaleRow {
  id: string;
  datetime: string;
  sale_items: Array<{ product_id: string; quantity: number; unit_price: number; discount: number | null }>;
}

/** Relatório de tributos por dia ou mês, agregado no Web Worker. */
export function useTaxReport(params: { start: string; end: string; groupBy: "day" | "month" }) {
  const { currentTenant } = useTenant();
  const config = useTaxConfig();
  const { data: products = [], isLoading: productsLoading } = useProducts();

  const productsById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof productTaxFields>>();
    for (const p of products) map.set(p.id, productTaxFields(p));
    return map;
  }, [products]);

  return useQuery<TaxReport>({
    queryKey: ["tax-report", currentTenant?.id, params.start, params.end, params.groupBy, config, products.length],
    enabled: !!currentTenant && !productsLoading && !!params.start && !!params.end,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const sales: TaxReportSale[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("sales")
          .select("id, datetime, sale_items(product_id, quantity, unit_price, discount)")
          .eq("tenant_id", currentTenant!.id)
          .gte("datetime", `${params.start}T00:00:00-03:00`)
          .lte("datetime", `${params.end}T23:59:59.999-03:00`)
          .order("datetime", { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw error;
        const rows = (data || []) as unknown as SaleRow[];
        for (const s of rows) {
          sales.push({
            id: s.id,
            datetime: s.datetime,
            items: (s.sale_items || []).map((it, i) => ({
              key: `${s.id}:${i}`,
              quantity: Number(it.quantity),
              unit_price: Number(it.unit_price),
              discount: Number(it.discount || 0),
              ...(productsById.get(it.product_id) || {}),
            })),
          });
        }
        if (rows.length < PAGE) break;
      }
      return computeTaxReport(sales, config, params.groupBy);
    },
  });
}
