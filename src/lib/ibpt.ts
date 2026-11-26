/**
 * Imposto aproximado (Lei 12.741/2012) pela tabela do IBPT.
 *
 * O IBPT gera, para o CNPJ da empresa, um CSV por UF com as alíquotas
 * aproximadas por NCM, no layout:
 *   codigo;ex;tipo;descricao;nacionalfederal;importadosfederal;estadual;municipal;
 *   vigenciainicio;vigenciafim;chave;versao;fonte
 * tipo 0 = NCM (produto); 1 = NBS e 2 = LC 116 (serviços, não usados no PDV).
 *
 * O mesmo cálculo existe no serviço fiscal (infra/fiscal-service/focus-nfce.js).
 */

export interface IbptRate {
  ncm: string;
  ex: string;
  nacional_federal: number;
  importados_federal: number;
  estadual: number;
  municipal: number;
}

export interface IbptMeta {
  uf: string | null;
  versao: string | null;
  chave: string | null;
  fonte: string | null;
  vigencia_inicio: string | null; // AAAA-MM-DD
  vigencia_fim: string | null;
}

export interface IbptParseResult {
  rates: IbptRate[];
  meta: IbptMeta;
  /** Linhas ignoradas por erro de formato (número da linha no arquivo). */
  invalidLines: number[];
}

const REQUIRED = ["codigo", "tipo", "nacionalfederal", "importadosfederal", "estadual", "municipal"] as const;

const num = (v: string | undefined): number => {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/** "31/12/2026" ou "2026-12-31" -> "2026-12-31" */
function isoDate(v: string | undefined): string | null {
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Divide uma linha ";" respeitando aspas (a descrição pode ter ";"). */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === ";" && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** UF pelo nome do arquivo: "TabelaIBPTaxSP26.1.A.csv" -> "SP". */
export function ufFromFileName(name: string): string | null {
  const m = name.match(/IBPTax([A-Z]{2})/i);
  return m ? m[1].toUpperCase() : null;
}

export function parseIbptCsv(text: string, fileName = ""): IbptParseResult {
  const raw = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // BOM do Excel
  const lines = raw.split(/\r?\n/);
  const header = splitLine(lines[0] || "").map((h) => h.trim().toLowerCase());
  const missing = REQUIRED.filter((c) => !header.includes(c));
  if (missing.length) {
    throw new Error(
      `Este arquivo não parece a tabela do IBPT (faltam as colunas: ${missing.join(", ")}). ` +
        "Baixe o CSV em deolhonoimposto.ibpt.org.br.",
    );
  }
  const col = (name: string) => header.indexOf(name);
  const idx = {
    codigo: col("codigo"),
    ex: col("ex"),
    tipo: col("tipo"),
    nf: col("nacionalfederal"),
    imf: col("importadosfederal"),
    est: col("estadual"),
    mun: col("municipal"),
    ini: col("vigenciainicio"),
    fim: col("vigenciafim"),
    chave: col("chave"),
    versao: col("versao"),
    fonte: col("fonte"),
  };

  const byKey = new Map<string, IbptRate>();
  const invalidLines: number[] = [];
  let first: string[] | null = null;

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const c = splitLine(lines[i]);
    if (String(c[idx.tipo] ?? "").trim() !== "0") continue; // só produtos (NCM)
    const ncm = String(c[idx.codigo] ?? "").replace(/\D/g, "");
    const rate: IbptRate = {
      ncm,
      ex: idx.ex >= 0 ? String(c[idx.ex] ?? "").trim() : "",
      nacional_federal: num(c[idx.nf]),
      importados_federal: num(c[idx.imf]),
      estadual: num(c[idx.est]),
      municipal: num(c[idx.mun]),
    };
    const values = [rate.nacional_federal, rate.importados_federal, rate.estadual, rate.municipal];
    if (ncm.length !== 8 || values.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
      invalidLines.push(i + 1);
      continue;
    }
    first ??= c;
    byKey.set(`${rate.ncm}|${rate.ex}`, rate);
  }

  const pick = (k: number) => (first && k >= 0 ? String(first[k] ?? "").trim() || null : null);
  return {
    rates: [...byKey.values()],
    meta: {
      uf: ufFromFileName(fileName),
      versao: pick(idx.versao),
      chave: pick(idx.chave),
      fonte: pick(idx.fonte),
      vigencia_inicio: isoDate(pick(idx.ini) ?? ""),
      vigencia_fim: isoDate(pick(idx.fim) ?? ""),
    },
    invalidLines,
  };
}

/**
 * Origem da mercadoria (0-8) que usa a alíquota federal de importados:
 * 1, 2, 6 e 7 são estrangeiras; as demais são nacionais.
 */
export const isImportedOrigin = (origem: number | string | null | undefined): boolean =>
  [1, 2, 6, 7].includes(Number(origem));

export interface IbptItem {
  ncm: string | null | undefined;
  /** Valor do item já com desconto. */
  total: number;
  origem?: number | string | null;
}

export interface IbptTotals {
  federal: number;
  estadual: number;
  municipal: number;
  total: number;
  /** NCMs da venda que não estão na tabela (o imposto deles fica zerado). */
  missingNcms: string[];
}

const cents = (v: number) => Math.round(v * 100);

/** Procura a alíquota do NCM (sem exceção tarifária; a "ex" vazia é a regra geral). */
export function findRate(rates: Map<string, IbptRate>, ncm: string | null | undefined): IbptRate | undefined {
  const n = String(ncm ?? "").replace(/\D/g, "");
  return rates.get(`${n}|`) ?? rates.get(n);
}

export function indexRates(rates: IbptRate[]): Map<string, IbptRate> {
  const m = new Map<string, IbptRate>();
  for (const r of rates) m.set(`${r.ncm}|${r.ex || ""}`, r);
  return m;
}

/** Soma, item a item e em centavos, o imposto aproximado da venda. */
export function calcIbpt(items: IbptItem[], rates: Map<string, IbptRate>): IbptTotals {
  let fed = 0;
  let est = 0;
  let mun = 0;
  const missing = new Set<string>();
  for (const it of items) {
    const rate = findRate(rates, it.ncm);
    if (!rate) {
      missing.add(String(it.ncm || "sem NCM"));
      continue;
    }
    const base = Math.max(0, Number(it.total) || 0);
    const fedPct = isImportedOrigin(it.origem) ? rate.importados_federal : rate.nacional_federal;
    fed += cents((base * fedPct) / 100);
    est += cents((base * rate.estadual) / 100);
    mun += cents((base * rate.municipal) / 100);
  }
  return {
    federal: fed / 100,
    estadual: est / 100,
    municipal: mun / 100,
    total: (fed + est + mun) / 100,
    missingNcms: [...missing],
  };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto do cupom, no formato que o IBPT recomenda. */
export function transparencyText(t: IbptTotals, meta?: Pick<IbptMeta, "chave" | "fonte"> | null): string {
  const fonte = [meta?.fonte || "IBPT", meta?.chave].filter(Boolean).join(" ");
  return (
    `Trib. aprox.: ${brl(t.federal)} Federal, ${brl(t.estadual)} Estadual e ${brl(t.municipal)} Municipal. ` +
    `Fonte: ${fonte}`
  ).split(String.fromCharCode(0xa0)).join(" "); // toLocaleString usa espaço não separável
}

/** A tabela vence hoje ou já venceu? (datas AAAA-MM-DD, comparação por dia) */
export function ibptExpired(vigenciaFim: string | null | undefined, today = new Date()): boolean {
  if (!vigenciaFim) return true;
  const t = today.toISOString().slice(0, 10);
  return vigenciaFim < t;
}
