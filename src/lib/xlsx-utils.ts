import * as XLSX from "xlsx";

export type XlsxFormat = "currency" | "number" | "percent" | "date" | "datetime" | "text" | "integer";

export interface XlsxColumn {
  key: string;
  label: string;
  format?: XlsxFormat;
  width?: number;
}

export interface XlsxSheet {
  name: string;
  columns: XlsxColumn[];
  data: Record<string, any>[];
  /** Optional header rows added above the table (e.g. summary KPIs). Each item = one row. */
  preRows?: (string | number | null)[][];
}

const FORMAT_MAP: Record<XlsxFormat, string> = {
  currency: 'R$ #,##0.00;[Red]-R$ #,##0.00;"-"',
  number: "#,##0.00",
  integer: "#,##0",
  percent: "0.0%",
  date: "dd/mm/yyyy",
  datetime: "dd/mm/yyyy hh:mm",
  text: "@",
};

function toCellValue(raw: any, format?: XlsxFormat) {
  if (raw === null || raw === undefined || raw === "") return null;

  switch (format) {
    case "currency":
    case "number":
    case "integer":
    case "percent": {
      const n = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(n) ? n : null;
    }
    case "date":
    case "datetime": {
      const d = raw instanceof Date ? raw : new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    }
    default:
      return String(raw);
  }
}

function autoWidth(label: string, samples: any[]): number {
  let max = label.length;
  for (const s of samples) {
    if (s == null) continue;
    const len = String(s).length;
    if (len > max) max = len;
  }
  return Math.min(Math.max(max + 2, 10), 50);
}

function buildSheet(sheet: XlsxSheet): XLSX.WorkSheet {
  const aoa: any[][] = [];

  // Optional pre rows (summary)
  if (sheet.preRows && sheet.preRows.length > 0) {
    for (const r of sheet.preRows) aoa.push(r);
    aoa.push([]); // blank separator row
  }

  // Header
  aoa.push(sheet.columns.map((c) => c.label));

  // Data rows
  for (const row of sheet.data) {
    aoa.push(sheet.columns.map((c) => toCellValue(row[c.key], c.format)));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  const headerRowIndex = sheet.preRows && sheet.preRows.length > 0 ? sheet.preRows.length + 1 : 0;

  // Apply formats per column
  sheet.columns.forEach((col, ci) => {
    if (!col.format || col.format === "text") return;
    const z = FORMAT_MAP[col.format];
    for (let ri = headerRowIndex + 1; ri < aoa.length; ri++) {
      const ref = XLSX.utils.encode_cell({ r: ri, c: ci });
      const cell = ws[ref];
      if (cell && cell.v != null) {
        cell.z = z;
        if (col.format === "date" || col.format === "datetime") {
          cell.t = "d";
        } else {
          cell.t = "n";
        }
      }
    }
  });

  // Bold header row
  sheet.columns.forEach((_, ci) => {
    const ref = XLSX.utils.encode_cell({ r: headerRowIndex, c: ci });
    const cell = ws[ref];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "EA580C" } },
        alignment: { horizontal: "center", vertical: "center" },
      };
    }
  });

  // Column widths (auto-fit)
  ws["!cols"] = sheet.columns.map((c) => ({
    wch: c.width ?? autoWidth(c.label, sheet.data.map((r) => r[c.key])),
  }));

  // Freeze header
  ws["!freeze"] = { xSplit: 0, ySplit: headerRowIndex + 1 };
  (ws as any)["!views"] = [{ state: "frozen", ySplit: headerRowIndex + 1 }];

  return ws;
}

/**
 * Generates and downloads an .xlsx file with one or more sheets.
 * Filename should NOT include extension — date suffix is added automatically.
 */
export function exportToXLSX(filenamePrefix: string, sheets: XlsxSheet[]): string {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const sheet of sheets) {
    // Excel sheet names: max 31 chars, no \ / ? * [ ]
    let name = sheet.name.replace(/[\\/?*[\]]/g, "").slice(0, 31) || "Sheet";
    let i = 2;
    let candidate = name;
    while (usedNames.has(candidate)) {
      candidate = `${name.slice(0, 28)} ${i++}`;
    }
    usedNames.add(candidate);

    const ws = buildSheet(sheet);
    XLSX.utils.book_append_sheet(wb, ws, candidate);
  }

  const stamp = new Date().toISOString().split("T")[0];
  const filename = `${filenamePrefix}_${stamp}.xlsx`;
  XLSX.writeFile(wb, filename, { bookType: "xlsx", compression: true });
  return filename;
}

/** Helpers to format dates / currency outside (for pre-rows etc.) */
export const xlsxFmt = {
  brl: (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0),
  date: (v: string | Date) => {
    const d = v instanceof Date ? v : new Date(v);
    return isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
  },
};
