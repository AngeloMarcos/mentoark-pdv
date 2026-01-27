// Utilitários para código de barras

/**
 * Valida um código EAN-8 ou EAN-13
 */
export function validateEAN(barcode: string): boolean {
  const cleaned = barcode.trim();
  const len = cleaned.length;

  if (len !== 8 && len !== 13) return false;
  if (!/^\d+$/.test(cleaned)) return false;

  let sum = 0;
  for (let i = 0; i < len - 1; i++) {
    const digit = parseInt(cleaned[i], 10);
    if (len === 13) {
      sum += i % 2 === 0 ? digit : digit * 3;
    } else {
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(cleaned[len - 1], 10);
}

/**
 * Calcula o dígito verificador para EAN-8
 */
export function calculateEAN8CheckDigit(base7: string): number {
  if (base7.length !== 7 || !/^\d+$/.test(base7)) {
    throw new Error("Base deve ter 7 dígitos numéricos");
  }

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(base7[i], 10);
    sum += i % 2 === 0 ? digit * 3 : digit;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Calcula o dígito verificador para EAN-13
 */
export function calculateEAN13CheckDigit(base12: string): number {
  if (base12.length !== 12 || !/^\d+$/.test(base12)) {
    throw new Error("Base deve ter 12 dígitos numéricos");
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(base12[i], 10);
    sum += i % 2 === 0 ? digit : digit * 3;
  }

  return (10 - (sum % 10)) % 10;
}

/**
 * Gera um código interno de 8 dígitos com dígito verificador
 */
export function generateInternalBarcode(): string {
  const base = Math.floor(Math.random() * 10000000)
    .toString()
    .padStart(7, "0");
  const checkDigit = calculateEAN8CheckDigit(base);
  return base + checkDigit;
}

/**
 * Formata um código de barras para exibição
 */
export function formatBarcode(barcode: string): string {
  const cleaned = barcode.replace(/\s/g, "");
  
  if (cleaned.length === 8) {
    // EAN-8: XXXX XXXX
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  }
  
  if (cleaned.length === 13) {
    // EAN-13: X XXXXXX XXXXXX
    return `${cleaned[0]} ${cleaned.slice(1, 7)} ${cleaned.slice(7)}`;
  }
  
  return barcode;
}

/**
 * Detecta o tipo de código de barras
 */
export function detectBarcodeType(barcode: string): "EAN8" | "EAN13" | "INTERNAL" | "UNKNOWN" {
  const cleaned = barcode.trim();
  
  if (!/^\d+$/.test(cleaned)) return "UNKNOWN";
  
  if (cleaned.length === 8) {
    return validateEAN(cleaned) ? "EAN8" : "INTERNAL";
  }
  
  if (cleaned.length === 13) {
    return validateEAN(cleaned) ? "EAN13" : "UNKNOWN";
  }
  
  return "UNKNOWN";
}
