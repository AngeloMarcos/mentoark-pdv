import { FiscalProvider, FiscalEmitPayload, FiscalEmitResult, FiscalCancelResult } from "./types";

/**
 * Stub for Focus NFe integration.
 * Implementation requires: API key (token), CNPJ habilitado, certificado A1 enviado ao Focus.
 * Endpoint base: https://api.focusnfe.com.br/v2/nfce
 *
 * Quando ativar: chamar uma Edge Function `emit-fiscal-document` com a chave
 * armazenada em secret (FOCUS_NFE_TOKEN) — nunca expor no frontend.
 */
export class FocusNfeProvider implements FiscalProvider {
  readonly name = "focus_nfe";

  async emit(_payload: FiscalEmitPayload): Promise<FiscalEmitResult> {
    throw new Error(
      "Provedor Focus NFe não configurado. Cadastre o token da API e o certificado digital nas Configurações Fiscais."
    );
  }

  async cancel(_chave: string, _reason: string): Promise<FiscalCancelResult> {
    throw new Error(
      "Provedor Focus NFe não configurado. Cadastre o token da API nas Configurações Fiscais."
    );
  }
}
