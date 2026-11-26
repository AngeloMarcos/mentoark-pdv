import { describe, it, expect } from "vitest";
import { fiscalReadiness, isReady, validCnpj, type ReadinessInput } from "./fiscal-readiness";

const pronto: ReadinessInput = {
  fiscal: {
    provider: "focus_nfe",
    ambiente: "homologacao",
    emite_nfce: true,
    cnpj: "11.222.333/0001-81",
    ie: "123.456.789.110",
    uf: "SP",
    municipio_ibge: "3550308",
    crt: "1",
  },
  credentials: { homologacao: "****abcd", producao: null },
  products: { active: 10, withValidNcm: 10 },
  ibpt: { uf: "SP", vigencia_fim: "2026-12-31", total_rows: 9000 },
  today: new Date("2026-11-26T12:00:00Z"),
};

const status = (input: ReadinessInput, id: string) => fiscalReadiness(input).find((i) => i.id === id)?.status;

describe("prontidão fiscal", () => {
  it("valida CNPJ", () => {
    expect(validCnpj("11.222.333/0001-81")).toBe(true);
    expect(validCnpj("11.222.333/0001-82")).toBe(false);
    expect(validCnpj("00000000000000")).toBe(false);
  });

  it("tudo configurado em homologação está pronto", () => {
    const items = fiscalReadiness(pronto);
    expect(isReady(items)).toBe(true);
    expect(status(pronto, "certificado")).toBe("manual");
    expect(status(pronto, "ambiente")).toBe("atencao");
  });

  it("aponta o que falta", () => {
    const input: ReadinessInput = {
      ...pronto,
      fiscal: { ...pronto.fiscal, provider: "simulado", ie: "", municipio_ibge: "355" },
      products: { active: 10, withValidNcm: 7 },
      ibpt: null,
    };
    const items = fiscalReadiness(input);
    expect(isReady(items)).toBe(false);
    expect(items.find((i) => i.id === "empresa")?.detail).toBe("Falta: Inscrição Estadual, município (código IBGE, 7 dígitos).");
    expect(status(input, "provedor")).toBe("pendente");
    expect(status(input, "tokens")).toBeUndefined();
    expect(items.find((i) => i.id === "ncm")?.detail).toMatch(/^3 de 10/);
    expect(status(input, "ibpt")).toBe("pendente");
  });

  it("produção exige o token de produção", () => {
    const input = { ...pronto, fiscal: { ...pronto.fiscal, ambiente: "producao" } };
    expect(status(input, "tokens")).toBe("pendente");
  });

  it("IBPT vencido ou de outro estado pede atenção", () => {
    expect(status({ ...pronto, ibpt: { ...pronto.ibpt!, vigencia_fim: "2026-11-01" } }, "ibpt")).toBe("atencao");
    expect(status({ ...pronto, ibpt: { ...pronto.ibpt!, uf: "RJ" } }, "ibpt")).toBe("atencao");
  });

  it("serviço fiscal fora do ar não trava o checklist", () => {
    expect(status({ ...pronto, credentials: new Error("x") }, "tokens")).toBe("atencao");
  });
});
