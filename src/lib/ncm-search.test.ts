import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildNcmIndex, formatNcm, ncmExists, normalizeText, searchNcm, type NcmEntry } from "./ncm-search";

const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../public/data/ncm.json"), "utf8")) as {
  versao: string;
  itens: NcmEntry[];
};
const index = buildNcmIndex(data);
const codes = (r: NcmEntry[]) => r.map(([c]) => c);

describe("busca de NCM (tabela oficial)", () => {
  it("tem a tabela vigente inteira", () => {
    expect(index.entries.length).toBeGreaterThan(10000);
    expect(index.entries.every(([c]) => /^\d{8}$/.test(c))).toBe(true);
  });

  it("busca por código com ou sem pontos", () => {
    expect(codes(searchNcm(index, "2202.10.00"))).toEqual(["22021000"]);
    expect(codes(searchNcm(index, "0201")).every((c) => c.startsWith("0201"))).toBe(true);
    expect(searchNcm(index, "2")).toEqual([]);
  });

  it("busca por palavras, sem acento e em qualquer ordem", () => {
    const r = codes(searchNcm(index, "bovina desossada"));
    expect(r).toContain("02013000");
    expect(codes(searchNcm(index, "pao"))).toContain("19052090");
    expect(codes(searchNcm(index, "batatas frescas"))).toContain("07019000");
  });

  it("utilitários", () => {
    expect(normalizeText("Pão Açúcar")).toBe("pao acucar");
    expect(formatNcm("22021000")).toBe("2202.10.00");
    expect(ncmExists(index, "2202.10.00")).toBe(true);
    expect(ncmExists(index, "99999999")).toBe(false);
  });
});
