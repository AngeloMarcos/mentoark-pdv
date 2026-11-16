import { describe, expect, it } from "vitest";
import {
  aggregateTaxReport,
  calcIcmsSt,
  calculateTaxes,
  DEFAULT_TAX_CONFIG,
  normalizeTaxConfig,
  productTaxFields,
  round2,
  type TaxConfig,
} from "./engine";

const config2026: TaxConfig = { ...DEFAULT_TAX_CONFIG, enabled: true };

describe("calculateTaxes — IBS e CBS", () => {
  it("aplica as alíquotas-teste de 2026 (CBS 0,9% + IBS 0,1%) sobre o valor do item", () => {
    const { items, totals } = calculateTaxes([{ key: "a", quantity: 2, unit_price: 50 }], config2026);
    expect(items[0].ibscbs.vBC).toBe(100);
    expect(items[0].ibscbs.vCBS).toBe(0.9);
    expect(items[0].ibscbs.vIBSUF).toBe(0.1);
    expect(items[0].ibscbs.vIBSMun).toBe(0);
    expect(totals.vTributos).toBe(1);
    expect(items[0].ibscbs.cst).toBe("000");
    expect(items[0].ibscbs.cClassTrib).toBe("000001");
  });

  it("desconto incondicional reduz a base ANTES do imposto (LC 214/2025, art. 12)", () => {
    const cfg: TaxConfig = { ...config2026, cbs: 8.8, ibs_uf: 14, ibs_mun: 3.7 };
    const { items } = calculateTaxes([{ key: "a", quantity: 1, unit_price: 200, discount: 50 }], cfg);
    expect(items[0].vProd).toBe(200);
    expect(items[0].vDesc).toBe(50);
    expect(items[0].ibscbs.vBC).toBe(150);
    expect(items[0].ibscbs.vCBS).toBe(13.2);
    expect(items[0].ibscbs.vIBS).toBe(26.55);
  });

  it("modo informativo não altera o total cobrado; por_fora soma os tributos", () => {
    const cfg: TaxConfig = { ...config2026, cbs: 10, ibs_uf: 10, ibs_mun: 0 };
    const item = [{ key: "a", quantity: 1, unit_price: 100 }];
    expect(calculateTaxes(item, cfg).totals.vTotal).toBe(100);
    expect(calculateTaxes(item, { ...cfg, modo: "por_fora" }).totals.vTotal).toBe(120);
  });

  it("modo por_dentro extrai a base de um preço que já contém os tributos", () => {
    const cfg: TaxConfig = { ...config2026, modo: "por_dentro", cbs: 10, ibs_uf: 15, ibs_mun: 0 };
    const { items, totals } = calculateTaxes([{ key: "a", quantity: 1, unit_price: 125 }], cfg);
    expect(items[0].ibscbs.vBC).toBe(100);
    expect(items[0].ibscbs.vCBS).toBe(10);
    expect(items[0].ibscbs.vIBS).toBe(15);
    expect(totals.vTotal).toBe(125);
  });

  it("redução de alíquota: 60% reduz, 100% zera, e o CST padrão passa a 200", () => {
    const cfg: TaxConfig = { ...config2026, cbs: 10, ibs_uf: 10, ibs_mun: 0 };
    const { items } = calculateTaxes(
      [
        { key: "r60", quantity: 1, unit_price: 100, tax: { reducao: 60, cclasstrib: "200003" } },
        { key: "r100", quantity: 1, unit_price: 100, tax: { reducao: 100, cclasstrib: "200003" } },
      ],
      cfg
    );
    expect(items[0].ibscbs.cst).toBe("200");
    expect(items[0].ibscbs.pCBSEfet).toBeCloseTo(4);
    expect(items[0].ibscbs.vCBS).toBe(4);
    expect(items[0].ibscbs.vIBS).toBe(4);
    expect(items[1].vTributos).toBe(0);
  });

  it("CST sem débito (isenção/imunidade) não gera IBS/CBS", () => {
    const { items } = calculateTaxes(
      [{ key: "a", quantity: 1, unit_price: 100, tax: { cst_ibscbs: "410", cclasstrib: "410001" } }],
      config2026
    );
    expect(items[0].vTributos).toBe(0);
    expect(items[0].ibscbs.vBC).toBe(100);
  });

  it("avisa quando o CST exige cClassTrib e ele não foi informado", () => {
    const { warnings } = calculateTaxes(
      [{ key: "a", quantity: 1, unit_price: 10, tax: { cst_ibscbs: "200" } }],
      config2026
    );
    expect(warnings).toHaveLength(1);
  });

  it("totais são a soma dos itens arredondados em centavos", () => {
    const cfg: TaxConfig = { ...config2026, cbs: 8.8, ibs_uf: 14, ibs_mun: 3.7 };
    const input = Array.from({ length: 37 }, (_, i) => ({
      key: String(i),
      quantity: 1 + (i % 4) * 0.333,
      unit_price: 3.33 + i * 1.17,
      discount: i % 5 === 0 ? 0.37 : 0,
    }));
    const { items, totals } = calculateTaxes(input, cfg);
    const sum = (f: (i: (typeof items)[number]) => number) => round2(items.reduce((s, i) => s + f(i), 0));
    expect(totals.vCBS).toBe(sum((i) => i.ibscbs.vCBS));
    expect(totals.vIBS).toBe(sum((i) => i.ibscbs.vIBS));
    expect(totals.vLiquido).toBe(sum((i) => i.vLiquido));
    for (const it of items) {
      expect(it.ibscbs.vIBS).toBe(round2(it.ibscbs.vIBSUF + it.ibscbs.vIBSMun));
      expect(Number.isInteger(Math.round(it.ibscbs.vCBS * 100))).toBe(true);
    }
  });
});

describe("calculateTaxes — Imposto Seletivo", () => {
  const cfg: TaxConfig = {
    ...config2026,
    cbs: 10,
    ibs_uf: 10,
    ibs_mun: 0,
    is_rules: [
      { id: "fumo", label: "Fumo", match: "ncm_prefix", value: "2402", aliquota: 50, active: true },
      { id: "refri", label: "Açucaradas", match: "category", value: "Refrigerantes", aliquota: 10, active: true },
      { id: "off", label: "Inativa", match: "ncm_prefix", value: "2203", aliquota: 30, active: false },
    ],
  };

  it("só incide nos produtos que casam com uma regra ativa", () => {
    const { items } = calculateTaxes(
      [
        { key: "cigarro", quantity: 1, unit_price: 10, ncm: "2402.20.00" },
        { key: "refri", quantity: 1, unit_price: 10, category: "refrigerantes" },
        { key: "cerveja", quantity: 1, unit_price: 10, ncm: "22030000" },
        { key: "arroz", quantity: 1, unit_price: 10, ncm: "10063021" },
      ],
      cfg
    );
    expect(items[0].is?.v).toBe(5);
    expect(items[1].is?.v).toBe(1);
    expect(items[2].is).toBeNull();
    expect(items[3].is).toBeNull();
  });

  it("o IS integra a base do IBS e da CBS", () => {
    const { items } = calculateTaxes([{ key: "c", quantity: 1, unit_price: 10, ncm: "24022000" }], cfg);
    expect(items[0].is?.vBC).toBe(10);
    expect(items[0].ibscbs.vBC).toBe(15);
    expect(items[0].ibscbs.vCBS).toBe(1.5);
  });

  it("alíquota do produto sobrepõe as regras; zero isenta", () => {
    const { items } = calculateTaxes(
      [
        { key: "a", quantity: 1, unit_price: 10, ncm: "24022000", tax: { is_aliquota: 0 } },
        { key: "b", quantity: 1, unit_price: 10, ncm: "10063021", tax: { is_aliquota: 20 } },
      ],
      cfg
    );
    expect(items[0].is).toBeNull();
    expect(items[1].is?.v).toBe(2);
  });

  it("por_dentro: preço = base × (1 + IS) × (1 + IBS + CBS)", () => {
    const { items } = calculateTaxes([{ key: "c", quantity: 1, unit_price: 18, ncm: "24022000" }], {
      ...cfg,
      modo: "por_dentro",
    });
    expect(items[0].is?.vBC).toBe(10);
    expect(items[0].is?.v).toBe(5);
    expect(items[0].ibscbs.vBC).toBe(15);
    expect(items[0].vTributos).toBe(8);
    expect(items[0].vTotal).toBe(18);
  });
});

describe("configuração e produto", () => {
  it("normalizeTaxConfig tolera entrada ausente ou inválida", () => {
    expect(normalizeTaxConfig(undefined)).toEqual(DEFAULT_TAX_CONFIG);
    const cfg = normalizeTaxConfig({ enabled: 1, cbs: "8,8", ibs_uf: -3, modo: "xyz", is_rules: [null, { aliquota: "5" }] });
    expect(cfg.enabled).toBe(true);
    expect(cfg.cbs).toBe(8.8);
    expect(cfg.ibs_uf).toBe(0);
    expect(cfg.modo).toBe("informativo");
    expect(cfg.is_rules).toHaveLength(1);
    expect(cfg.is_rules[0].aliquota).toBe(5);
  });

  it("productTaxFields lê NCM, categoria e extra_attributes.tax", () => {
    const f = productTaxFields({ ncm: "22021000", category: "Bebidas", extra_attributes: { tax: { reducao: 60 } } });
    expect(f).toEqual({ ncm: "22021000", category: "Bebidas", tax: { reducao: 60 } });
    expect(productTaxFields(null)).toEqual({ ncm: null, category: null, tax: null });
  });
});

describe("aggregateTaxReport", () => {
  it("agrupa por dia e por mês no fuso de Brasília", () => {
    const sales = [
      { id: "1", datetime: "2026-11-01T02:30:00Z", items: [{ key: "a", quantity: 1, unit_price: 100 }] }, // 31/10 23:30 BRT
      { id: "2", datetime: "2026-11-01T15:00:00Z", items: [{ key: "b", quantity: 1, unit_price: 200 }] },
      { id: "3", datetime: "2026-11-02T15:00:00Z", items: [{ key: "c", quantity: 1, unit_price: 300 }] },
    ];
    const daily = aggregateTaxReport(sales, config2026, "day");
    expect(daily.rows.map((r) => r.periodo)).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(daily.rows[1].vCBS).toBe(1.8);
    expect(daily.totals.vendas).toBe(3);
    expect(daily.totals.vTributos).toBe(6);

    const monthly = aggregateTaxReport(sales, config2026, "month");
    expect(monthly.rows.map((r) => r.periodo)).toEqual(["2026-10", "2026-11"]);
    expect(monthly.rows[1].vLiquido).toBe(500);
    expect(monthly.byClass).toEqual([
      { cst: "000", cClassTrib: "000001", itens: 3, vBCIBSCBS: 600, vIBS: 0.6, vCBS: 5.4, vIS: 0 },
    ]);
  });
});

describe("calcIcmsSt", () => {
  it("calcula a ST do substituto: base com MVA menos o ICMS próprio", () => {
    const r = calcIcmsSt({ valorOperacao: 1000, mva: 40, aliquotaInterna: 18, aliquotaPropria: 12 });
    expect(r).toEqual({ vBC: 1000, vICMS: 120, vBCST: 1400, vICMSST: 132 });
  });

  it("nunca devolve ST negativa", () => {
    const r = calcIcmsSt({ valorOperacao: 100, mva: 0, aliquotaInterna: 12, aliquotaPropria: 18 });
    expect(r.vICMSST).toBe(0);
  });
});
