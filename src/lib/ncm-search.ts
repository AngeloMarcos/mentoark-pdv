/**
 * Busca de NCM na tabela oficial (public/data/ncm.json, gerada por
 * scripts/build-ncm.mjs). Aceita código (com ou sem pontos) ou palavras.
 */

export type NcmEntry = [code: string, description: string];

export interface NcmIndex {
  versao: string;
  entries: NcmEntry[];
  /** Descrição sem acento e em minúsculas, na mesma ordem de entries. */
  normalized: string[];
}

export const normalizeText = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

export function buildNcmIndex(data: { versao: string; itens: NcmEntry[] }): NcmIndex {
  return { versao: data.versao, entries: data.itens, normalized: data.itens.map(([, d]) => normalizeText(d)) };
}

/** "22021000" -> "2202.10.00" */
export const formatNcm = (code: string): string => {
  const d = code.replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : code;
};

export function searchNcm(index: NcmIndex, query: string, limit = 30): NcmEntry[] {
  const q = query.trim();
  if (!q) return [];
  const digits = q.replace(/[.\s-]/g, "");

  if (/^\d+$/.test(digits)) {
    if (digits.length < 2) return [];
    return index.entries.filter(([c]) => c.startsWith(digits)).slice(0, limit);
  }

  const words = normalizeText(q).split(/\s+/).filter((w) => w.length >= 2);
  if (words.length === 0) return [];
  const scored: Array<{ e: NcmEntry; score: number }> = [];
  index.normalized.forEach((text, i) => {
    if (!words.every((w) => text.includes(w))) return;
    // Palavra no último nível (o item em si) vale mais que na posição genérica.
    const leaf = text.slice(text.lastIndexOf("›") + 1);
    const inLeaf = words.filter((w) => leaf.includes(w)).length;
    scored.push({ e: index.entries[i], score: inLeaf * 1000 - text.length / 100 });
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.e);
}

/** O código existe na tabela vigente? (só dígitos) */
export const ncmExists = (index: NcmIndex, code: string): boolean => {
  const d = code.replace(/\D/g, "");
  return index.entries.some(([c]) => c === d);
};
