/**
 * Cliente do Web Worker tributário. Cria o worker sob demanda (não pesa no
 * carregamento inicial) e cai para o cálculo síncrono se o navegador não
 * suportar Worker ou se o worker falhar.
 */
import {
  aggregateTaxReport,
  calculateTaxes,
  type TaxConfig,
  type TaxItemInput,
  type TaxReport,
  type TaxReportSale,
  type TaxResult,
} from "./engine";
import type { TaxWorkerRequest, TaxWorkerResponse } from "@/workers/tax.worker";

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };
type Payload = TaxWorkerRequest["payload"];

let worker: Worker | null = null;
let workerBroken = false;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerBroken || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL("../../workers/tax.worker.ts", import.meta.url), {
      type: "module",
      name: "tax-worker",
    });
    worker.onmessage = (event: MessageEvent<TaxWorkerResponse>) => {
      const msg = event.data;
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (msg.ok === true) p.resolve(msg.result);
      else p.reject(new Error(msg.error));
    };
    worker.onerror = () => {
      // Worker indisponível (CSP, navegador antigo...): daqui em diante, síncrono.
      workerBroken = true;
      worker?.terminate();
      worker = null;
      const waiting = Array.from(pending.values());
      pending.clear();
      waiting.forEach((p) => p.reject(new Error("tax-worker indisponível")));
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

async function run<T>(type: TaxWorkerRequest["type"], payload: Payload, fallback: () => T): Promise<T> {
  const w = getWorker();
  if (!w) return fallback();
  const id = ++seq;
  try {
    return await new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
      w.postMessage({ id, type, payload });
    });
  } catch {
    return fallback();
  }
}

export function computeTaxes(items: TaxItemInput[], config: TaxConfig): Promise<TaxResult> {
  return run("calc", { items, config }, () => calculateTaxes(items, config));
}

export function computeTaxReport(
  sales: TaxReportSale[],
  config: TaxConfig,
  groupBy: "day" | "month"
): Promise<TaxReport> {
  return run("report", { sales, config, groupBy }, () => aggregateTaxReport(sales, config, groupBy));
}
