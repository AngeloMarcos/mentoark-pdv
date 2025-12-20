import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useStockSummary, useStockMovements, useCreateStockMovement, CreateStockMovementInput } from "@/hooks/useStock";
import { useProducts } from "@/hooks/useProducts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, Plus, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown } from "lucide-react";
import { SummaryCardSkeleton, EntryItemSkeleton } from "@/components/ui/skeletons";

const MOVEMENT_TYPES = [
  { value: "purchase", label: "Entrada (Compra)", icon: ArrowUpCircle },
  { value: "adjustment_plus", label: "Ajuste Positivo", icon: TrendingUp },
  { value: "adjustment_minus", label: "Ajuste Negativo", icon: TrendingDown },
];

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Venda", purchase: "Compra", adjustment_plus: "Ajuste +", adjustment_minus: "Ajuste -",
};

const Stock = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateStockMovementInput>({ product_id: "", movement_type: "purchase", quantity: 0, description: "" });

  const { data: summary, isLoading: summaryLoading } = useStockSummary();
  const { data: movements = [], isLoading: movementsLoading } = useStockMovements();
  const { data: products = [] } = useProducts();
  const createMovement = useCreateStockMovement();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const lowStockProducts = summary?.products.filter((p) => p.min_stock !== null && Number(p.stock_current) < Number(p.min_stock)) || [];

  const handleSubmit = async () => {
    if (!form.product_id || form.quantity <= 0) return;
    await createMovement.mutateAsync(form);
    setDialogOpen(false);
    setForm({ product_id: "", movement_type: "purchase", quantity: 0, description: "" });
  };

  return (
    <AppLayout title="Estoque">
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryLoading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Produtos</CardTitle><Package className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{summary?.totalProducts || 0}</div></CardContent></Card>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor em Estoque</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.totalValue || 0)}</div></CardContent></Card>
              <Card className={`stat-card ${(summary?.lowStockCount || 0) > 0 ? "border-warning/50" : ""}`}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle><AlertTriangle className="w-4 h-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold text-warning">{summary?.lowStockCount || 0}</div></CardContent></Card>
              <Card className={`stat-card ${(summary?.outOfStockCount || 0) > 0 ? "border-destructive/50" : ""}`}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sem Estoque</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{summary?.outOfStockCount || 0}</div></CardContent></Card>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)} className="touch-target"><Plus className="w-4 h-4 mr-2" />Nova Movimentação</Button>
        </div>

        <Tabs defaultValue="low-stock">
          <TabsList><TabsTrigger value="low-stock">Estoque Baixo</TabsTrigger><TabsTrigger value="movements">Movimentações</TabsTrigger></TabsList>

          <TabsContent value="low-stock" className="mt-4">
            {lowStockProducts.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum produto com estoque baixo</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {lowStockProducts.map((p) => (
                  <Card key={p.id} className="border-warning/30">
                    <CardContent className="flex items-center gap-4 p-4">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      <div className="flex-1"><div className="font-medium">{p.name}</div><div className="text-sm text-muted-foreground">{p.unit}</div></div>
                      <div className="text-right"><div className="font-semibold text-warning">{p.stock_current}</div><div className="text-xs text-muted-foreground">Mín: {p.min_stock}</div></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="movements" className="mt-4">
            <div className="grid gap-3">
              {movementsLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <EntryItemSkeleton key={i} />
                  ))}
                </>
              ) : (
                movements.slice(0, 50).map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      {Number(m.quantity) > 0 ? <ArrowUpCircle className="w-5 h-5 text-success" /> : <ArrowDownCircle className="w-5 h-5 text-destructive" />}
                      <div className="flex-1"><div className="font-medium">{m.product?.name || "Produto"}</div><div className="text-sm text-muted-foreground">{MOVEMENT_LABELS[m.movement_type] || m.movement_type} • {m.description || ""}</div></div>
                      <div className={`font-semibold ${Number(m.quantity) > 0 ? "text-success" : "text-destructive"}`}>{Number(m.quantity) > 0 ? "+" : ""}{m.quantity} {m.product?.unit || ""}</div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Movement Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Movimentação de Estoque</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2"><Label>Produto *</Label>
                <Select value={form.product_id} onValueChange={(v) => setForm({ ...form, product_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>{products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Tipo *</Label>
                <Select value={form.movement_type} onValueChange={(v: any) => setForm({ ...form, movement_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOVEMENT_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Quantidade *</Label><Input type="number" step="0.001" value={form.quantity || ""} onChange={(e) => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <Button className="w-full" onClick={handleSubmit} disabled={!form.product_id || form.quantity <= 0 || createMovement.isPending}>{createMovement.isPending ? "Salvando..." : "Registrar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Stock;
