import { FiscalProvider, FiscalEmitPayload, FiscalEmitResult, FiscalCancelResult } from "./types";

/**
 * A emissão real pela Focus NFe NÃO acontece no navegador: ela roda no
 * serviço pdv_fiscal (infra/fiscal-service), chamado por fiscalApi.ts.
 * useFiscal desvia para fiscalApi quando settings.fiscal.provider === "focus_nfe",
 * então esta classe só existe para manter a interface do factory.
 */
export class FocusNfeProvider implements FiscalProvider {
  readonly name = "focus_nfe";

  async emit(_payload: FiscalEmitPayload): Promise<FiscalEmitResult> {
    throw new Error("Emissão Focus NFe é feita pelo serviço fiscal (fiscalApi.emitNfce).");
  }

  async cancel(_chave: string, _reason: string): Promise<FiscalCancelResult> {
    throw new Error("Cancelamento Focus NFe é feito pelo serviço fiscal (fiscalApi.cancel).");
  }
}
