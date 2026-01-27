import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useStockSummary, useStockMovements, useCreateStockMovement, CreateStockMovementInput } from "@/hooks/useStock";
import { useProducts } from "@/hooks/useProducts";
import { useExpiringProducts } from "@/hooks/useLots";
import { useLots } from "@/hooks/useLots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, Plus, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, DollarSign, PackageX, Calendar, ClipboardList } from "lucide-react";
import { SummaryCardSkeleton, EntryItemSkeleton } from "@/components/ui/skeletons";
import { ExpiryAlerts } from "@/components/stock/ExpiryAlerts";
import { LotManager } from "@/components/stock/LotManager";

const MOVEMENT_TYPES = [
  { value: "purchase", label: "Entrada (Compra)", icon: ArrowUpCircle },
  { value: "adjustment_plus", label: "Ajuste Positivo", icon: TrendingUp },
  { value: "adjustment_minus", label: "Ajuste Negativo", icon: TrendingDown },
];

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Venda", purchase: "Compra", adjustment_plus: "Ajuste +", adjustment_minus: "Ajuste -",
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const Stock = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateStockMovementInput>({ product_id: "", movement_type: "purchase", quantity: 0, description: "" });
  const [lotSearch, setLotSearch] = useState("");

  const { data: summary, isLoading: summaryLoading } = useStockSummary();
  const { data: movements = [], isLoading: movementsLoading } = useStockMovements();
  const { data: products = [] } = useProducts();
  const { data: expiringProducts = [] } = useExpiringProducts(30);
  const { data: allLots = [] } = useLots();
  const createMovement = useCreateStockMovement();

  // Filter only active products for the select dropdown
  const activeProducts = products.filter((p) => p.active !== false);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const lowStockProducts = summary?.products.filter((p) => p.min_stock !== null && Number(p.stock_current) < Number(p.min_stock)) || [];

  // Filter lots by search
  const filteredLots = allLots.filter((lot) => {
    if (!lotSearch) return true;
    const search = lotSearch.toLowerCase();
    return (
      lot.product?.name?.toLowerCase().includes(search) ||
      lot.lot_number.toLowerCase().includes(search)
    );
  });

  // Group lots by product
  const lotsByProduct = filteredLots.reduce((acc, lot) => {
    const productName = lot.product?.name || "Sem produto";
    if (!acc[productName]) {
      acc[productName] = [];
    }
    acc[productName].push(lot);
    return acc;
  }, {} as Record<string, typeof allLots>);

  const handleSubmit = async () => {
    if (!form.product_id || form.quantity <= 0) return;
    try {
      await createMovement.mutateAsync(form);
      setDialogOpen(false);
      setForm({ product_id: "", movement_type: "purchase", quantity: 0, description: "" });
    } catch {
      // Error is already handled by the mutation's onError
    }
  };

  return (
    <AppLayout title="Estoque">
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {summaryLoading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Produtos</CardTitle><Package className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{summary?.totalProducts || 0}</div></CardContent></Card>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Valor em Estoque</CardTitle><DollarSign className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(summary?.totalValue || 0)}</div></CardContent></Card>
              <Card className={`stat-card ${(summary?.lowStockCount || 0) > 0 ? "border-warning/50" : ""}`}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Estoque Baixo</CardTitle><AlertTriangle className="w-4 h-4 text-warning" /></CardHeader><CardContent><div className="text-2xl font-bold text-warning">{summary?.lowStockCount || 0}</div></CardContent></Card>
              <Card className={`stat-card ${(summary?.outOfStockCount || 0) > 0 ? "border-destructive/50" : ""}`}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Sem Estoque</CardTitle><PackageX className="w-4 h-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{summary?.outOfStockCount || 0}</div></CardContent></Card>
              <Card className={`stat-card ${expiringProducts.length > 0 ? "border-yellow-500/50" : ""}`}><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Vencendo</CardTitle><Calendar className="w-4 h-4 text-yellow-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-yellow-500">{expiringProducts.length}</div></CardContent></Card>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => navigate("/inventory")}>
            <ClipboardList className="w-4 h-4 mr-2" />
            Inventário
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="touch-target"><Plus className="w-4 h-4 mr-2" />Nova Movimentação</Button>
        </div>

        <Tabs defaultValue="low-stock">
          <TabsList>
            <TabsTrigger value="low-stock">
              Estoque Baixo
              {lowStockProducts.length > 0 && (
                <Badge variant="secondary" className="ml-2">{lowStockProducts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="movements">Movimentações</TabsTrigger>
            <TabsTrigger value="expiring">
              Vencendo
              {expiringProducts.length > 0 && (
                <Badge variant="destructive" className="ml-2">{expiringProducts.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="lots">Lotes</TabsTrigger>
          </TabsList>

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
              ) : movements.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma movimentação registrada</CardContent></Card>
              ) : (
                movements.slice(0, 50).map((m) => (
                  <Card key={m.id}>
                    <CardContent className="flex items-center gap-4 p-4">
                      {Number(m.quantity) > 0 ? <ArrowUpCircle className="w-5 h-5 text-success" /> : <ArrowDownCircle className="w-5 h-5 text-destructive" />}
                      <div className="flex-1">
                        <div className="font-medium">{m.product?.name || "Produto"}</div>
                        <div className="text-sm text-muted-foreground">{MOVEMENT_LABELS[m.movement_type] || m.movement_type}{m.description ? ` • ${m.description}` : ""}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{formatDate(m.created_at)}</div>
                      </div>
                      <div className={`font-semibold ${Number(m.quantity) > 0 ? "text-success" : "text-destructive"}`}>{Number(m.quantity) > 0 ? "+" : ""}{m.quantity} {m.product?.unit || ""}</div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="expiring" className="mt-4">
            <ExpiryAlerts />
          </TabsContent>

          <TabsContent value="lots" className="mt-4">
            <div className="space-y-4">
              <Input
                placeholder="Buscar por produto ou número do lote..."
                value={lotSearch}
                onChange={(e) => setLotSearch(e.target.value)}
              />
              {Object.keys(lotsByProduct).length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum lote cadastrado</CardContent></Card>
              ) : (
                <div className="space-y-4">
                  {Object.entries(lotsByProduct).map(([productName, lots]) => (
                    <Card key={productName}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center justify-between">
                          <span>{productName}</span>
                          <Badge variant="outline">{lots.length} lote(s)</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {lots.map((lot) => (
                            <div key={lot.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                              <div>
                                <span className="font-medium">{lot.lot_number}</span>
                                <span className="text-muted-foreground text-sm ml-2">
                                  Qtd: {lot.quantity}
                                </span>
                              </div>
                              {lot.expiry_date && (
                                <span className="text-sm text-muted-foreground">
                                  Val: {new Date(lot.expiry_date).toLocaleDateString("pt-BR")}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
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
                  <SelectContent>{activeProducts.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
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
