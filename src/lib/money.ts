/**
 * Conta de dinheiro do PDV. Tudo que compara ou soma valores passa por aqui,
 * em centavos inteiros, para não depender de ponto flutuante
 * (0,1 + 0,2 !== 0,3 e o famoso "Faltam R$ 0,00").
 *
 * O banco (checkout_sale_transaction) arredonda cada linha a centavos;
 * as funções de linha abaixo seguem a mesma regra.
 */

export const toCents = (value: number): number => Math.round((Number(value) || 0) * 100);
export const fromCents = (cents: number): number => cents / 100;
export const round2 = (value: number): number => fromCents(toCents(value));

/** Bruto de uma linha, arredondado como no banco: ROUND(qtd * preço, 2). */
export const lineGross = (quantity: number, unitPrice: number): number =>
  round2(quantity * unitPrice);

export interface MoneyLine {
  quantity: number;
  unit_price: number;
  discount: number;
}

export function cartTotals(lines: MoneyLine[]) {
  let gross = 0;
  let discount = 0;
  for (const l of lines) {
    gross += toCents(lineGross(l.quantity, l.unit_price));
    discount += toCents(l.discount);
  }
  return { grossTotal: fromCents(gross), discountTotal: fromCents(discount), netTotal: fromCents(gross - discount) };
}

export interface PaymentDraft {
  /** Quanto essa forma abate da venda. */
  amount: number;
  /** Só para formas com troco: quanto o cliente entregou. */
  receivedAmount?: number;
  requiresChange: boolean;
}

/** Troco de uma forma: só existe em forma com troco e quando o entregue passa do valor. */
export function paymentChange(p: PaymentDraft): number {
  if (!p.requiresChange || !p.receivedAmount) return 0;
  return Math.max(0, fromCents(toCents(p.receivedAmount) - toCents(p.amount)));
}

/**
 * Situação do pagamento frente ao total.
 * - remaining > 0: falta dinheiro;
 * - excess > 0: as formas somam mais que a venda (o banco recusa;
 *   o excedente em dinheiro deve ser informado como "valor recebido", vira troco).
 */
export function paymentStatus(total: number, payments: PaymentDraft[]) {
  const totalCents = toCents(total);
  const paidCents = payments.reduce((s, p) => s + toCents(p.amount), 0);
  const changeCents = payments.reduce((s, p) => s + toCents(paymentChange(p)), 0);
  return {
    paid: fromCents(paidCents),
    remaining: fromCents(Math.max(0, totalCents - paidCents)),
    excess: fromCents(Math.max(0, paidCents - totalCents)),
    change: fromCents(changeCents),
    settled: payments.length > 0 && paidCents === totalCents,
  };
}

/**
 * Converte para a convenção do banco, das comandas e da NFC-e:
 * amount = valor entregue nessa forma; change_amount = troco.
 * O que entra no caixa é amount - change_amount.
 */
export function toStoredPayment(p: PaymentDraft): { amount: number; change_amount: number } {
  const change = paymentChange(p);
  return change > 0
    ? { amount: round2(p.receivedAmount!), change_amount: change }
    : { amount: round2(p.amount), change_amount: 0 };
}
