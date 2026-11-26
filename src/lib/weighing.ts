/**
 * Venda por peso/medida e etiqueta de balança.
 *
 * Produto "fracionado" é o que tem unidade KG, L ou M no cadastro: a
 * quantidade aceita até 3 casas (0,375 kg). O banco guarda numeric(14,3).
 */
import { validateEAN } from "./barcode-utils";

export const FRACTIONAL_UNITS = ["KG", "L", "M"] as const;
export const QTY_DECIMALS = 3;

export const sellsFractional = (unit?: string | null): boolean =>
  FRACTIONAL_UNITS.includes(String(unit || "").toUpperCase() as (typeof FRACTIONAL_UNITS)[number]);

export const roundQty = (q: number): number => Math.round((Number(q) || 0) * 1000) / 1000;

/** "0,375 kg" para fracionado, "3" para unidade. */
export function formatQty(quantity: number, unit?: string | null): string {
  if (!sellsFractional(unit) && Number.isInteger(quantity)) return String(quantity);
  const n = quantity.toLocaleString("pt-BR", {
    minimumFractionDigits: QTY_DECIMALS,
    maximumFractionDigits: QTY_DECIMALS,
  });
  return unit ? `${n} ${unit.toLowerCase()}` : n;
}

/** Aceita "0,375", "0.375", "1,2". Devolve null se não for um número > 0. */
export function parseQty(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d*\.?\d+$/.test(cleaned)) return null;
  const q = roundQty(Number(cleaned));
  return q > 0 ? q : null;
}

/**
 * Formato da etiqueta (EAN-13) que a balança imprime. Lido da esquerda:
 *   [prefixo][código do produto][zeros de enchimento][valor][dígito verificador]
 * O valor fica sempre logo antes do dígito verificador.
 * Ex. com prefixo "2", código 4, valor 6:  2 0123 0 001496 X
 */
export interface ScaleBarcodeConfig {
  enabled: boolean;
  prefix: string;
  code_length: number;
  value_length: number;
  /** price = preço total em centavos; weight = peso em gramas. */
  value_type: "price" | "weight";
}

export const DEFAULT_SCALE_CONFIG: ScaleBarcodeConfig = {
  enabled: false,
  prefix: "2",
  code_length: 4,
  value_length: 6,
  value_type: "price",
};

export function normalizeScaleConfig(raw: unknown): ScaleBarcodeConfig {
  const c = { ...DEFAULT_SCALE_CONFIG, ...((raw as Partial<ScaleBarcodeConfig>) || {}) };
  return {
    enabled: !!c.enabled,
    prefix: String(c.prefix || "2").replace(/\D/g, "").slice(0, 2) || "2",
    code_length: Math.min(6, Math.max(4, Number(c.code_length) || 4)),
    value_length: Math.min(6, Math.max(5, Number(c.value_length) || 6)),
    value_type: c.value_type === "weight" ? "weight" : "price",
  };
}

export interface ScaleLabel {
  /** Código do produto na balança, sem zeros à esquerda. */
  productCode: string;
  /** Preço total impresso (R$), quando a etiqueta é de preço. */
  price?: number;
  /** Peso em kg, quando a etiqueta é de peso. */
  weight?: number;
}

/** Lê uma etiqueta de balança. Devolve null se o código não for desse formato. */
export function parseScaleBarcode(code: string, config: ScaleBarcodeConfig): ScaleLabel | null {
  const c = code.trim();
  if (!config.enabled || c.length !== 13 || !/^\d{13}$/.test(c)) return null;
  if (!c.startsWith(config.prefix)) return null;
  if (config.prefix.length + config.code_length + config.value_length + 1 > 13) return null;
  if (!validateEAN(c)) return null;

  const codeStart = config.prefix.length;
  const productCode = String(Number(c.slice(codeStart, codeStart + config.code_length)));
  const value = Number(c.slice(12 - config.value_length, 12));
  if (!value) return null;

  return config.value_type === "price"
    ? { productCode, price: value / 100 }
    : { productCode, weight: roundQty(value / 1000) };
}

/** O código interno do produto bate com o da etiqueta? (ignora zeros à esquerda) */
export function matchesScaleCode(internalCode: string | null | undefined, productCode: string): boolean {
  const digits = String(internalCode || "").replace(/\D/g, "");
  return digits !== "" && String(Number(digits)) === productCode;
}

/**
 * Quantidade a lançar a partir da etiqueta. Etiqueta de preço vira peso
 * dividindo pelo preço do quilo (3 casas): o total pode diferir da etiqueta
 * em alguns centavos, porque o banco recalcula qtd x preço do cadastro.
 */
export function quantityFromLabel(label: ScaleLabel, unitPrice: number): number | null {
  if (label.weight) return label.weight;
  if (label.price && unitPrice > 0) {
    const q = roundQty(label.price / unitPrice);
    return q > 0 ? q : null;
  }
  return null;
}
