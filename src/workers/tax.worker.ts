/// <reference lib="webworker" />
/**
 * Web Worker dos cálculos tributários: mantém o thread principal livre
 * enquanto o carrinho, a NFC-e ou um relatório inteiro é calculado.
 * Protocolo: { id, type, payload } -> { id, ok, result | error }.
 */
import { aggregateTaxReport, calculateTaxes } from "../lib/tax/engine";
import type { TaxConfig, TaxItemInput, TaxReportSale } from "../lib/tax/engine";

export type TaxWorkerRequest =
  | { id: number; type: "calc"; payload: { items: TaxItemInput[]; config: TaxConfig } }
  | {
      id: number;
      type: "report";
      payload: { sales: TaxReportSale[]; config: TaxConfig; groupBy: "day" | "month" };
    };

export type TaxWorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<TaxWorkerRequest>) => {
  const msg = event.data;
  try {
    const result =
      msg.type === "calc"
        ? calculateTaxes(msg.payload.items, msg.payload.config)
        : aggregateTaxReport(msg.payload.sales, msg.payload.config, msg.payload.groupBy);
    ctx.postMessage({ id: msg.id, ok: true, result } satisfies TaxWorkerResponse);
  } catch (err) {
    ctx.postMessage({
      id: msg.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    } satisfies TaxWorkerResponse);
  }
};
