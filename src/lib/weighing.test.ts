import { describe, it, expect } from "vitest";
import {
  DEFAULT_SCALE_CONFIG,
  formatQty,
  matchesScaleCode,
  normalizeScaleConfig,
  parseQty,
  parseScaleBarcode,
  quantityFromLabel,
  sellsFractional,
} from "./weighing";
import { lineGross } from "./money";

const priceCfg = { ...DEFAULT_SCALE_CONFIG, enabled: true };
const weightCfg = { ...priceCfg, value_type: "weight" as const };

describe("venda por peso", () => {
  it("reconhece unidades fracionadas", () => {
    expect(sellsFractional("KG")).toBe(true);
    expect(sellsFractional("kg")).toBe(true);
    expect(sellsFractional("UN")).toBe(false);
    expect(sellsFractional(null)).toBe(false);
  });

  it("lê o peso digitado com vírgula ou ponto", () => {
    expect(parseQty("0,375")).toBe(0.375);
    expect(parseQty("1.2")).toBe(1.2);
    expect(parseQty("0,0004")).toBeNull();
    expect(parseQty("abc")).toBeNull();
    expect(parseQty("0")).toBeNull();
  });

  it("formata quantidade", () => {
    expect(formatQty(0.375, "KG")).toBe("0,375 kg");
    expect(formatQty(3, "UN")).toBe("3");
  });

  it("lê etiqueta de preço", () => {
    const label = parseScaleBarcode("2012300014968", priceCfg);
    expect(label).toEqual({ productCode: "123", price: 14.96 });
    const qty = quantityFromLabel(label!, 39.9);
    expect(qty).toBe(0.375);
    expect(lineGross(qty!, 39.9)).toBe(14.96);
  });

  it("lê etiqueta de peso", () => {
    expect(parseScaleBarcode("2004200037505", weightCfg)).toEqual({ productCode: "42", weight: 3.75 });
  });

  it("ignora código com dígito verificador errado, desligado ou de outro prefixo", () => {
    expect(parseScaleBarcode("2012300014969", priceCfg)).toBeNull();
    expect(parseScaleBarcode("2012300014968", DEFAULT_SCALE_CONFIG)).toBeNull();
    expect(parseScaleBarcode("7891234567895", priceCfg)).toBeNull();
  });

  it("casa o código da balança ignorando zeros à esquerda", () => {
    expect(matchesScaleCode("0123", "123")).toBe(true);
    expect(matchesScaleCode("123", "123")).toBe(true);
    expect(matchesScaleCode("1234", "123")).toBe(false);
    expect(matchesScaleCode(null, "123")).toBe(false);
  });

  it("normaliza configuração salva incompleta", () => {
    expect(normalizeScaleConfig({ enabled: true, code_length: 9 })).toEqual({ ...priceCfg, code_length: 6 });
    expect(normalizeScaleConfig(undefined)).toEqual(DEFAULT_SCALE_CONFIG);
  });
});
