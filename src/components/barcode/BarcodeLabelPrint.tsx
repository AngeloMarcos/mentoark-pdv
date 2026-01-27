import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeGenerator } from "./BarcodeGenerator";
import { Printer, Minus, Plus } from "lucide-react";

interface Product {
  id: string;
  name: string;
  barcode?: string | null;
  sale_price: number;
}

interface BarcodeLabelPrintProps {
  products: Product[];
  onClose?: () => void;
}

interface LabelConfig {
  productId: string;
  quantity: number;
}

export function BarcodeLabelPrint({ products, onClose }: BarcodeLabelPrintProps) {
  const [labelConfigs, setLabelConfigs] = useState<LabelConfig[]>(
    products.map((p) => ({ productId: p.id, quantity: 1 }))
  );
  const printRef = useRef<HTMLDivElement>(null);

  const updateQuantity = (productId: string, delta: number) => {
    setLabelConfigs((prev) =>
      prev.map((config) =>
        config.productId === productId
          ? { ...config, quantity: Math.max(1, config.quantity + delta) }
          : config
      )
    );
  };

  const setQuantity = (productId: string, quantity: number) => {
    setLabelConfigs((prev) =>
      prev.map((config) =>
        config.productId === productId
          ? { ...config, quantity: Math.max(1, quantity) }
          : config
      )
    );
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas de Código de Barras</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; }
            .label-container {
              display: flex;
              flex-wrap: wrap;
              gap: 4mm;
              padding: 4mm;
            }
            .label {
              width: 50mm;
              height: 30mm;
              border: 1px dashed #ccc;
              padding: 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-inside: avoid;
            }
            .label-name {
              font-size: 8pt;
              font-weight: bold;
              text-align: center;
              margin-bottom: 2mm;
              max-width: 100%;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .label-price {
              font-size: 10pt;
              font-weight: bold;
              margin-top: 2mm;
            }
            .label svg {
              max-width: 100%;
              height: auto;
            }
            @media print {
              .label { border: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Gera as etiquetas para impressão
  const labels: { product: Product; index: number }[] = [];
  labelConfigs.forEach((config) => {
    const product = products.find((p) => p.id === config.productId);
    if (product && product.barcode) {
      for (let i = 0; i < config.quantity; i++) {
        labels.push({ product, index: i });
      }
    }
  });

  const productsWithBarcode = products.filter((p) => p.barcode);

  if (productsWithBarcode.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum produto selecionado possui código de barras cadastrado.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurar Quantidade de Etiquetas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {productsWithBarcode.map((product) => {
            const config = labelConfigs.find((c) => c.productId === product.id);
            return (
              <div key={product.id} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{product.name}</p>
                  <p className="text-sm text-muted-foreground">{product.barcode}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(product.id, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    min={1}
                    value={config?.quantity || 1}
                    onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 1)}
                    className="w-16 h-8 text-center"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => updateQuantity(product.id, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Preview das etiquetas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Pré-visualização ({labels.length} etiqueta{labels.length !== 1 ? "s" : ""})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={printRef}
            className="label-container flex flex-wrap gap-2 p-2 bg-white rounded border max-h-64 overflow-y-auto"
          >
            {labels.slice(0, 20).map(({ product, index }) => (
              <div
                key={`${product.id}-${index}`}
                className="label border border-dashed border-muted-foreground/30 p-2 flex flex-col items-center justify-center"
                style={{ width: "50mm", height: "30mm" }}
              >
                <p className="label-name text-xs font-bold text-center truncate max-w-full">
                  {product.name}
                </p>
                {product.barcode && (
                  <BarcodeGenerator
                    value={product.barcode}
                    format={product.barcode.length === 8 ? "EAN8" : product.barcode.length === 13 ? "EAN13" : "CODE128"}
                    width={1}
                    height={25}
                    fontSize={8}
                  />
                )}
                <p className="label-price text-xs font-bold">
                  {formatCurrency(product.sale_price)}
                </p>
              </div>
            ))}
            {labels.length > 20 && (
              <p className="text-sm text-muted-foreground w-full text-center py-2">
                ... e mais {labels.length - 20} etiquetas
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        )}
        <Button onClick={handlePrint} disabled={labels.length === 0}>
          <Printer className="mr-2 h-4 w-4" />
          Imprimir {labels.length} Etiqueta{labels.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
