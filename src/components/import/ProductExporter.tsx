import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useProducts, Product } from "@/hooks/useProducts";
import { generateCSV, downloadCSV } from "@/hooks/useProductImport";

interface ProductExporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductExporter({ open, onOpenChange }: ProductExporterProps) {
  const [activeOnly, setActiveOnly] = useState(true);
  const { data: products = [], isLoading } = useProducts();

  const filteredProducts = activeOnly
    ? products.filter((p) => p.active)
    : products;

  const handleExport = () => {
    const csv = generateCSV(filteredProducts);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `produtos_${date}.csv`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exportar Produtos</DialogTitle>
          <DialogDescription>
            Exporte seus produtos para um arquivo CSV.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="activeOnly"
              checked={activeOnly}
              onCheckedChange={(checked) => setActiveOnly(!!checked)}
            />
            <Label htmlFor="activeOnly">Apenas produtos ativos</Label>
          </div>

          <div className="p-4 bg-muted rounded-lg flex items-center gap-4">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <div>
              <div className="font-medium">
                {filteredProducts.length} produto(s)
              </div>
              <div className="text-sm text-muted-foreground">
                Serão exportados para CSV
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isLoading || filteredProducts.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
