import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileSpreadsheet, FileText, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToCSV, exportToPDF, ExportColumn, PDFExportOptions } from "@/lib/export-utils";

interface ExportButtonsProps {
  data: Record<string, any>[];
  columns: ExportColumn[];
  pdfOptions: Omit<PDFExportOptions, "filename">;
  filenamePrefix: string;
  disabled?: boolean;
}

export function ExportButtons({
  data,
  columns,
  pdfOptions,
  filenamePrefix,
  disabled = false,
}: ExportButtonsProps) {
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const handleExportCSV = async () => {
    if (data.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    setExporting("csv");
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      exportToCSV(data, columns, `${filenamePrefix}-${timestamp}`);
      toast.success("Arquivo CSV gerado com sucesso!");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Erro ao gerar arquivo CSV");
    } finally {
      setExporting(null);
    }
  };

  const handleExportPDF = async () => {
    if (data.length === 0) {
      toast.error("Não há dados para exportar");
      return;
    }

    setExporting("pdf");
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      exportToPDF(data, columns, {
        ...pdfOptions,
        filename: `${filenamePrefix}-${timestamp}`,
      });
      toast.success("Arquivo PDF gerado com sucesso!");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao gerar arquivo PDF");
    } finally {
      setExporting(null);
    }
  };

  const isExporting = exporting !== null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || isExporting || data.length === 0}
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-2" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        <DropdownMenuItem onClick={handleExportCSV} disabled={exporting === "csv"}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportPDF} disabled={exporting === "pdf"}>
          <FileText className="w-4 h-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
