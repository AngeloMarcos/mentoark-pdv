/**
 * Teste de desempenho do motor tributário.
 * Rode com `npm run test:perf`. Os orçamentos têm folga para máquinas de CI
 * e notebooks lentos; o tempo medido aparece no console.
 */
import { describe, expect, it } from "vitest";
import { aggregateTaxReport, calculateTaxes, DEFAULT_TAX_CONFIG, type TaxConfig, type TaxItemInput } from "./engine";

const config: TaxConfig = {
  ...DEFAULT_TAX_CONFIG,
  enabled: true,
  cbs: 8.8,
  ibs_uf: 14,
  ibs_mun: 3.7,
  is_rules: Array.from({ length: 20 }, (_, i) => ({
    id: `r${i}`,
    label: `Regra ${i}`,
    match: "ncm_prefix" as const,
    value: String(2200 + i),
    aliquota: 5 + i,
    active: true,
  })),
};

const makeItems = (n: number): TaxItemInput[] =>
  Array.from({ length: n }, (_, i) => ({
    key: String(i),
    quantity: 1 + (i % 7),
    unit_price: 1.99 + (i % 113) * 0.37,
    discount: i % 9 === 0 ? 0.5 : 0,
    ncm: String(22000000 + (i % 40) * 10000),
    category: `cat-${i % 12}`,
    tax: i % 10 === 0 ? { reducao: 60, cclasstrib: "200003" } : null,
  }));

function median(fn: () => void, runs = 15): number {
  fn(); // aquecimento
  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t = performance.now();
    fn();
    times.push(performance.now() - t);
  }
  return times.sort((a, b) => a - b)[Math.floor(runs / 2)];
}

describe("desempenho do motor tributário", () => {
  it("carrinho de 100 itens em menos de 5 ms", () => {
    const items = makeItems(100);
    const ms = median(() => calculateTaxes(items, config));
    console.log(`carrinho 100 itens: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(5);
  });

  it("carrinho de 1.000 itens em menos de 50 ms", () => {
    const items = makeItems(1000);
    const ms = median(() => calculateTaxes(items, config));
    console.log(`carrinho 1.000 itens: ${ms.toFixed(3)} ms`);
    expect(ms).toBeLessThan(50);
  });

  it("relatório mensal de 10.000 vendas (50.000 itens) em menos de 2 s", () => {
    const base = Date.parse("2026-01-01T12:00:00Z");
    const sales = Array.from({ length: 10000 }, (_, i) => ({
      id: String(i),
      datetime: new Date(base + i * 45 * 60 * 1000).toISOString(),
      items: makeItems(5),
    }));
    const t = performance.now();
    const report = aggregateTaxReport(sales, config, "month");
    const ms = performance.now() - t;
    console.log(`relatório 10.000 vendas: ${ms.toFixed(1)} ms`);
    expect(report.totals.vendas).toBe(10000);
    expect(ms).toBeLessThan(2000);
  });
});
