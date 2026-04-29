import { FiscalProvider } from "./types";
import { SimuladoProvider } from "./SimuladoProvider";
import { FocusNfeProvider } from "./FocusNfeProvider";

export * from "./types";
export { SimuladoProvider, FocusNfeProvider };

export interface TenantFiscalSettings {
  provider?: "simulado" | "focus_nfe" | string;
  ambiente?: "homologacao" | "producao";
  serie?: string;
  proximo_numero?: number;
  emite_nfce?: boolean;
  cnpj?: string;
  ie?: string;
  uf?: string;
  municipio_ibge?: string;
  [k: string]: unknown;
}

/** Factory: returns the right provider based on tenant settings */
export function getFiscalProvider(settings?: TenantFiscalSettings | null): FiscalProvider {
  const name = settings?.provider || "simulado";
  switch (name) {
    case "focus_nfe":
      return new FocusNfeProvider();
    case "simulado":
    default:
      return new SimuladoProvider();
  }
}
