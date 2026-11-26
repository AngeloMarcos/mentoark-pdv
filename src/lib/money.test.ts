import { describe, it, expect } from "vitest";
import { cartTotals, lineGross, paymentChange, paymentStatus, toStoredPayment } from "./money";

const cash = (amount: number, receivedAmount?: number) => ({ amount, receivedAmount, requiresChange: true });
const card = (amount: number) => ({ amount, requiresChange: false });

describe("money", () => {
  it("arredonda a linha como o banco", () => {
    expect(lineGross(0.375, 39.9)).toBe(14.96);
    expect(cartTotals([
      { quantity: 3, unit_price: 0.1, discount: 0 },
      { quantity: 1, unit_price: 0.2, discount: 0.05 },
    ])).toEqual({ grossTotal: 0.5, discountTotal: 0.05, netTotal: 0.45 });
  });

  it("não mostra 'Faltam R$ 0,00' por ponto flutuante", () => {
    const s = paymentStatus(0.3, [card(0.1), card(0.2)]);
    expect(s.remaining).toBe(0);
    expect(s.settled).toBe(true);
  });

  it("venda de R$ 20 paga com R$ 50: grava 50 entregue e 30 de troco", () => {
    const p = cash(20, 50);
    expect(paymentChange(p)).toBe(30);
    expect(paymentStatus(20, [p]).settled).toBe(true);
    expect(toStoredPayment(p)).toEqual({ amount: 50, change_amount: 30 });
  });

  it("recusa forma que soma mais que o total", () => {
    const s = paymentStatus(50, [card(80)]);
    expect(s.excess).toBe(30);
    expect(s.settled).toBe(false);
  });

  it("pagamento misto com troco no dinheiro", () => {
    const s = paymentStatus(100, [card(60), cash(40, 50)]);
    expect(s.settled).toBe(true);
    expect(s.change).toBe(10);
  });

  it("cartão nunca gera troco", () => {
    expect(paymentChange({ amount: 10, receivedAmount: 50, requiresChange: false })).toBe(0);
  });
});
