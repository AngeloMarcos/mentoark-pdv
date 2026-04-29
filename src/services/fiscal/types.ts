// Pluggable fiscal provider interface
// Allows switching between simulated mode and real APIs (Focus NFe, eNotas, etc.)

export interface FiscalEmitPayload {
  tenant_id: string;
  sale_id: string;
  document_type: "nfce" | "nfe";
  serie: string;
  numero: number;
  ambiente: "homologacao" | "producao";
  empresa: {
    name: string;
    cnpj: string;
    ie?: string;
    uf?: string;
    municipio_ibge?: string;
  };
  customer?: {
    name?: string;
    document?: string;
  } | null;
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    ncm?: string | null;
    cfop?: string | null;
    csosn?: string | null;
    unidade?: string | null;
    ean?: string | null;
  }>;
  totals: {
    gross: number;
    discount: number;
    net: number;
  };
  payment_method: string;
}

export interface FiscalEmitResult {
  status: "autorizado" | "rejeitado" | "pendente";
  chave_acesso: string;
  protocolo: string;
  xml_content: string;
  numero: number;
  serie: string;
  valor_total: number;
  valor_impostos: number;
  ambiente: "homologacao" | "producao";
  message?: string;
}

export interface FiscalCancelResult {
  status: "cancelado" | "rejeitado";
  protocolo_cancelamento: string;
  message?: string;
}

export interface FiscalProvider {
  readonly name: string;
  emit(payload: FiscalEmitPayload): Promise<FiscalEmitResult>;
  cancel(chave: string, reason: string): Promise<FiscalCancelResult>;
}
