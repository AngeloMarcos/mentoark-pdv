import { useState, useRef } from "react";
import { Upload, FileText, Download, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  parseCSV,
  generateTemplate,
  downloadCSV,
  useImportProducts,
  ImportProduct,
} from "@/hooks/useProductImport";

interface ProductImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductImporter({ open, onOpenChange }: ProductImporterProps) {
  const [step, setStep] = useState<"upload" | "preview" | "result">("upload");
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    errors: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importProducts = useImportProducts();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);
      setProducts(parsed);
      setStep("preview");
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    const result = await importProducts.mutateAsync({ products, updateExisting });
    setResult(result);
    setStep("result");
  };

  const handleDownloadTemplate = () => {
    const template = generateTemplate();
    downloadCSV(template, "template_produtos.csv");
  };

  const handleClose = () => {
    setStep("upload");
    setProducts([]);
    setFileName("");
    setResult(null);
    onOpenChange(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === "text/csv") {
      const input = fileInputRef.current;
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        handleFileSelect({ target: input } as React.ChangeEvent<HTMLInputElement>);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Importar Produtos</DialogTitle>
          <DialogDescription>
            Importe produtos em massa usando um arquivo CSV.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-4">
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium">Arraste um arquivo CSV ou clique para selecionar</p>
              <p className="text-sm text-muted-foreground mt-2">
                O arquivo deve estar no formato CSV com separador ponto-e-vírgula (;)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>

            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground">
                  ({products.length} produto(s))
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="updateExisting"
                  checked={updateExisting}
                  onCheckedChange={(checked) => setUpdateExisting(!!checked)}
                />
                <Label htmlFor="updateExisting">Atualizar existentes</Label>
              </div>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.internal_code || "-"}</TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell className="text-right">
                        {product.sale_price.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        {product.stock_current || 0}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button onClick={handleImport} disabled={importProducts.isPending}>
                {importProducts.isPending ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {products.length} produto(s)
                  </>
                )}
              </Button>
            </DialogFooter>

            {importProducts.isPending && (
              <Progress value={50} className="w-full" />
            )}
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              {result.errors.length === 0 ? (
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
              ) : (
                <AlertTriangle className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
              )}
              <h3 className="text-xl font-semibold mb-2">Importação Concluída</h3>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-green-500">{result.created}</div>
                <div className="text-sm text-muted-foreground">Criados</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-blue-500">{result.updated}</div>
                <div className="text-sm text-muted-foreground">Atualizados</div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="text-2xl font-bold text-destructive">
                  {result.errors.length}
                </div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </div>
            </div>

            {result.errors.length > 0 && (
              <ScrollArea className="h-[150px] border rounded-lg p-4">
                <div className="space-y-2">
                  {result.errors.map((error, index) => (
                    <div key={index} className="text-sm text-destructive flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      {error}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
