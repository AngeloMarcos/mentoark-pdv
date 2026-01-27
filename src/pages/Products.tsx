import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product, ProductInput } from "@/hooks/useProducts";
import { useProductBarcodes, useCreateBarcode, useDeleteBarcode, useGenerateInternalBarcode, ProductBarcode } from "@/hooks/useBarcodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Edit, Trash2, Barcode, Tag, Printer, Wand2, Upload, Download, Package } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ProductCardSkeleton } from "@/components/ui/skeletons";
import { BarcodeGenerator } from "@/components/barcode/BarcodeGenerator";
import { BarcodeLabelPrint } from "@/components/barcode/BarcodeLabelPrint";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductImporter } from "@/components/import/ProductImporter";
import { ProductExporter } from "@/components/import/ProductExporter";
import { LotManager } from "@/components/stock/LotManager";
import { Badge } from "@/components/ui/badge";

interface ExtendedProductInput extends ProductInput {
  controls_lot?: boolean;
  wholesale_price?: number | null;
  wholesale_min_qty?: number | null;
}

const Products = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [barcodeDialogOpen, setBarcodeDialogOpen] = useState(false);
  const [labelPrintDialogOpen, setLabelPrintDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [newBarcode, setNewBarcode] = useState({ barcode: "", barcode_type: "EAN13" as "EAN8" | "EAN13" | "INTERNAL", is_primary: false });
  const [form, setForm] = useState<ExtendedProductInput>({
    name: "",
    sale_price: 0,
    internal_code: "",
    barcode: "",
    category: "",
    cost_price: null,
    stock_current: 0,
    unit: "UN",
    min_stock: null,
    active: true,
    controls_lot: false,
    wholesale_price: null,
    wholesale_min_qty: null,
  });

  const { data: products = [], isLoading } = useProducts(search);
  const { data: productBarcodes = [] } = useProductBarcodes(selectedProduct?.id);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createBarcode = useCreateBarcode();
  const deleteBarcode = useDeleteBarcode();
  const generateBarcode = useGenerateInternalBarcode();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setForm({ name: "", sale_price: 0, internal_code: "", barcode: "", category: "", cost_price: null, stock_current: 0, unit: "UN", min_stock: null, active: true, controls_lot: false, wholesale_price: null, wholesale_min_qty: null });
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    const extProduct = product as Product & { controls_lot?: boolean; wholesale_price?: number | null; wholesale_min_qty?: number | null };
    setForm({
      name: product.name,
      sale_price: product.sale_price,
      internal_code: product.internal_code,
      barcode: product.barcode,
      category: product.category,
      cost_price: product.cost_price,
      stock_current: product.stock_current,
      unit: product.unit,
      min_stock: product.min_stock,
      active: product.active,
      controls_lot: extProduct.controls_lot || false,
      wholesale_price: extProduct.wholesale_price || null,
      wholesale_min_qty: extProduct.wholesale_min_qty || null,
    });
    setDialogOpen(true);
  };

  const openBarcodeDialog = (product: Product) => {
    setSelectedProduct(product);
    setNewBarcode({ barcode: "", barcode_type: "EAN13", is_primary: false });
    setBarcodeDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || form.sale_price <= 0) return;

    if (editingProduct) {
      await updateProduct.mutateAsync({ ...form, id: editingProduct.id });
    } else {
      await createProduct.mutateAsync(form);
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    await deleteProduct.mutateAsync(deletingId);
    setDeleteDialogOpen(false);
    setDeletingId(null);
  };

  const handleAddBarcode = async () => {
    if (!selectedProduct || !newBarcode.barcode) return;
    await createBarcode.mutateAsync({
      product_id: selectedProduct.id,
      barcode: newBarcode.barcode,
      barcode_type: newBarcode.barcode_type,
      is_primary: newBarcode.is_primary,
    });
    setNewBarcode({ barcode: "", barcode_type: "EAN13", is_primary: false });
  };

  const handleGenerateBarcode = async () => {
    try {
      const code = await generateBarcode.mutateAsync();
      setNewBarcode((prev) => ({ ...prev, barcode: code, barcode_type: "INTERNAL" }));
    } catch {
      // Error handled by hook
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectedProductsForLabels = products.filter((p) => selectedProducts.has(p.id));

  return (
    <AppLayout title="Produtos">
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou código de barras..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <Upload className="w-4 h-4 mr-2" />
              Importar
            </Button>
            <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
            {selectedProducts.size > 0 && (
              <Button variant="outline" onClick={() => setLabelPrintDialogOpen(true)}>
                <Printer className="w-4 h-4 mr-2" />
                Etiquetas ({selectedProducts.size})
              </Button>
            )}
            <Button onClick={openCreateDialog} className="touch-target"><Plus className="w-4 h-4 mr-2" />Novo Produto</Button>
          </div>
        </div>

        {/* Product List */}
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">{search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {products.map((product) => {
              const extProduct = product as Product & { controls_lot?: boolean };
              return (
                <Card key={product.id} className={`${!product.active ? "opacity-60" : ""}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <Checkbox
                      checked={selectedProducts.has(product.id)}
                      onCheckedChange={() => toggleProductSelection(product.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{product.name}</h3>
                        {!product.active && <span className="text-xs bg-muted px-2 py-0.5 rounded">Inativo</span>}
                        {extProduct.controls_lot && (
                          <Badge variant="outline" className="text-xs">
                            <Package className="w-3 h-3 mr-1" />
                            Lote
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{product.internal_code || product.barcode || "Sem código"} • {product.category || "Sem categoria"}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(product.sale_price)}</div>
                      <p className="text-sm text-muted-foreground">Estoque: {product.stock_current} {product.unit}</p>
                    </div>
                    <div className="flex gap-1">
                      {extProduct.controls_lot && (
                        <LotManager productId={product.id} productName={product.name} />
                      )}
                      <Button variant="ghost" size="icon" onClick={() => openBarcodeDialog(product)} title="Gerenciar códigos de barras">
                        <Barcode className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { setDeletingId(product.id); setDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2"><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Código Interno</Label><Input value={form.internal_code || ""} onChange={(e) => setForm({ ...form, internal_code: e.target.value })} /></div>
                <div className="space-y-2"><Label>Código de Barras</Label><Input value={form.barcode || ""} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></div>
                <div className="space-y-2"><Label>Categoria</Label><Input value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
                <div className="space-y-2"><Label>Unidade</Label><Input value={form.unit || "UN"} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
                <div className="space-y-2"><Label>Preço de Venda *</Label><Input type="number" step="0.01" value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Preço de Custo</Label><Input type="number" step="0.01" value={form.cost_price || ""} onChange={(e) => setForm({ ...form, cost_price: parseFloat(e.target.value) || null })} /></div>
                <div className="space-y-2"><Label>Preço Atacado</Label><Input type="number" step="0.01" value={form.wholesale_price || ""} onChange={(e) => setForm({ ...form, wholesale_price: parseFloat(e.target.value) || null })} /></div>
                <div className="space-y-2"><Label>Qtd Mín. Atacado</Label><Input type="number" step="0.001" value={form.wholesale_min_qty || ""} onChange={(e) => setForm({ ...form, wholesale_min_qty: parseFloat(e.target.value) || null })} /></div>
                <div className="space-y-2"><Label>Estoque Atual</Label><Input type="number" step="0.001" value={form.stock_current || 0} onChange={(e) => setForm({ ...form, stock_current: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Estoque Mínimo</Label><Input type="number" step="0.001" value={form.min_stock || ""} onChange={(e) => setForm({ ...form, min_stock: parseFloat(e.target.value) || null })} /></div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked })} /><Label>Produto ativo</Label></div>
                <div className="flex items-center gap-2"><Switch checked={form.controls_lot} onCheckedChange={(checked) => setForm({ ...form, controls_lot: checked })} /><Label>Controla lote/validade</Label></div>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>{editingProduct ? "Salvar" : "Criar Produto"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Barcode Management Dialog */}
        <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Barcode className="w-5 h-5" />
                Códigos de Barras - {selectedProduct?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              {/* Lista de códigos existentes */}
              <div className="space-y-2">
                <Label>Códigos Cadastrados</Label>
                {productBarcodes.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum código de barras cadastrado</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {productBarcodes.map((bc) => (
                      <div key={bc.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <BarcodeGenerator value={bc.barcode} width={1} height={30} displayValue={false} />
                        <div className="flex-1">
                          <p className="font-mono text-sm">{bc.barcode}</p>
                          <p className="text-xs text-muted-foreground">
                            {bc.barcode_type} {bc.is_primary && "• Principal"}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteBarcode.mutate(bc.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Adicionar novo código */}
              <div className="border-t pt-4 space-y-3">
                <Label>Adicionar Novo Código</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Digite ou leia o código"
                    value={newBarcode.barcode}
                    onChange={(e) => setNewBarcode({ ...newBarcode, barcode: e.target.value })}
                    className="flex-1"
                  />
                  <Button variant="outline" onClick={handleGenerateBarcode} disabled={generateBarcode.isPending} title="Gerar código interno">
                    <Wand2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newBarcode.barcode_type} onValueChange={(v) => setNewBarcode({ ...newBarcode, barcode_type: v as any })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EAN13">EAN-13</SelectItem>
                        <SelectItem value="EAN8">EAN-8</SelectItem>
                        <SelectItem value="INTERNAL">Interno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>&nbsp;</Label>
                    <div className="flex items-center gap-2 h-10">
                      <Switch
                        checked={newBarcode.is_primary}
                        onCheckedChange={(checked) => setNewBarcode({ ...newBarcode, is_primary: checked })}
                      />
                      <Label className="font-normal">Código principal</Label>
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={handleAddBarcode} disabled={!newBarcode.barcode || createBarcode.isPending}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Código
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Label Print Dialog */}
        <Dialog open={labelPrintDialogOpen} onOpenChange={setLabelPrintDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Imprimir Etiquetas
              </DialogTitle>
            </DialogHeader>
            <BarcodeLabelPrint
              products={selectedProductsForLabels}
              onClose={() => {
                setLabelPrintDialogOpen(false);
                setSelectedProducts(new Set());
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir produto?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Import/Export Dialogs */}
        <ProductImporter open={importDialogOpen} onOpenChange={setImportDialogOpen} />
        <ProductExporter open={exportDialogOpen} onOpenChange={setExportDialogOpen} />
      </div>
    </AppLayout>
  );
};

export default Products;
