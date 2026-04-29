// Fiscal utilities — local generation of NFC-e (no SEFAZ integration)

export interface FiscalCompany {
  name: string;
  cnpj?: string;
  ie?: string;
  address?: string;
  uf?: string;
  municipio_ibge?: string;
}

export interface FiscalItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total: number;
  ncm?: string | null;
  cfop?: string | null;
  csosn?: string | null;
  cst_icms?: string | null;
  unidade?: string | null;
  ean?: string | null;
  icms_aliquota?: number | null;
  pis_aliquota?: number | null;
  cofins_aliquota?: number | null;
}

export interface FiscalSale {
  id: string;
  numero: number;
  serie: string;
  datetime: Date;
  net_total: number;
  discount_total: number;
  payment_method: string;
  ambiente: "homologacao" | "producao";
  chave: string;
}

const UF_CODES: Record<string, string> = {
  AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53",
  ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15",
  PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43",
  RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17",
};

export function getUfCode(uf?: string): string {
  return UF_CODES[(uf || "SP").toUpperCase()] || "35";
}

/** Calcula DV módulo 11 sobre 43 dígitos. */
export function calcDV(chave43: string): number {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let sum = 0;
  for (let i = 0; i < 43; i++) {
    const digit = parseInt(chave43[42 - i], 10);
    sum += digit * pesos[i % 8];
  }
  let dv = 11 - (sum % 11);
  if (dv >= 10) dv = 0;
  return dv;
}

/** Gera chave de acesso 44 dígitos (sem SEFAZ) */
export function generateChaveAcesso(params: {
  uf: string;
  cnpj: string;
  serie: string | number;
  numero: number;
  date?: Date;
}): string {
  const date = params.date || new Date();
  const cuf = getUfCode(params.uf);
  const aamm =
    String(date.getFullYear()).slice(-2) +
    String(date.getMonth() + 1).padStart(2, "0");
  const cnpj = (params.cnpj || "").replace(/\D/g, "").padStart(14, "0").slice(0, 14);
  const mod = "65";
  const serie = String(params.serie).padStart(3, "0");
  const numero = String(params.numero).padStart(9, "0");
  const tpEmis = "1";
  const cnf = String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const base = cuf + aamm + cnpj + mod + serie + numero + tpEmis + cnf;
  const dv = calcDV(base);
  return base + String(dv);
}

export function formatChave(chave: string): string {
  return chave.replace(/(.{4})/g, "$1 ").trim();
}

/** Lei 12.741: estimativa simples de impostos (~5% para Simples Nacional) */
export function calcImpostosAproximados(items: FiscalItem[]): number {
  const total = items.reduce((s, i) => s + i.total, 0);
  return Math.round(total * 0.05 * 100) / 100;
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Monta XML NFC-e simplificado (sem assinatura digital) */
export function buildNFCeXML(
  sale: FiscalSale,
  empresa: FiscalCompany,
  items: FiscalItem[]
): string {
  const cnpj = (empresa.cnpj || "").replace(/\D/g, "").padStart(14, "0");
  const tpAmb = sale.ambiente === "producao" ? "1" : "2";
  const dhEmi = sale.datetime.toISOString().replace(/\.\d{3}Z$/, "-03:00");
  const totalImpostos = calcImpostosAproximados(items);

  const det = items
    .map((it, idx) => {
      const nItem = idx + 1;
      const qCom = it.quantity.toFixed(4);
      const vUnCom = it.unit_price.toFixed(4);
      const vProd = it.total.toFixed(2);
      const ean = it.ean || "SEM GTIN";
      return `  <det nItem="${nItem}">
    <prod>
      <cProd>${escapeXml(it.product_id.slice(0, 60))}</cProd>
      <cEAN>${escapeXml(ean)}</cEAN>
      <xProd>${escapeXml(it.product_name)}</xProd>
      <NCM>${escapeXml(it.ncm || "00000000")}</NCM>
      <CFOP>${escapeXml(it.cfop || "5102")}</CFOP>
      <uCom>${escapeXml(it.unidade || "UN")}</uCom>
      <qCom>${qCom}</qCom>
      <vUnCom>${vUnCom}</vUnCom>
      <vProd>${vProd}</vProd>
      <cEANTrib>${escapeXml(ean)}</cEANTrib>
      <uTrib>${escapeXml(it.unidade || "UN")}</uTrib>
      <qTrib>${qCom}</qTrib>
      <vUnTrib>${vUnCom}</vUnTrib>
      <indTot>1</indTot>
    </prod>
    <imposto>
      <ICMS>
        <ICMSSN102>
          <orig>0</orig>
          <CSOSN>${escapeXml(it.csosn || "400")}</CSOSN>
        </ICMSSN102>
      </ICMS>
      <PIS><PISNT><CST>07</CST></PISNT></PIS>
      <COFINS><COFINSNT><CST>07</CST></COFINSNT></COFINS>
    </imposto>
  </det>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
  <infNFe Id="NFe${sale.chave}" versao="4.00">
    <ide>
      <cUF>${getUfCode(empresa.uf)}</cUF>
      <natOp>VENDA AO CONSUMIDOR</natOp>
      <mod>65</mod>
      <serie>${escapeXml(String(sale.serie))}</serie>
      <nNF>${sale.numero}</nNF>
      <dhEmi>${dhEmi}</dhEmi>
      <tpNF>1</tpNF>
      <idDest>1</idDest>
      <cMunFG>${escapeXml(empresa.municipio_ibge || "3550308")}</cMunFG>
      <tpImp>4</tpImp>
      <tpEmis>1</tpEmis>
      <tpAmb>${tpAmb}</tpAmb>
      <finNFe>1</finNFe>
      <indFinal>1</indFinal>
      <indPres>1</indPres>
    </ide>
    <emit>
      <CNPJ>${cnpj}</CNPJ>
      <xNome>${escapeXml(empresa.name)}</xNome>
      <IE>${escapeXml(empresa.ie || "")}</IE>
      <CRT>1</CRT>
    </emit>
${det}
    <total>
      <ICMSTot>
        <vBC>0.00</vBC>
        <vICMS>0.00</vICMS>
        <vProd>${sale.net_total.toFixed(2)}</vProd>
        <vDesc>${(sale.discount_total || 0).toFixed(2)}</vDesc>
        <vNF>${sale.net_total.toFixed(2)}</vNF>
        <vTotTrib>${totalImpostos.toFixed(2)}</vTotTrib>
      </ICMSTot>
    </total>
    <pag>
      <detPag>
        <tPag>01</tPag>
        <vPag>${sale.net_total.toFixed(2)}</vPag>
      </detPag>
    </pag>
    <infAdic>
      <infCpl>DOCUMENTO SEM VALOR FISCAL - AMBIENTE DE ${tpAmb === "1" ? "PRODUCAO" : "HOMOLOGACAO"}</infCpl>
    </infAdic>
  </infNFe>
</NFe>`;
}

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

export const FISCAL_STATUS_LABELS: Record<string, string> = {
  simulado: "Simulado",
  pendente: "Pendente",
  autorizado: "Autorizado",
  cancelado: "Cancelado",
  rejeitado: "Rejeitado",
};

export const FISCAL_STATUS_COLORS: Record<string, string> = {
  simulado: "bg-muted text-foreground",
  pendente: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  autorizado: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelado: "bg-destructive/15 text-destructive",
  rejeitado: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};
