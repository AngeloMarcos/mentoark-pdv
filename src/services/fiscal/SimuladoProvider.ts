import { buildNFCeXML, generateChaveAcesso, FiscalCompany, FiscalItem, FiscalSale } from "@/lib/fiscal-utils";
import { computeTaxes } from "@/lib/tax/client";
import { FiscalProvider,FiscalEmitPayload, FiscalEmitResult, FiscalCancelResult } from "./types";

/** 100% offline simulated provider — generates fake key, protocol, XML */
export class SimuladoProvider implements FiscalProvider {
  readonly name = "simulado";

  async emit(payload: FiscalEmitPayload): Promise<FiscalEmitResult> {
    // Simulate network latency
    await new Promise((r) => setTimeout(r, 1000));

    const chave = generateChaveAcesso({
      uf: payload.empresa.uf || "SP",
      cnpj: payload.empresa.cnpj || "00000000000000",
      serie: payload.serie,
      numero: payload.numero,
    });

    const empresa: FiscalCompany = {
      name: payload.empresa.name,
      cnpj: payload.empresa.cnpj,
      ie: payload.empresa.ie,
      uf: payload.empresa.uf || "SP",
      municipio_ibge: payload.empresa.municipio_ibge || "3550308",
    };

    const items: FiscalItem[] = payload.items.map((it) => ({
      product_id: it.product_id,
      product_name: it.product_name,
      quantity: it.quantity,
      unit_price: it.unit_price,
      total: it.total,
      discount: it.discount || 0,
      ncm: it.ncm || "00000000",
      cfop: it.cfop || "5102",
      csosn: it.csosn || "400",
      unidade: it.unidade || "UN",
      ean: it.ean || null,
    }));

    const sale: FiscalSale = {
      id: payload.sale_id,
      numero: payload.numero,
      serie: payload.serie,
      datetime: new Date(),
      net_total: payload.totals.net,
      discount_total: payload.totals.discount,
      payment_method: payload.payment_method,
      ambiente: payload.ambiente,
      chave,
    };

    // IBS/CBS/IS calculados no Web Worker (não trava o caixa durante a emissão)
    const tax = payload.reforma?.enabled
      ? await computeTaxes(
          payload.items.map((it, i) => ({
            key: String(i + 1),
            quantity: it.quantity,
            unit_price: it.unit_price,
            discount: it.discount || 0,
            ncm: it.ncm,
            category: it.category,
            tax: it.tax,
          })),
          payload.reforma
        )
      : null;

    const valor_impostos = payload.impostos_aprox ?? 0;
    const xml = buildNFCeXML(sale, empresa, items, tax, valor_impostos);
    const protocolo = `SIM${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;

    return {
      status: "autorizado",
      chave_acesso: chave,
      protocolo,
      xml_content: xml,
      numero: payload.numero,
      serie: payload.serie,
      valor_total: tax ? tax.totals.vTotal : payload.totals.net,
      valor_impostos,
      ambiente: payload.ambiente,
      message: "Documento simulado autorizado (sem validade fiscal)",
    };
  }

  async cancel(chave: string, reason: string): Promise<FiscalCancelResult> {
    await new Promise((r) => setTimeout(r, 500));
    if (!reason || reason.trim().length < 15) {
      return {
        status: "rejeitado",
        protocolo_cancelamento: "",
        message: "Motivo deve ter ao menos 15 caracteres (regra SEFAZ).",
      };
    }
    return {
      status: "cancelado",
      protocolo_cancelamento: `CAN${Date.now()}`,
      message: `Cancelamento simulado para chave ${chave.slice(-8)}`,
    };
  }
}
