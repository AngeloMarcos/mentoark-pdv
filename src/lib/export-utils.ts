import { jsPDF } from "jspdf";
import "jspdf-autotable";

// Types
export interface ExportColumn {
  key: string;
  label: string;
  format?: "currency" | "percent" | "number" | "date" | "datetime";
  align?: "left" | "center" | "right";
}

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  orientation?: "portrait" | "landscape";
  filename: string;
  summary?: {
    label: string;
    value: string;
  }[];
}

// Formatters
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function formatCell(value: any, format?: ExportColumn["format"]): string {
  if (value === null || value === undefined) return "";
  
  switch (format) {
    case "currency":
      return formatCurrency(Number(value));
    case "percent":
      return formatPercent(Number(value));
    case "number":
      return formatNumber(Number(value));
    case "date":
      return formatDate(value);
    case "datetime":
      return formatDateTime(value);
    default:
      return String(value);
  }
}

// CSV Export
export function exportToCSV(
  data: Record<string, any>[],
  columns: ExportColumn[],
  filename: string
): void {
  const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const separator = ";"; // Use semicolon for pt-BR locale
  
  // Headers
  const headers = columns.map((c) => `"${c.label}"`).join(separator);
  
  // Rows
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = formatCell(row[col.key], col.format);
        // Escape quotes and wrap in quotes
        return `"${value.replace(/"/g, '""')}"`;
      })
      .join(separator)
  );
  
  const content = [headers, ...rows].join("\n");
  
  const blob = new Blob([BOM + content], {
    type: "text/csv;charset=utf-8;",
  });
  
  downloadBlob(blob, `${filename}.csv`);
}

// PDF Export
export function exportToPDF(
  data: Record<string, any>[],
  columns: ExportColumn[],
  options: PDFExportOptions
): void {
  const doc = new jsPDF({
    orientation: options.orientation || "portrait",
    unit: "mm",
    format: "a4",
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(options.title, 14, 20);
  
  // Subtitle
  let startY = 28;
  if (options.subtitle) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(options.subtitle, 14, startY);
    startY += 6;
  }
  
  // Generation date
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Gerado em: ${formatDateTime(new Date())}`, 14, startY);
  doc.setTextColor(0);
  startY += 8;
  
  // Table
  const tableHeaders = columns.map((c) => c.label);
  const tableBody = data.map((row) =>
    columns.map((col) => formatCell(row[col.key], col.format))
  );
  
  // Column alignments
  const columnStyles: Record<number, { halign: "left" | "center" | "right" }> = {};
  columns.forEach((col, idx) => {
    if (col.align || col.format === "currency" || col.format === "number" || col.format === "percent") {
      columnStyles[idx] = { halign: col.align || "right" };
    }
  });
  
  (doc as any).autoTable({
    head: [tableHeaders],
    body: tableBody,
    startY,
    theme: "striped",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [234, 88, 12], // Orange primary color
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    columnStyles,
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        pageWidth - 30,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });
  
  // Summary section
  if (options.summary && options.summary.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    
    options.summary.forEach((item, idx) => {
      doc.text(`${item.label}: ${item.value}`, 14, finalY + idx * 7);
    });
  }
  
  doc.save(`${options.filename}.pdf`);
}

// Download helper
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Period presets for filters
export function getPeriodPresets() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(startOfWeek);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
  
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);
  
  return [
    { label: "Hoje", start: today, end: today },
    { label: "Ontem", start: yesterday, end: yesterday },
    { label: "Esta Semana", start: startOfWeek, end: today },
    { label: "Semana Passada", start: lastWeekStart, end: lastWeekEnd },
    { label: "Este Mês", start: startOfMonth, end: today },
    { label: "Mês Passado", start: lastMonthStart, end: lastMonthEnd },
    { label: "Últimos 30 dias", start: thirtyDaysAgo, end: today },
    { label: "Últimos 90 dias", start: ninetyDaysAgo, end: today },
  ];
}
