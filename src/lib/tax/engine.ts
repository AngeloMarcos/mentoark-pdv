/**
 * Motor de cálculo da Reforma Tributária do Consumo (EC 132/2023, LC 214/2025).
 *
 * Código puro, sem dependência de DOM/React/Supabase: roda igual no thread
 * principal, no Web Worker (src/workers/tax.worker.ts) e nos testes.
 *
 * Regras aplicadas:
 *  - IBS (UF + Município) e CBS incidem sobre o valor da operação, líquido de
 *    descontos incondicionais (LC 214/2025, art. 12). O desconto entra ANTES
 *    da base — nunca depois do imposto.
 *  - IBS e CBS não integram a própria base ("por fora").
 *  - O Imposto Seletivo (IS) integra a base do IBS/CBS e só existe para as
 *    categorias configuradas (regras por prefixo de NCM ou categoria).
 *  - Valores monetários arredondados em centavos por item; os totais são a
 *    soma dos itens (mesma regra do XML da NF-e).
 */

export type TaxPriceMode = "informativo" | "por_dentro" | "por_fora";

export interface IsRule {
  id: string;
  label: string;
  /** Como o produto é casado com a regra. */
  match: "ncm_prefix" | "category";
  /** Prefixo de NCM (só dígitos) ou nome da categoria. */
  value: string;
  /** Alíquota do IS em %. */
  aliquota: number;
  active: boolean;
  cst?: string;
  cClassTrib?: string;
}

export interface TaxConfig {
  /** Liga o cálculo/destaque de IBS, CBS e IS. */
  enabled: boolean;
  /**
   * informativo: base = valor líquido; tributos destacados, não alteram o total (ano-teste 2026).
   * por_dentro:  o preço de venda já contém os tributos; a base é extraída do preço.
   * por_fora:    tributos somados ao valor líquido.
   */
  modo: TaxPriceMode;
  /** Alíquotas em % (ex.: 0.9 = 0,9%). */
  cbs: number;
  ibs_uf: number;
  ibs_mun: number;
  is_rules: IsRule[];
}

/** Atributos tributários do produto (products.extra_attributes.tax). */
export interface ProductTax {
  /** CST do IBS/CBS (3 dígitos). */
  cst_ibscbs?: string | null;
  /** Código de Classificação Tributária (6 dígitos). */
  cclasstrib?: string | null;
  /** Redução de alíquota em % (pRedAliq): 60 = cesta/saúde/educação, 100 = alíquota zero. */
  reducao?: number | null;
  /** Alíquota de IS específica do produto (%). Sobrepõe as regras. 0 = sem IS. */
  is_aliquota?: number | null;
}

export interface TaxItemInput {
  key: string;
  quantity: number;
  unit_price: number;
  /** Desconto incondicional do item, em R$. */
  discount?: number | null;
  ncm?: string | null;
  category?: string | null;
  tax?: ProductTax | null;
}

export interface TaxItemResult {
  key: string;
  vProd: number;
  vDesc: number;
  /** vProd - vDesc */
  vLiquido: number;
  is: {
    cst: string;
    cClassTrib: string;
    vBC: number;
    p: number;
    v: number;
    regra: string | null;
  } | null;
  ibscbs: {
    cst: string;
    cClassTrib: string;
    vBC: number;
    pIBSUF: number;
    pIBSMun: number;
    pCBS: number;
    pRedAliq: number;
    pIBSUFEfet: number;
    pIBSMunEfet: number;
    pCBSEfet: number;
    vIBSUF: number;
    vIBSMun: number;
    vIBS: number;
    vCBS: number;
  };
  /** IS + IBS + CBS */
  vTributos: number;
  /** Valor final do item para o consumidor. */
  vTotal: number;
}

export interface TaxTotals {
  vProd: number;
  vDesc: number;
  vLiquido: number;
  vBCIS: number;
  vIS: number;
  vBCIBSCBS: number;
  vIBSUF: number;
  vIBSMun: number;
  vIBS: number;
  vCBS: number;
  vTributos: number;
  vTotal: number;
}

export interface TaxResult {
  items: TaxItemResult[];
  totals: TaxTotals;
  warnings: string[];
}

/** Ano-teste 2026 (LC 214/2025, art. 343 e ss.): CBS 0,9% + IBS 0,1%. */
export const ALIQUOTAS_TESTE_2026 = { cbs: 0.9, ibs_uf: 0.1, ibs_mun: 0 } as const;

/**
 * Exemplos de regras de IS, inativas e com alíquota zero: as alíquotas do IS
 * dependem de lei ordinária e devem ser preenchidas pelo contador.
 */
export const IS_RULE_PRESETS: IsRule[] = [
  { id: "fumo", label: "Produtos fumígenos", match: "ncm_prefix", value: "24", aliquota: 0, active: false },
  { id: "alcool", label: "Bebidas alcoólicas", match: "ncm_prefix", value: "2203", aliquota: 0, active: false },
  { id: "acucaradas", label: "Bebidas açucaradas", match: "ncm_prefix", value: "2202", aliquota: 0, active: false },
];

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  enabled: false,
  modo: "informativo",
  ...ALIQUOTAS_TESTE_2026,
  is_rules: [],
};

export const CST_IBSCBS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "000", label: "000 - Tributação integral" },
  { value: "010", label: "010 - Tributação com alíquotas uniformes" },
  { value: "011", label: "011 - Alíquotas uniformes reduzidas" },
  { value: "200", label: "200 - Alíquota reduzida" },
  { value: "220", label: "220 - Alíquota fixa" },
  { value: "400", label: "400 - Isenção" },
  { value: "410", label: "410 - Imunidade e não incidência" },
  { value: "510", label: "510 - Diferimento" },
  { value: "550", label: "550 - Suspensão" },
  { value: "620", label: "620 - Tributação monofásica" },
  { value: "800", label: "800 - Transferência de crédito" },
  { value: "900", label: "900 - Outros" },
];

/** CSTs em que não há débito de IBS/CBS na operação. */
const CST_SEM_DEBITO = new Set(["400", "410", "510", "550", "620"]);

export const round2 = (v: number): number => {
  const r = Math.round((Math.abs(v) + 1e-9) * 100) / 100;
  return v < 0 ? -r : r;
};

const num = (v: unknown, fallback = 0): number => {
  const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const onlyDigits = (v?: string | null) => (v || "").replace(/\D/g, "");

/** Converte o que vier de tenants.settings.fiscal.reforma numa config válida. */
export function normalizeTaxConfig(raw: unknown): TaxConfig {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const modo: TaxPriceMode =
    r.modo === "por_dentro" || r.modo === "por_fora" ? r.modo : "informativo";
  const rules = Array.isArray(r.is_rules) ? r.is_rules : [];
  return {
    enabled: !!r.enabled,
    modo,
    cbs: clamp(num(r.cbs, DEFAULT_TAX_CONFIG.cbs), 0, 100),
    ibs_uf: clamp(num(r.ibs_uf, DEFAULT_TAX_CONFIG.ibs_uf), 0, 100),
    ibs_mun: clamp(num(r.ibs_mun, DEFAULT_TAX_CONFIG.ibs_mun), 0, 100),
    is_rules: rules
      .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
      .map((x, i) => ({
        id: String(x.id ?? `regra-${i}`),
        label: String(x.label ?? ""),
        match: x.match === "category" ? ("category" as const) : ("ncm_prefix" as const),
        value: String(x.value ?? ""),
        aliquota: clamp(num(x.aliquota), 0, 1000),
        active: !!x.active,
        cst: x.cst ? String(x.cst) : undefined,
        cClassTrib: x.cClassTrib ? String(x.cClassTrib) : undefined,
      })),
  };
}

/** Lê os atributos tributários de uma linha de produto (products.*). */
export function productTaxFields(product: unknown): Pick<TaxItemInput, "ncm" | "category" | "tax"> {
  const p = (product && typeof product === "object" ? product : {}) as Record<string, unknown>;
  const extra = (p.extra_attributes && typeof p.extra_attributes === "object"
    ? p.extra_attributes
    : {}) as Record<string, unknown>;
  const tax = extra.tax && typeof extra.tax === "object" ? (extra.tax as ProductTax) : null;
  return {
    ncm: typeof p.ncm === "string" ? p.ncm : null,
    category: typeof p.category === "string" ? p.category : null,
    tax,
  };
}

/** Regra de IS aplicável ao item, ou null. A alíquota do produto tem precedência. */
export function resolveIs(
  item: TaxItemInput,
  rules: IsRule[]
): { aliquota: number; regra: string; cst: string; cClassTrib: string } | null {
  const override = item.tax?.is_aliquota;
  if (override !== null && override !== undefined && Number.isFinite(Number(override))) {
    const a = Number(override);
    return a > 0 ? { aliquota: a, regra: "produto", cst: "000", cClassTrib: "000001" } : null;
  }
  const ncm = onlyDigits(item.ncm);
  const category = (item.category || "").trim().toLowerCase();
  for (const rule of rules) {
    if (!rule.active || !(rule.aliquota > 0)) continue;
    const value = rule.match === "ncm_prefix" ? onlyDigits(rule.value) : rule.value.trim().toLowerCase();
    if (!value) continue;
    const hit = rule.match === "ncm_prefix" ? ncm.length > 0 && ncm.startsWith(value) : category === value;
    if (hit) {
      return {
        aliquota: rule.aliquota,
        regra: rule.label || rule.id,
        cst: rule.cst || "000",
        cClassTrib: rule.cClassTrib || "000001",
      };
    }
  }
  return null;
}

function calcItem(item: TaxItemInput, config: TaxConfig, warnings: string[]): TaxItemResult {
  const vProd = round2(num(item.quantity) * num(item.unit_price));
  const vDesc = clamp(round2(num(item.discount)), 0, vProd);
  const vLiquido = round2(vProd - vDesc);

  const pRedAliq = clamp(num(item.tax?.reducao), 0, 100);
  const cst = (item.tax?.cst_ibscbs || (pRedAliq > 0 ? "200" : "000")).padStart(3, "0");
  let cClassTrib = onlyDigits(item.tax?.cclasstrib);
  if (!cClassTrib) {
    cClassTrib = "000001";
    if (cst !== "000") {
      warnings.push(`Item ${item.key}: CST ${cst} sem cClassTrib informado; usado 000001.`);
    }
  }
  const semDebito = CST_SEM_DEBITO.has(cst);
  const fator = semDebito ? 0 : 1 - pRedAliq / 100;
  const pIBSUFEfet = config.ibs_uf * fator;
  const pIBSMunEfet = config.ibs_mun * fator;
  const pCBSEfet = config.cbs * fator;
  const r = (pIBSUFEfet + pIBSMunEfet + pCBSEfet) / 100;

  const isRule = resolveIs(item, config.is_rules);
  const s = isRule ? isRule.aliquota / 100 : 0;

  // Base do IS (valor da operação sem tributos) e base do IBS/CBS (inclui o IS).
  let vBCIS: number;
  let vIS: number;
  let vBC: number;
  if (config.modo === "por_dentro") {
    // preço = base × (1 + IS) × (1 + IBS + CBS)
    vBC = round2(vLiquido / (1 + r));
    vBCIS = round2(vBC / (1 + s));
    vIS = round2(vBC - vBCIS);
  } else {
    vBCIS = vLiquido;
    vIS = round2(vBCIS * s);
    vBC = round2(vLiquido + vIS);
  }

  const vIBSUF = round2((vBC * pIBSUFEfet) / 100);
  const vIBSMun = round2((vBC * pIBSMunEfet) / 100);
  const vCBS = round2((vBC * pCBSEfet) / 100);
  const vIBS = round2(vIBSUF + vIBSMun);
  const vTributos = round2(vIS + vIBS + vCBS);
  const vTotal = config.modo === "por_fora" ? round2(vLiquido + vTributos) : vLiquido;

  return {
    key: item.key,
    vProd,
    vDesc,
    vLiquido,
    is: isRule
      ? { cst: isRule.cst, cClassTrib: isRule.cClassTrib, vBC: vBCIS, p: isRule.aliquota, v: vIS, regra: isRule.regra }
      : null,
    ibscbs: {
      cst,
      cClassTrib,
      vBC,
      pIBSUF: config.ibs_uf,
      pIBSMun: config.ibs_mun,
      pCBS: config.cbs,
      pRedAliq: semDebito ? 0 : pRedAliq,
      pIBSUFEfet,
      pIBSMunEfet,
      pCBSEfet,
      vIBSUF,
      vIBSMun,
      vIBS,
      vCBS,
    },
    vTributos,
    vTotal,
  };
}

export function emptyTotals(): TaxTotals {
  return {
    vProd: 0, vDesc: 0, vLiquido: 0, vBCIS: 0, vIS: 0, vBCIBSCBS: 0,
    vIBSUF: 0, vIBSMun: 0, vIBS: 0, vCBS: 0, vTributos: 0, vTotal: 0,
  };
}

function addItem(t: TaxTotals, it: TaxItemResult): void {
  t.vProd += it.vProd;
  t.vDesc += it.vDesc;
  t.vLiquido += it.vLiquido;
  t.vBCIS += it.is ? it.is.vBC : 0;
  t.vIS += it.is ? it.is.v : 0;
  t.vBCIBSCBS += it.ibscbs.vBC;
  t.vIBSUF += it.ibscbs.vIBSUF;
  t.vIBSMun += it.ibscbs.vIBSMun;
  t.vIBS += it.ibscbs.vIBS;
  t.vCBS += it.ibscbs.vCBS;
  t.vTributos += it.vTributos;
  t.vTotal += it.vTotal;
}

function roundTotals(t: TaxTotals): TaxTotals {
  const out = { ...t };
  (Object.keys(out) as Array<keyof TaxTotals>).forEach((k) => {
    out[k] = round2(out[k]);
  });
  return out;
}

/** Calcula IBS, CBS e IS de uma lista de itens (carrinho ou venda). */
export function calculateTaxes(items: TaxItemInput[], config: TaxConfig): TaxResult {
  const warnings: string[] = [];
  const totals = emptyTotals();
  const results = items.map((item) => {
    const res = calcItem(item, config, warnings);
    addItem(totals, res);
    return res;
  });
  return { items: results, totals: roundTotals(totals), warnings };
}

/* ------------------------------------------------------------------ */
/* Relatório de tributos (diário / mensal)                             */
/* ------------------------------------------------------------------ */

export interface TaxReportSale {
  id: string;
  /** ISO datetime da venda. */
  datetime: string;
  items: TaxItemInput[];
}

export interface TaxReportRow extends TaxTotals {
  periodo: string;
  vendas: number;
  itens: number;
}

export interface TaxReportClassRow {
  cst: string;
  cClassTrib: string;
  itens: number;
  vBCIBSCBS: number;
  vIBS: number;
  vCBS: number;
  vIS: number;
}

export interface TaxReport {
  rows: TaxReportRow[];
  byClass: TaxReportClassRow[];
  totals: TaxTotals & { vendas: number; itens: number };
}

/** Chave de período em horário local do Brasil (UTC-3), sem depender de Intl. */
function periodKey(iso: string, groupBy: "day" | "month"): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "sem-data";
  const local = new Date(t - 3 * 60 * 60 * 1000).toISOString();
  return groupBy === "month" ? local.slice(0, 7) : local.slice(0, 10);
}

export function aggregateTaxReport(
  sales: TaxReportSale[],
  config: TaxConfig,
  groupBy: "day" | "month"
): TaxReport {
  const periods = new Map<string, { totals: TaxTotals; vendas: number; itens: number }>();
  const classes = new Map<string, TaxReportClassRow>();
  const grand = emptyTotals();
  let vendas = 0;
  let itens = 0;

  for (const sale of sales) {
    const key = periodKey(sale.datetime, groupBy);
    let bucket = periods.get(key);
    if (!bucket) {
      bucket = { totals: emptyTotals(), vendas: 0, itens: 0 };
      periods.set(key, bucket);
    }
    bucket.vendas += 1;
    vendas += 1;
    const res = calculateTaxes(sale.items, config);
    for (const it of res.items) {
      addItem(bucket.totals, it);
      addItem(grand, it);
      bucket.itens += 1;
      itens += 1;
      const ck = `${it.ibscbs.cst}|${it.ibscbs.cClassTrib}`;
      let c = classes.get(ck);
      if (!c) {
        c = { cst: it.ibscbs.cst, cClassTrib: it.ibscbs.cClassTrib, itens: 0, vBCIBSCBS: 0, vIBS: 0, vCBS: 0, vIS: 0 };
        classes.set(ck, c);
      }
      c.itens += 1;
      c.vBCIBSCBS += it.ibscbs.vBC;
      c.vIBS += it.ibscbs.vIBS;
      c.vCBS += it.ibscbs.vCBS;
      c.vIS += it.is ? it.is.v : 0;
    }
  }

  const rows = Array.from(periods.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([periodo, b]) => ({ periodo, vendas: b.vendas, itens: b.itens, ...roundTotals(b.totals) }));

  const byClass = Array.from(classes.values())
    .sort((a, b) => (a.cst + a.cClassTrib).localeCompare(b.cst + b.cClassTrib))
    .map((c) => ({
      ...c,
      vBCIBSCBS: round2(c.vBCIBSCBS),
      vIBS: round2(c.vIBS),
      vCBS: round2(c.vCBS),
      vIS: round2(c.vIS),
    }));

  return { rows, byClass, totals: { ...roundTotals(grand), vendas, itens } };
}

/* ------------------------------------------------------------------ */
/* ICMS-ST (regime antigo, convive com IBS/CBS até 2032)               */
/* ------------------------------------------------------------------ */

export interface IcmsStInput {
  /** Valor da operação própria (produto - desconto + frete/despesas). */
  valorOperacao: number;
  /** IPI, quando compõe a base da ST. */
  ipi?: number;
  /** Margem de Valor Agregado em %. */
  mva: number;
  /** Alíquota interna do estado de destino, em %. */
  aliquotaInterna: number;
  /** Alíquota da operação própria (interna ou interestadual), em %. */
  aliquotaPropria: number;
}

/** ICMS-ST devido pelo substituto: base com MVA, menos o ICMS próprio. */
export function calcIcmsSt(input: IcmsStInput): {
  vBC: number;
  vICMS: number;
  vBCST: number;
  vICMSST: number;
} {
  const vBC = round2(num(input.valorOperacao));
  const vICMS = round2((vBC * num(input.aliquotaPropria)) / 100);
  const vBCST = round2((vBC + num(input.ipi)) * (1 + num(input.mva) / 100));
  const vICMSST = Math.max(0, round2((vBCST * num(input.aliquotaInterna)) / 100 - vICMS));
  return { vBC, vICMS, vBCST, vICMSST };
}
