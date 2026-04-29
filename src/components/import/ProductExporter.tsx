import { useState } from "react";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProducts } from "@/hooks/useProducts";
import { generateCSV, downloadCSV } from "@/hooks/useProductImport";
import { exportToXLSX, XlsxSheet } from "@/lib/xlsx-utils";
import { toast } from "sonner";

interface ProductExporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductExporter({ open, onOpenChange }: ProductExporterProps) {
  const [activeOnly, setActiveOnly] = useState(true);
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx");
  const { data: products = [], isLoading } = useProducts();

  const filteredProducts = activeOnly ? products.filter((p) => p.active) : products;

  const handleExport = () => {
    if (format === "csv") {
      const csv = generateCSV(filteredProducts);
      const date = new Date().toISOString().split("T")[0];
      downloadCSV(csv, `produtos_${date}.csv`);
      toast.success("CSV gerado com sucesso!");
    } else {
      const sheet: XlsxSheet = {
        name: "Produtos",
        columns: [
          { key: "name", label: "Nome" },
          { key: "internal_code", label: "Código interno" },
          { key: "barcode", label: "Cód. barras" },
          { key: "category", label: "Categoria" },
          { key: "unit", label: "Unidade" },
          { key: "sale_price", label: "Preço venda", format: "currency" },
          { key: "cost_price", label: "Custo", format: "currency" },
          { key: "stock_current", label: "Estoque", format: "number" },
          { key: "min_stock", label: "Estoque mín.", format: "number" },
          { key: "active", label: "Ativo" },
        ],
        data: filteredProducts.map((p) => ({
          ...p,
          active: p.active ? "Sim" : "Não",
        })),
      };
      const filename = exportToXLSX("produtos", [sheet]);
      toast.success(`${filename} gerado com sucesso!`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar Produtos</DialogTitle>
          <DialogDescription>Escolha o formato e exporte seu catálogo.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label className="mb-2 block">Formato</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as "xlsx" | "csv")}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="xlsx" id="fmt-xlsx" />
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
                <Label htmlFor="fmt-xlsx" className="flex-1 cursor-pointer font-normal">
                  Excel (.xlsx) — recomendado
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg">
                <RadioGroupItem value="csv" id="fmt-csv" />
                <FileText className="w-5 h-5 text-muted-foreground" />
                <Label htmlFor="fmt-csv" className="flex-1 cursor-pointer font-normal">
                  CSV (compatível com qualquer planilha)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="activeOnly"
              checked={activeOnly}
              onCheckedChange={(checked) => setActiveOnly(!!checked)}
            />
            <Label htmlFor="activeOnly">Apenas produtos ativos</Label>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <div className="font-medium">{filteredProducts.length} produto(s) serão exportados</div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleExport} disabled={isLoading || filteredProducts.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
