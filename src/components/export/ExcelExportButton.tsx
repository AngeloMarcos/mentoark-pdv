import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToXLSX, XlsxSheet } from "@/lib/xlsx-utils";

interface ExcelExportButtonProps {
  filenamePrefix: string;
  /** Lazy: only runs on click — keeps page render fast */
  getSheets: () => XlsxSheet[] | Promise<XlsxSheet[]>;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  disabled?: boolean;
  className?: string;
}

export function ExcelExportButton({
  filenamePrefix,
  getSheets,
  label = "Exportar Excel",
  variant = "outline",
  size = "default",
  disabled,
  className,
}: ExcelExportButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const sheets = await getSheets();
      const total = sheets.reduce((sum, s) => sum + s.data.length, 0);
      if (total === 0) {
        toast.error("Não há dados para exportar");
        return;
      }
      const filename = exportToXLSX(filenamePrefix, sheets);
      toast.success(`Arquivo ${filename} gerado com sucesso!`);
    } catch (err) {
      console.error("Excel export failed:", err);
      toast.error("Erro ao gerar arquivo Excel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || busy}
      className={className}
    >
      {busy ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4 mr-2" />
      )}
      {label}
    </Button>
  );
}
