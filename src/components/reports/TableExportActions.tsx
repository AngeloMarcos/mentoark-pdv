import { Button } from "@/components/ui/button";
import { Download, FileText, Printer } from "lucide-react";
import { exportToCSV, ExportColumn } from "@/lib/export-utils";

interface Props {
  data: Record<string, any>[];
  columns: ExportColumn[];
  filenamePrefix: string;
  onPrint?: () => void;
  disabled?: boolean;
}

export function TableExportActions({ data, columns, filenamePrefix, onPrint, disabled }: Props) {
  const stamp = new Date().toISOString().split("T")[0];
  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={disabled || data.length === 0}
        onClick={() => exportToCSV(data, columns, `${filenamePrefix}-${stamp}`)}
      >
        <Download className="w-4 h-4 mr-1" /> CSV
      </Button>
      {onPrint && (
        <Button variant="ghost" size="sm" onClick={onPrint}>
          <Printer className="w-4 h-4 mr-1" /> PDF
        </Button>
      )}
    </div>
  );
}
