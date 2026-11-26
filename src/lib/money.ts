/**
 * Utilitários de dinheiro do PDV.
 *
 * Todos os cálculos de venda passam por aqui para evitar erros de ponto
 * flutuante do JavaScript (ex.: 0.1 + 0.2 = 0.30000000000000004).
 * Regra: arredondar para centavos em cada etapa e comparar valores em centavos.
 */

/** Converte reais para centavos inteiros (arredondamento comercial). */
export function toCents(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // Number.EPSILON corrige casos como 1.005 → 101 centavos
  return Math.round((value + Math.sign(value) * Number.EPSILON) * 100);
}

/** Arredonda um valor em reais para 2 casas decimais. */
export function round2(value: number): number {
  return toCents(value) / 100;
}

/** Soma valores em reais sem acumular erro de ponto flutuante. */
export function sumMoney(values: number[]): number {
  return values.reduce((acc, v) => acc + toCents(v), 0) / 100;
}

export type PromoDiscountType = "percentage" | "fixed";

export interface CartLine {
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  /** Dados da promoção aplicada, para recalcular quando a quantidade muda */
  promo_discount_type?: PromoDiscountType | null;
  promo_discount_value?: number | null;
}

/** Desconto da promoção para a quantidade informada (em reais, 2 casas). */
export function calcLineDiscount(
  type: PromoDiscountType | null | undefined,
  value: number | null | undefined,
  unitPrice: number,
  quantity: number,
): number {
  if (!type || !value || value <= 0 || quantity <= 0) return 0;
  const gross = round2(unitPrice * quantity);
  const raw =
    type === "percentage"
      ? gross * (Math.min(value, 100) / 100)
      : value * quantity; // fixed = R$ por unidade
  // desconto nunca maior que o valor bruto do item
  return Math.min(round2(raw), gross);
}

/**
 * Recalcula desconto e total de uma linha do carrinho.
 * Se houver promoção aplicada, o desconto acompanha a quantidade.
 */
export function recalcLine<T extends CartLine>(line: T, quantity = line.quantity): T {
  const gross = round2(line.unit_price * quantity);
  const discount = line.promo_discount_type
    ? calcLineDiscount(line.promo_discount_type, line.promo_discount_value, line.unit_price, quantity)
    : Math.min(round2(line.discount), gross);
  return { ...line, quantity, discount, total: round2(gross - discount) };
}

/** Totais do carrinho, já arredondados em centavos. */
export function cartTotals(lines: CartLine[]) {
  const grossTotal = sumMoney(lines.map((l) => round2(l.quantity * l.unit_price)));
  const discountTotal = sumMoney(lines.map((l) => l.discount));
  const netTotal = round2(grossTotal - discountTotal);
  return { grossTotal, discountTotal, netTotal };
}
