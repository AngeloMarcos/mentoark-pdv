import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";
import { getFiscalProvider, TenantFiscalSettings, FiscalEmitPayload } from "@/services/fiscal";

interface SaleRow {
  id: string;
  tenant_id: string;
  net_total: number;
  gross_total: number;
  discount_total: number;
  payment_method: string;
  customer_id: string | null;
  sale_items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    total: number;
    products: {
      name: string;
      ncm: string | null;
      cfop: string | null;
      csosn: string | null;
      unidade_medida: string | null;
      unit: string | null;
      ean: string | null;
      barcode: string | null;
    } | null;
  }>;
}

export function useFiscal() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  const emitNfce = useMutation({
    mutationFn: async (saleId: string) => {
      if (!currentTenant) throw new Error("Empresa não selecionada");

      // Reload tenant for fresh settings
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .select("id, name, document, settings")
        .eq("id", currentTenant.id)
        .single();
      if (tErr || !tenant) throw tErr || new Error("Empresa não encontrada");

      const settingsObj = (tenant.settings || {}) as Record<string, unknown>;
      const fiscal = (settingsObj.fiscal || {}) as TenantFiscalSettings;

      // Load sale + items + products
      const { data: sale, error: sErr } = await supabase
        .from("sales")
        .select(
          "id, tenant_id, net_total, gross_total, discount_total, payment_method, customer_id, sale_items(product_id, quantity, unit_price, total, products(name, ncm, cfop, csosn, unidade_medida, unit, ean, barcode))"
        )
        .eq("id", saleId)
        .single();
      if (sErr || !sale) throw sErr || new Error("Venda não encontrada");

      const s = sale as unknown as SaleRow;

      // Optional customer
      let customer: { name?: string; document?: string } | null = null;
      if (s.customer_id) {
        const { data: c } = await supabase
          .from("customers")
          .select("name, document")
          .eq("id", s.customer_id)
          .maybeSingle();
        if (c) customer = { name: c.name, document: c.document || undefined };
      }

      // Reserve number atomically: increment proximo_numero in tenant.settings
      const proximoNumero = Number(fiscal.proximo_numero || 1);
      const serie = String(fiscal.serie || "001");
      const ambiente = (fiscal.ambiente || "homologacao") as "homologacao" | "producao";

      const payload: FiscalEmitPayload = {
        tenant_id: tenant.id,
        sale_id: s.id,
        document_type: "nfce",
        serie,
        numero: proximoNumero,
        ambiente,
        empresa: {
          name: tenant.name,
          cnpj: (fiscal.cnpj as string) || tenant.document || "",
          ie: fiscal.ie as string | undefined,
          uf: fiscal.uf as string | undefined,
          municipio_ibge: fiscal.municipio_ibge as string | undefined,
        },
        customer,
        items: s.sale_items.map((it) => ({
          product_id: it.product_id,
          product_name: it.products?.name || "Produto",
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
          total: Number(it.total),
          ncm: it.products?.ncm || null,
          cfop: it.products?.cfop || null,
          csosn: it.products?.csosn || null,
          unidade: it.products?.unidade_medida || it.products?.unit || "UN",
          ean: it.products?.ean || it.products?.barcode || null,
        })),
        totals: {
          gross: Number(s.gross_total),
          discount: Number(s.discount_total || 0),
          net: Number(s.net_total),
        },
        payment_method: s.payment_method,
      };

      const provider = getFiscalProvider(fiscal);
      const result = await provider.emit(payload);

      // Persist fiscal_documents row
      const { data: doc, error: dErr } = await supabase
        .from("fiscal_documents")
        .insert({
          tenant_id: tenant.id,
          sale_id: s.id,
          document_type: "nfce",
          status: provider.name === "simulado" ? "simulado" : result.status,
          numero_nota: result.numero,
          serie: result.serie,
          chave_acesso: result.chave_acesso,
          xml_content: result.xml_content,
          protocolo: result.protocolo,
          valor_total: result.valor_total,
          valor_impostos: result.valor_impostos,
          ambiente: result.ambiente,
          obs: result.message || null,
        })
        .select()
        .single();
      if (dErr) throw dErr;

      // Increment proximo_numero in tenant settings
      const newSettings = {
        ...settingsObj,
        fiscal: { ...fiscal, proximo_numero: proximoNumero + 1, serie, ambiente },
      };
      await supabase.from("tenants").update({ settings: newSettings }).eq("id", tenant.id);

      return doc;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-documents"] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const cancelNfce = useMutation({
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      if (!currentTenant) throw new Error("Empresa não selecionada");

      const { data: doc, error } = await supabase
        .from("fiscal_documents")
        .select("*")
        .eq("id", docId)
        .single();
      if (error || !doc) throw error || new Error("Documento não encontrado");

      // 24h rule
      const ageMs = Date.now() - new Date(doc.created_at).getTime();
      if (ageMs > 24 * 60 * 60 * 1000) {
        throw new Error("Prazo de cancelamento expirado (24h após emissão).");
      }

      const { data: tenant } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", currentTenant.id)
        .single();
      const fiscal = ((tenant?.settings as Record<string, unknown>)?.fiscal || {}) as TenantFiscalSettings;
      const provider = getFiscalProvider(fiscal);

      const result = await provider.cancel(doc.chave_acesso || "", reason);
      if (result.status !== "cancelado") {
        throw new Error(result.message || "Falha ao cancelar");
      }

      const { error: uErr } = await supabase
        .from("fiscal_documents")
        .update({
          status: "cancelado",
          obs: `Cancelado: ${reason} | Protocolo: ${result.protocolo_cancelamento}`,
        })
        .eq("id", docId);
      if (uErr) throw uErr;

      return { ...doc, status: "cancelado" };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-documents"] });
      toast.success("Documento cancelado");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  return { emitNfce, cancelNfce };
}
