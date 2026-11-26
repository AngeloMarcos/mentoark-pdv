import { describe, it, expect } from "vitest";
import { calcIbpt, ibptExpired, indexRates, isImportedOrigin, parseIbptCsv, transparencyText, ufFromFileName } from "./ibpt";

const CSV = [
  "codigo;ex;tipo;descricao;nacionalfederal;importadosfederal;estadual;municipal;vigenciainicio;vigenciafim;chave;versao;fonte",
  '02013000;;0;"Carnes; desossadas";4.20;6.10;12.00;0.00;01/11/2026;31/12/2026;ABC123;26.2.A;IBPT/empresometro.com.br',
  "19052090;;0;Pao;8.03;10.50;18.00;0.00;01/11/2026;31/12/2026;ABC123;26.2.A;IBPT/empresometro.com.br",
  "19052090;01;0;Pao ex 01;1.00;1.00;1.00;0.00;01/11/2026;31/12/2026;ABC123;26.2.A;IBPT/empresometro.com.br",
  "0101;;1;Servico NBS;10.00;10.00;0.00;5.00;01/11/2026;31/12/2026;ABC123;26.2.A;IBPT/empresometro.com.br",
  "123;;0;NCM curto;1;1;1;0;01/11/2026;31/12/2026;ABC123;26.2.A;IBPT",
  "",
].join("\r\n");

describe("tabela IBPT", () => {
  it("lê o CSV, só NCM, com descrição entre aspas", () => {
    const r = parseIbptCsv(CSV, "TabelaIBPTaxSP26.2.A.csv");
    expect(r.rates).toHaveLength(3);
    expect(r.rates[0]).toEqual({
      ncm: "02013000", ex: "", nacional_federal: 4.2, importados_federal: 6.1, estadual: 12, municipal: 0,
    });
    expect(r.invalidLines).toEqual([6]);
    expect(r.meta).toEqual({
      uf: "SP", versao: "26.2.A", chave: "ABC123", fonte: "IBPT/empresometro.com.br",
      vigencia_inicio: "2026-11-01", vigencia_fim: "2026-12-31",
    });
  });

  it("recusa arquivo que não é do IBPT", () => {
    expect(() => parseIbptCsv("a;b;c\n1;2;3")).toThrow(/IBPT/);
  });

  it("calcula por item, com desconto já aplicado e origem importada", () => {
    const rates = indexRates(parseIbptCsv(CSV).rates);
    const t = calcIbpt(
      [
        { ncm: "0201.30.00", total: 14.96, origem: 0 }, // 4,20% + 12%
        { ncm: "19052090", total: 10, origem: 1 },      // importado: 10,50% + 18%
        { ncm: "99999999", total: 50 },
      ],
      rates,
    );
    expect(t.federal).toBe(1.68); // 0,63 + 1,05
    expect(t.estadual).toBe(3.6); // 1,80 + 1,80
    expect(t.municipal).toBe(0);
    expect(t.total).toBe(5.28);
    expect(t.missingNcms).toEqual(["99999999"]);
  });

  it("usa a regra geral, não a exceção tarifária", () => {
    const rates = indexRates(parseIbptCsv(CSV).rates);
    expect(calcIbpt([{ ncm: "19052090", total: 100 }], rates).federal).toBe(8.03);
  });

  it("monta o texto do cupom", () => {
    expect(
      transparencyText({ federal: 1.68, estadual: 3.6, municipal: 0, total: 5.28, missingNcms: [] }, { chave: "ABC123", fonte: "IBPT" }),
    ).toBe("Trib. aprox.: R$ 1,68 Federal, R$ 3,60 Estadual e R$ 0,00 Municipal. Fonte: IBPT ABC123");
  });

  it("origem e vigência", () => {
    expect(isImportedOrigin(2)).toBe(true);
    expect(isImportedOrigin("0")).toBe(false);
    expect(ufFromFileName("TabelaIBPTaxRJ26.1.B.csv")).toBe("RJ");
    expect(ibptExpired("2026-12-31", new Date("2026-11-26T12:00:00Z"))).toBe(false);
    expect(ibptExpired("2026-11-25", new Date("2026-11-26T12:00:00Z"))).toBe(true);
    expect(ibptExpired(null)).toBe(true);
  });
});
