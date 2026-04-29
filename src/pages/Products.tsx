import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product, ProductInput } from "@/hooks/useProducts";
import { useProductBarcodes, useCreateBarcode, useDeleteBarcode, useGenerateInternalBarcode } from "@/hooks/useBarcodes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Barcode, Tag, Printer, Wand2, Upload, Download, Package, PowerOff, Power, FileSpreadsheet } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ProductCardSkeleton } from "@/components/ui/skeletons";
import { BarcodeGenerator } from "@/components/barcode/BarcodeGenerator";
import { BarcodeLabelPrint } from "@/components/barcode/BarcodeLabelPrint";
import { Checkbox } from "@/components/ui/checkbox";
import { ProductImporter } from "@/components/import/ProductImporter";
import { ProductExporter } from "@/components/import/ProductExporter";
import { LotManager } from "@/components/stock/LotManager";
import { Badge } from "@/components/ui/badge";
import { ProductFormDialog } from "@/components/products/ProductFormDialog";
import { ProductFilters, DEFAULT_PRODUCT_FILTERS, ProductFilterState } from "@/components/products/ProductFilters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExcelExportButton } from "@/components/export/ExcelExportButton";
import { XlsxSheet } from "@/lib/xlsx-utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

const Products = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_PRODUCT_FILTERS);
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

  const { data: products = [], isLoading } = useProducts(filters.search);
  const { data: productBarcodes = [] } = useProductBarcodes(selectedProduct?.id);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const createBarcode = useCreateBarcode();
  const deleteBarcode = useDeleteBarcode();
  const generateBarcode = useGenerateInternalBarcode();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Distinct categories for filter dropdown
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.category && set.add(p.category));
    return Array.from(set).sort();
  }, [products]);

  // Apply client-side filters + sort
  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (filters.category) list = list.filter((p) => p.category === filters.category);
    if (filters.status === "active") list = list.filter((p) => p.active);
    else if (filters.status === "inactive") list = list.filter((p) => !p.active);
    if (filters.stock !== "all") {
      list = list.filter((p) => {
        const stock = Number(p.stock_current) || 0;
        const min = p.min_stock != null ? Number(p.min_stock) : null;
        if (filters.stock === "out") return stock <= 0;
        if (filters.stock === "in_stock") return stock > 0;
        if (filters.stock === "low") return min != null && stock < min;
        return true;
      });
    }
    switch (filters.sortBy) {
      case "price_asc": list.sort((a, b) => Number(a.sale_price) - Number(b.sale_price)); break;
      case "price_desc": list.sort((a, b) => Number(b.sale_price) - Number(a.sale_price)); break;
      case "stock_asc": list.sort((a, b) => Number(a.stock_current) - Number(b.stock_current)); break;
      case "stock_desc": list.sort((a, b) => Number(b.stock_current) - Number(a.stock_current)); break;
      case "newest": list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      default: list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return list;
  }, [products, filters]);

  const openCreateDialog = () => { setEditingProduct(null); setDialogOpen(true); };
  const openEditDialog = (product: Product) => { setEditingProduct(product); setDialogOpen(true); };
  const openBarcodeDialog = (product: Product) => {
    setSelectedProduct(product);
    setNewBarcode({ barcode: "", barcode_type: "EAN13", is_primary: false });
    setBarcodeDialogOpen(true);
  };

  const handleSubmit = async (form: ProductInput & { controls_lot?: boolean; wholesale_price?: number | null; wholesale_min_qty?: number | null }) => {
    if (editingProduct) await updateProduct.mutateAsync({ ...form, id: editingProduct.id });
    else await createProduct.mutateAsync(form);
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
    } catch { /* handled */ }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    if (selectedProducts.size === filteredProducts.length && filteredProducts.length > 0) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleBulkToggleActive = async (active: boolean) => {
    const ids = Array.from(selectedProducts);
    if (ids.length === 0) return;
    const { error } = await supabase.from("products").update({ active }).in("id", ids);
    if (error) {
      toast.error("Erro ao atualizar produtos");
      return;
    }
    toast.success(`${ids.length} produto(s) ${active ? "ativado(s)" : "desativado(s)"}`);
    setSelectedProducts(new Set());
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const selectedProductsForLabels = filteredProducts.filter((p) => selectedProducts.has(p.id));
  const allVisibleSelected = filteredProducts.length > 0 && selectedProducts.size === filteredProducts.length;

  const buildExcelSheets = (): XlsxSheet[] => {
    const list = selectedProducts.size > 0 ? selectedProductsForLabels : filteredProducts;
    const productSheet: XlsxSheet = {
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
        { key: "min_stock", label: "Mínimo", format: "number" },
        { key: "active", label: "Ativo" },
      ],
      data: list.map((p) => ({ ...p, active: p.active ? "Sim" : "Não" })),
    };

    const totalValue = list.reduce(
      (sum, p) => sum + Number(p.stock_current) * Number(p.cost_price || p.sale_price || 0), 0
    );
    const summary: XlsxSheet = {
      name: "Resumo",
      columns: [
        { key: "metric", label: "Métrica" },
        { key: "value", label: "Valor" },
      ],
      data: [
        { metric: "Total de produtos", value: list.length },
        { metric: "Ativos", value: list.filter((p) => p.active).length },
        { metric: "Inativos", value: list.filter((p) => !p.active).length },
        { metric: "Valor em estoque (custo)", value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalValue) },
        { metric: "Categorias distintas", value: new Set(list.map((p) => p.category).filter(Boolean)).size },
        { metric: "Gerado em", value: new Date().toLocaleString("pt-BR") },
      ],
    };

    return [productSheet, summary];
  };

  return (
    <AppLayout title="Produtos">
      <div className="space-y-4 animate-fade-in">
        {/* Header actions */}
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importar
          </Button>
          <ExcelExportButton
            filenamePrefix="catalogo_produtos"
            getSheets={buildExcelSheets}
            label={selectedProducts.size > 0 ? `Excel (${selectedProducts.size})` : "Excel"}
          />
          <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
            <Download className="w-4 h-4 mr-2" /> Outros formatos
          </Button>
          <Button onClick={openCreateDialog} className="touch-target">
            <Plus className="w-4 h-4 mr-2" /> Novo Produto
          </Button>
        </div>

        {/* Filters */}
        <ProductFilters
          filters={filters}
          onChange={setFilters}
          categories={categories}
          showing={filteredProducts.length}
          total={products.length}
        />

        {/* Bulk actions bar */}
        {selectedProducts.size > 0 && (
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-2 py-3">
              <span className="text-sm font-medium mr-2">{selectedProducts.size} selecionado(s)</span>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggleActive(true)}>
                <Power className="w-3 h-3 mr-1" /> Ativar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleBulkToggleActive(false)}>
                <PowerOff className="w-3 h-3 mr-1" /> Desativar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLabelPrintDialogOpen(true)}>
                <Printer className="w-3 h-3 mr-1" /> Etiquetas
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedProducts(new Set())}>Limpar seleção</Button>
            </CardContent>
          </Card>
        )}

        {/* Product List */}
        {isLoading ? (
          <div className="grid gap-3">
            {[1, 2, 3, 4, 5].map((i) => (<ProductCardSkeleton key={i} />))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum produto encontrado com os filtros atuais</CardContent></Card>
        ) : filters.view === "table" ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAllVisible} />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    <TableHead className="text-right">Estoque</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => {
                    const stock = Number(product.stock_current) || 0;
                    const min = product.min_stock != null ? Number(product.min_stock) : null;
                    const stockBadge = stock <= 0 ? { label: "Sem estoque", variant: "destructive" as const }
                      : (min != null && stock < min) ? { label: "Baixo", variant: "secondary" as const }
                      : null;
                    return (
                      <TableRow key={product.id} className={!product.active ? "opacity-60" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedProducts.has(product.id)} onCheckedChange={() => toggleProductSelection(product.id)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">{product.internal_code || product.barcode || "—"}</div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{product.category || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(product.sale_price)}</TableCell>
                        <TableCell className="text-right">{product.stock_current} {product.unit}</TableCell>
                        <TableCell className="text-center">
                          {!product.active ? <Badge variant="outline">Inativo</Badge>
                            : stockBadge ? <Badge variant={stockBadge.variant}>{stockBadge.label}</Badge>
                            : <Badge variant="outline">OK</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openBarcodeDialog(product)} title="Códigos de barras"><Barcode className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}><Edit className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => { setDeletingId(product.id); setDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredProducts.map((product) => {
              const extProduct = product as Product & { controls_lot?: boolean };
              const stock = Number(product.stock_current) || 0;
              const min = product.min_stock != null ? Number(product.min_stock) : null;
              const stockBadge = stock <= 0 ? { label: "Sem estoque", variant: "destructive" as const }
                : (min != null && stock < min) ? { label: "Baixo", variant: "secondary" as const }
                : null;
              return (
                <Card key={product.id} className={`${!product.active ? "opacity-60" : ""}`}>
                  <CardContent className="flex items-center gap-4 p-4">
                    <Checkbox checked={selectedProducts.has(product.id)} onCheckedChange={() => toggleProductSelection(product.id)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{product.name}</h3>
                        {!product.active && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                        {stockBadge && <Badge variant={stockBadge.variant} className="text-xs">{stockBadge.label}</Badge>}
                        {extProduct.controls_lot && (<Badge variant="outline" className="text-xs"><Package className="w-3 h-3 mr-1" />Lote</Badge>)}
                      </div>
                      <p className="text-sm text-muted-foreground">{product.internal_code || product.barcode || "Sem código"} • {product.category || "Sem categoria"}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(product.sale_price)}</div>
                      <p className="text-sm text-muted-foreground">Estoque: {product.stock_current} {product.unit}</p>
                    </div>
                    <div className="flex gap-1">
                      {extProduct.controls_lot && (<LotManager productId={product.id} productName={product.name} />)}
                      <Button variant="ghost" size="icon" onClick={() => openBarcodeDialog(product)} title="Gerenciar códigos de barras"><Barcode className="w-4 h-4" /></Button>
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
        <ProductFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingProduct={editingProduct}
          onSubmit={handleSubmit}
          isPending={createProduct.isPending || updateProduct.isPending}
        />

        {/* Barcode Management Dialog */}
        <Dialog open={barcodeDialogOpen} onOpenChange={setBarcodeDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Barcode className="w-5 h-5" /> Códigos de Barras - {selectedProduct?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
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
                          <p className="text-xs text-muted-foreground">{bc.barcode_type} {bc.is_primary && "• Principal"}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => deleteBarcode.mutate(bc.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-3">
                <Label>Adicionar Novo Código</Label>
                <div className="flex gap-2">
                  <Input placeholder="Digite ou leia o código" value={newBarcode.barcode} onChange={(e) => setNewBarcode({ ...newBarcode, barcode: e.target.value })} className="flex-1" />
                  <Button variant="outline" onClick={handleGenerateBarcode} disabled={generateBarcode.isPending} title="Gerar código interno"><Wand2 className="w-4 h-4" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select value={newBarcode.barcode_type} onValueChange={(v) => setNewBarcode({ ...newBarcode, barcode_type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <Switch checked={newBarcode.is_primary} onCheckedChange={(checked) => setNewBarcode({ ...newBarcode, is_primary: checked })} />
                      <Label className="font-normal">Código principal</Label>
                    </div>
                  </div>
                </div>
                <Button className="w-full" onClick={handleAddBarcode} disabled={!newBarcode.barcode || createBarcode.isPending}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Código
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Label Print Dialog */}
        <Dialog open={labelPrintDialogOpen} onOpenChange={setLabelPrintDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Tag className="w-5 h-5" /> Imprimir Etiquetas</DialogTitle>
            </DialogHeader>
            <BarcodeLabelPrint products={selectedProductsForLabels} onClose={() => { setLabelPrintDialogOpen(false); setSelectedProducts(new Set()); }} />
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir produto?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <ProductImporter open={importDialogOpen} onOpenChange={setImportDialogOpen} />
        <ProductExporter open={exportDialogOpen} onOpenChange={setExportDialogOpen} />
      </div>
    </AppLayout>
  );
};

export default Products;
