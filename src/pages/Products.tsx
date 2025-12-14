import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProducts, useCreateProduct, useUpdateProduct, useDeleteProduct, Product, ProductInput } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Search, Plus, Edit, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Products = () => {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>({
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
  });

  const { data: products = [], isLoading } = useProducts(search);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const openCreateDialog = () => {
    setEditingProduct(null);
    setForm({ name: "", sale_price: 0, internal_code: "", barcode: "", category: "", cost_price: null, stock_current: 0, unit: "UN", min_stock: null, active: true });
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
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
    });
    setDialogOpen(true);
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

  return (
    <AppLayout title="Produtos">
      <div className="space-y-4 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou código de barras..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button onClick={openCreateDialog} className="touch-target"><Plus className="w-4 h-4 mr-2" />Novo Produto</Button>
        </div>

        {/* Product List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : products.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">{search ? "Nenhum produto encontrado" : "Nenhum produto cadastrado"}</CardContent></Card>
        ) : (
          <div className="grid gap-3">
            {products.map((product) => (
              <Card key={product.id} className={`${!product.active ? "opacity-60" : ""}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold truncate">{product.name}</h3>
                      {!product.active && <span className="text-xs bg-muted px-2 py-0.5 rounded">Inativo</span>}
                    </div>
                    <p className="text-sm text-muted-foreground">{product.internal_code || product.barcode || "Sem código"} • {product.category || "Sem categoria"}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatCurrency(product.sale_price)}</div>
                    <p className="text-sm text-muted-foreground">Estoque: {product.stock_current} {product.unit}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(product)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { setDeletingId(product.id); setDeleteDialogOpen(true); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
                <div className="space-y-2"><Label>Estoque Atual</Label><Input type="number" step="0.001" value={form.stock_current || 0} onChange={(e) => setForm({ ...form, stock_current: parseFloat(e.target.value) || 0 })} /></div>
                <div className="space-y-2"><Label>Estoque Mínimo</Label><Input type="number" step="0.001" value={form.min_stock || ""} onChange={(e) => setForm({ ...form, min_stock: parseFloat(e.target.value) || null })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked })} /><Label>Produto ativo</Label></div>
              <Button className="w-full" onClick={handleSubmit} disabled={createProduct.isPending || updateProduct.isPending}>{editingProduct ? "Salvar" : "Criar Produto"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Excluir produto?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default Products;
