import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";
import { buildNFCeXML, FiscalItem, FiscalSale, FiscalCompany } from "@/lib/fiscal-utils";
import { fiscalApi } from "@/services/fiscal/fiscalApi";

export interface FiscalDocument {
  id: string;
  tenant_id: string;
  sale_id: string | null;
  document_type: string;
  status: string;
  numero_nota: number | null;
  serie: string;
  chave_acesso: string | null;
  xml_content: string | null;
  danfe_url: string | null;
  protocolo: string | null;
  valor_total: number;
  valor_impostos: number;
  ambiente: string;
  obs: string | null;
  created_at: string;
  updated_at: string;
  /** "simulado" | "focus_nfe" */
  provider?: string;
  ref?: string | null;
  status_sefaz?: string | null;
  mensagem_sefaz?: string | null;
  qrcode_url?: string | null;
  xml_url?: string | null;
  contingencia?: boolean;
  tentativas?: number;
}

/** Nota que passou (ou vai passar) pela SEFAZ, e não um documento simulado. */
export const isRealFiscalDocument = (d: Pick<FiscalDocument, "provider"> | null | undefined) =>
  !!d?.provider && d.provider !== "simulado";

export interface FiscalDocumentFilters {
  status?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export function useFiscalDocuments(filters: FiscalDocumentFilters = {}) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["fiscal-documents", currentTenant?.id, filters],
    queryFn: async () => {
      if (!currentTenant) return [] as FiscalDocument[];
      let q = supabase
        .from("fiscal_documents" as never)
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });
      if (filters.status) q = q.eq("status", filters.status);
      if (filters.type) q = q.eq("document_type", filters.type);
      if (filters.startDate) q = q.gte("created_at", filters.startDate);
      if (filters.endDate) q = q.lte("created_at", filters.endDate);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as FiscalDocument[];
    },
    enabled: !!currentTenant,
  });
}

/** Generate fiscal document for a sale: calls RPC + builds XML locally */
export function useGenerateFiscalDocument() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (params: { saleId: string; documentType?: string }) => {
      // Atomic RPC: reserves number + creates fiscal_documents row
      const { data: doc, error } = await supabase.rpc(
        "generate_fiscal_document" as never,
        {
          p_sale_id: params.saleId,
          p_document_type: params.documentType || "nfce",
        } as never
      );
      if (error) throw error;
      const document = doc as unknown as FiscalDocument;

      // Build XML client-side and persist
      try {
        const { data: sale } = await supabase
          .from("sales")
          .select("*, sale_items(*, products(*))")
          .eq("id", params.saleId)
          .single();

        const { data: tenant } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", document.tenant_id)
          .single();

        if (sale && tenant) {
          const settings = (tenant.settings || {}) as Record<string, unknown>;
          const fiscal = (settings.fiscal || {}) as Record<string, unknown>;
          const empresa: FiscalCompany = {
            name: tenant.name,
            cnpj: (fiscal.cnpj as string) || (fiscal.emitter_cnpj as string) || tenant.document || "",
            ie: (fiscal.ie as string) || (fiscal.state_registration as string) || "",
            uf: (fiscal.uf as string) || "SP",
            municipio_ibge: (fiscal.municipio_ibge as string) || "3550308",
          };
          const items: FiscalItem[] = ((sale.sale_items as unknown[]) || []).map((raw) => {
            const it = raw as Record<string, unknown>;
            const p = (it.products || {}) as Record<string, unknown>;
            return {
              product_id: it.product_id as string,
              product_name: (p.name as string) || "Produto",
              quantity: Number(it.quantity || 0),
              unit_price: Number(it.unit_price || 0),
              total: Number(it.total || 0),
              ncm: (p.ncm as string) || null,
              cfop: (p.cfop as string) || "5102",
              csosn: (p.csosn as string) || "400",
              cst_icms: (p.cst_icms as string) || null,
              unidade: (p.unidade_medida as string) || (p.unit as string) || "UN",
              ean: (p.ean as string) || (p.barcode as string) || null,
              icms_aliquota: Number(p.icms_aliquota || 0),
              pis_aliquota: Number(p.pis_aliquota || 0),
              cofins_aliquota: Number(p.cofins_aliquota || 0),
            };
          });
          const fiscalSale: FiscalSale = {
            id: sale.id,
            numero: document.numero_nota || 1,
            serie: document.serie,
            datetime: new Date(sale.datetime),
            net_total: Number(sale.net_total),
            discount_total: Number(sale.discount_total || 0),
            payment_method: sale.payment_method,
            ambiente: (document.ambiente as "homologacao" | "producao") || "homologacao",
            chave: document.chave_acesso || "",
          };
          const xml = buildNFCeXML(fiscalSale, empresa, items, null, Number(document.valor_impostos || 0));
          await supabase
            .from("fiscal_documents" as never)
            .update({ xml_content: xml } as never)
            .eq("id", document.id);
          document.xml_content = xml;
        }
      } catch (err) {
        // XML build failure shouldn't kill the doc creation
        console.warn("Falha ao montar XML:", err);
      }
      return document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-documents", currentTenant?.id] });
    },
    onError: (err) => {
      toast.error(getUserFriendlyError(err));
    },
  });
}

export function useCancelFiscalDocument() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async ({ id, reason, provider }: { id: string; reason?: string; provider?: string }) => {
      if (provider && provider !== "simulado") {
        return fiscalApi.cancel(id, reason || "");
      }
      const { data, error } = await supabase.rpc("cancel_fiscal_document" as never, {
        p_id: id,
        p_reason: reason || null,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-documents", currentTenant?.id] });
      toast.success("Documento cancelado");
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}

/** Consulta a situação de uma nota real na Focus/SEFAZ e atualiza o registro. */
export function useConsultFiscalDocument() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: (id: string) => fiscalApi.consult(id),
    onSuccess: (doc) => {
      queryClient.invalidateQueries({ queryKey: ["fiscal-documents", currentTenant?.id] });
      if (doc.status === "autorizado") toast.success("Nota autorizada pela SEFAZ");
      else if (doc.status === "rejeitado") toast.error(doc.mensagem_sefaz || "Nota rejeitada");
      else toast.info("Nota ainda em processamento na SEFAZ");
    },
    onError: (err) => toast.error(getUserFriendlyError(err)),
  });
}
