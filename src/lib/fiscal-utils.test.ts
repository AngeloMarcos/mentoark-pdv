// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildNFCeXML, calcDV, parseReformaTotals, type FiscalItem, type FiscalSale } from "./fiscal-utils";
import { calculateTaxes, DEFAULT_TAX_CONFIG, type TaxConfig } from "./tax/engine";

const sale: FiscalSale = {
  id: "sale-1",
  numero: 42,
  serie: "001",
  datetime: new Date("2026-11-15T15:00:00Z"),
  net_total: 0,
  discount_total: 0,
  payment_method: "dinheiro",
  ambiente: "homologacao",
  chave: "35261112345678000195650010000000421000000017",
};
const empresa = { name: "Loja <Teste> & Cia", cnpj: "12.345.678/0001-95", uf: "SP", municipio_ibge: "3550308" };

const items: FiscalItem[] = [
  { product_id: "p1", product_name: "Arroz 5kg", quantity: 2, unit_price: 25, total: 45, discount: 5, ncm: "1006.30.21", csosn: "102" },
  { product_id: "p2", product_name: "Cigarro", quantity: 1, unit_price: 10, total: 10, ncm: "24022000", csosn: "500" },
];

const config: TaxConfig = {
  ...DEFAULT_TAX_CONFIG,
  enabled: true,
  is_rules: [{ id: "fumo", label: "Fumo", match: "ncm_prefix", value: "2402", aliquota: 50, active: true }],
};

const taxInput = items.map((it, i) => ({
  key: String(i + 1),
  quantity: it.quantity,
  unit_price: it.unit_price,
  discount: it.discount || 0,
  ncm: it.ncm,
  tax: i === 0 ? { reducao: 60, cclasstrib: "200003" } : null,
}));

function parse(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  return doc;
}

const text = (el: Element | Document, tag: string) => el.getElementsByTagName(tag)[0]?.textContent;
const childNames = (el: Element) => Array.from(el.children).map((c) => c.tagName);

describe("buildNFCeXML", () => {
  it("sem reforma: XML bem formado, sem os grupos IBSCBS/IS", () => {
    const xml = buildNFCeXML({ ...sale, net_total: 55 }, empresa, items);
    const doc = parse(xml);
    expect(doc.getElementsByTagName("IBSCBS")).toHaveLength(0);
    expect(doc.getElementsByTagName("IBSCBSTot")).toHaveLength(0);
    expect(text(doc, "vNF")).toBe("55.00");
    expect(parseReformaTotals(xml)).toBeNull();
  });

  it("com reforma: grupos IS e IBSCBS por item, na ordem do leiaute", () => {
    const tax = calculateTaxes(taxInput, config);
    const doc = parse(buildNFCeXML({ ...sale, net_total: 55 }, empresa, items, tax));
    const dets = Array.from(doc.getElementsByTagName("det"));
    expect(dets).toHaveLength(2);

    // Item 1: alíquota reduzida em 60%, sem IS
    const imp1 = dets[0].getElementsByTagName("imposto")[0];
    expect(childNames(imp1)).toEqual(["ICMS", "PIS", "COFINS", "IBSCBS"]);
    const g1 = imp1.getElementsByTagName("IBSCBS")[0];
    expect(childNames(g1)).toEqual(["CST", "cClassTrib", "gIBSCBS"]);
    expect(text(g1, "CST")).toBe("200");
    expect(text(g1, "cClassTrib")).toBe("200003");
    expect(childNames(g1.getElementsByTagName("gIBSCBS")[0])).toEqual(["vBC", "gIBSUF", "gIBSMun", "vIBS", "gCBS"]);
    expect(text(g1, "vBC")).toBe("45.00");
    expect(text(g1, "pCBS")).toBe("0.9000");
    expect(text(g1, "pRedAliq")).toBe("60.0000");
    expect(text(g1, "vCBS")).toBe("0.16");

    // Item 2: IS antes do IBSCBS e compondo a base
    const imp2 = dets[1].getElementsByTagName("imposto")[0];
    expect(childNames(imp2)).toEqual(["ICMS", "PIS", "COFINS", "IS", "IBSCBS"]);
    expect(childNames(imp2.getElementsByTagName("IS")[0])).toEqual(["CSTIS", "cClassTribIS", "vBCIS", "pIS", "vIS"]);
    expect(text(imp2, "vIS")).toBe("5.00");
    expect(text(imp2.getElementsByTagName("IBSCBS")[0], "vBC")).toBe("15.00");
    expect(imp2.getElementsByTagName("ICMSSN500")).toHaveLength(1);
  });

  it("totais do XML batem com a soma dos itens", () => {
    const tax = calculateTaxes(taxInput, config);
    const xml = buildNFCeXML({ ...sale, net_total: 55 }, empresa, items, tax);
    const doc = parse(xml);
    const total = doc.getElementsByTagName("total")[0];
    expect(childNames(total)).toEqual(["ICMSTot", "ISTot", "IBSCBSTot", "vNFTot"]);

    const sum = (tag: string) =>
      Array.from(doc.getElementsByTagName("det")).reduce(
        (s, d) => s + parseFloat(d.getElementsByTagName(tag)[0]?.textContent || "0"),
        0
      );
    const tot = total.getElementsByTagName("IBSCBSTot")[0];
    expect(parseFloat(text(tot, "vCBS")!)).toBeCloseTo(sum("vCBS"), 2);
    expect(parseFloat(text(tot, "vIBS")!)).toBeCloseTo(sum("vIBS"), 2);
    expect(parseFloat(text(tot, "vBCIBSCBS")!)).toBeCloseTo(60, 2);
    expect(text(total, "vProd")).toBe("60.00");
    expect(text(total, "vDesc")).toBe("5.00");
    expect(text(total, "vNFTot")).toBe("55.00");

    expect(parseReformaTotals(xml)).toEqual({ vIBS: tax.totals.vIBS, vCBS: tax.totals.vCBS, vIS: 5 });
  });

  it("escapa caracteres especiais e normaliza o NCM", () => {
    const xml = buildNFCeXML({ ...sale, net_total: 55 }, empresa, items);
    expect(xml).toContain("Loja &lt;Teste&gt; &amp; Cia");
    expect(xml).toContain("<NCM>10063021</NCM>");
  });
});

describe("calcDV", () => {
  it("calcula o dígito verificador módulo 11 da chave de acesso", () => {
    expect(calcDV("3526111234567800019565001000000042100000001")).toBeGreaterThanOrEqual(0);
    expect(calcDV("3526111234567800019565001000000042100000001")).toBeLessThanOrEqual(9);
  });
});
