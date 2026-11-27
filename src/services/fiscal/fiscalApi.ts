import { supabase } from "@/integrations/supabase/client";
import type { FiscalDocument } from "@/hooks/useFiscalDocuments";

/**
 * Cliente do serviço pdv_fiscal (infra/fiscal-service), exposto pelo gateway
 * em <VITE_SUPABASE_URL>/fiscal/v1. Pode ser sobrescrito por VITE_FISCAL_API_URL.
 * Toda chamada leva o JWT do usuário; os tokens da Focus nunca passam pelo navegador.
 */
const BASE_URL: string =
  import.meta.env.VITE_FISCAL_API_URL ||
  `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/fiscal/v1`;

export interface FiscalCredentialsStatus {
  configured: boolean;
  homologacao: string | null;
  producao: string | null;
  updated_at: string | null;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error("Sem conexão com o serviço fiscal. Verifique a internet e tente novamente.");
  }

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.message || `Serviço fiscal respondeu ${res.status}`);
  }
  return payload as T;
}

export interface MonthlyXmlPackage {
  blob: Blob;
  filename: string;
  total: number;
  /** Notas cujo XML não veio da Focus (o resumo.csv aponta quais). */
  faltando: number;
}

/** Pacote .zip com os XMLs do mês (autorizadas + cancelamentos) e o resumo.csv. */
async function downloadMonthlyXml(tenantId: string, mes: string): Promise<MonthlyXmlPackage> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sessão expirada. Entre novamente.");

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/xml-mensal/${tenantId}?mes=${encodeURIComponent(mes)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error("Sem conexão com o serviço fiscal. Verifique a internet e tente novamente.");
  }
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.message || `Serviço fiscal respondeu ${res.status}`);
  }
  const disposition = res.headers.get("content-disposition") || "";
  return {
    blob: await res.blob(),
    filename: /filename="([^"]+)"/.exec(disposition)?.[1] || `nfce-${mes}.zip`,
    total: Number(res.headers.get("x-notas-total") || 0),
    faltando: Number(res.headers.get("x-xml-faltando") || 0),
  };
}

export const fiscalApi = {
  downloadMonthlyXml,
  emitNfce: (saleId: string) => call<FiscalDocument>("POST", "/nfce", { sale_id: saleId }),
  consult: (docId: string) => call<FiscalDocument>("POST", `/documents/${docId}/consultar`),
  cancel: (docId: string, justificativa: string) =>
    call<FiscalDocument>("POST", `/documents/${docId}/cancelar`, { justificativa }),
  getCredentials: (tenantId: string) => call<FiscalCredentialsStatus>("GET", `/credentials/${tenantId}`),
  saveCredentials: (
    tenantId: string,
    tokens: { token_homologacao?: string; token_producao?: string }
  ) => call<FiscalCredentialsStatus>("PUT", `/credentials/${tenantId}`, tokens),
};
