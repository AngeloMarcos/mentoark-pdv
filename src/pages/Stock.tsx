import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useStockSummary, useStockMovements, useCreateStockMovement, CreateStockMovementInput } from "@/hooks/useStock";
import { useProducts } from "@/hooks/useProducts";
import { useFindByBarcode } from "@/hooks/useBarcodes";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useExpiringProducts, useLots } from "@/hooks/useLots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, Plus, ArrowUpCircle, ArrowDownCircle, TrendingUp, TrendingDown, DollarSign, PackageX, Calendar, ClipboardList, Search } from "lucide-react";
import { SummaryCardSkeleton, EntryItemSkeleton } from "@/components/ui/skeletons";
import { ExpiryAlerts } from "@/components/stock/ExpiryAlerts";
import { StockPositionTab, StockPositionProduct } from "@/components/stock/StockPositionTab";
import { ExcelExportButton } from "@/components/export/ExcelExportButton";
import { XlsxSheet } from "@/lib/xlsx-utils";
import { toast } from "sonner";

const MOVEMENT_TYPES = [
  { value: "purchase", label: "Entrada (Compra)", icon: ArrowUpCircle },
  { value: "adjustment_plus", label: "Ajuste Positivo", icon: TrendingUp },
  { value: "adjustment_minus", label: "Ajuste Negativo", icon: TrendingDown },
];

const MOVEMENT_LABELS: Record<string, string> = {
  sale: "Venda", purchase: "Compra", adjustment_plus: "Ajuste +", adjustment_minus: "Ajuste -",
};

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const Stock = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateStockMovementInput>({ product_id: "", movement_type: "purchase", quantity: 0, description: "" });
  const [lotSearch, setLotSearch] = useState("");
  const [lotFilter, setLotFilter] = useState<"all" | "expiring" | "expired">("all");
  const [movFilterType, setMovFilterType] = useState<string>("all");
  const [movFilterPeriod, setMovFilterPeriod] = useState<"7" | "30" | "90" | "all">("30");
  const [movSearch, setMovSearch] = useState("");
  const [lowStockMode, setLowStockMode] = useState<"low" | "low_and_out">("low");

  const { data: summary, isLoading: summaryLoading } = useStockSummary();
  const { data: movements = [], isLoading: movementsLoading } = useStockMovements();
  const { data: products = [] } = useProducts();
  const { data: expiringProducts = [] } = useExpiringProducts(30);
  const { data: allLots = [] } = useLots();
  const createMovement = useCreateStockMovement();
  const findByBarcode = useFindByBarcode();

  useBarcodeScanner(async (code) => {
    try {
      const product = await findByBarcode.mutateAsync(code);
      if (product) {
        setForm({ product_id: product.id, movement_type: "purchase", quantity: 1, description: `Leitura ${code}` });
        setDialogOpen(true);
        toast.success(`${product.name} pré-selecionado`);
      } else {
        toast.error(`Produto não encontrado: ${code}`);
      }
    } catch {
      toast.error("Erro ao buscar produto");
    }
  });

  const activeProducts = products.filter((p) => p.active !== false);

  const lowStockProducts = useMemo(
    () => summary?.products.filter((p) => p.min_stock !== null && Number(p.stock_current) < Number(p.min_stock)) || [],
    [summary]
  );
  const outOfStockProducts = useMemo(
    () => summary?.products.filter((p) => Number(p.stock_current) <= 0) || [],
    [summary]
  );
  const lowStockShown = useMemo(() => {
    const base = lowStockMode === "low_and_out"
      ? Array.from(new Map([...lowStockProducts, ...outOfStockProducts].map((p) => [p.id, p])).values())
      : lowStockProducts;
    return [...base].sort((a, b) => {
      const da = Number(a.min_stock ?? 0) - Number(a.stock_current);
      const db = Number(b.min_stock ?? 0) - Number(b.stock_current);
      return db - da;
    });
  }, [lowStockProducts, outOfStockProducts, lowStockMode]);

  // Position data
  const positionProducts: StockPositionProduct[] = useMemo(() => {
    return (summary?.products || []).map((p) => ({
      id: p.id,
      name: p.name,
      category: (p as any).category ?? null,
      unit: p.unit,
      stock_current: Number(p.stock_current),
      min_stock: p.min_stock != null ? Number(p.min_stock) : null,
      cost_price: p.cost_price != null ? Number(p.cost_price) : null,
      sale_price: Number(p.sale_price),
    }));
  }, [summary]);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    const now = Date.now();
    const days = movFilterPeriod === "all" ? Infinity : Number(movFilterPeriod);
    const cutoff = now - days * 86400000;
    const s = movSearch.trim().toLowerCase();
    return movements.filter((m) => {
      if (movFilterType !== "all" && m.movement_type !== movFilterType) return false;
      if (Number.isFinite(days) && new Date(m.created_at).getTime() < cutoff) return false;
      if (s && !(m.product?.name?.toLowerCase().includes(s) || m.description?.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [movements, movFilterType, movFilterPeriod, movSearch]);

  // Filtered lots
  const filteredLots = useMemo(() => {
    const now = Date.now();
    return allLots.filter((lot) => {
      if (lotSearch) {
        const s = lotSearch.toLowerCase();
        if (!(lot.product?.name?.toLowerCase().includes(s) || lot.lot_number.toLowerCase().includes(s))) return false;
      }
      if (lotFilter === "expiring") {
        if (!lot.expiry_date) return false;
        const days = (new Date(lot.expiry_date).getTime() - now) / 86400000;
        return days >= 0 && days <= 30;
      }
      if (lotFilter === "expired") {
        if (!lot.expiry_date) return false;
        return new Date(lot.expiry_date).getTime() < now;
      }
      return true;
    });
  }, [allLots, lotSearch, lotFilter]);

  const lotsByProduct = filteredLots.reduce((acc, lot) => {
    const name = lot.product?.name || "Sem produto";
    if (!acc[name]) acc[name] = [];
    acc[name].push(lot);
    return acc;
  }, {} as Record<string, typeof allLots>);

  const handleSubmit = async () => {
    if (!form.product_id || form.quantity <= 0) return;
    try {
      await createMovement.mutateAsync(form);
      setDialogOpen(false);
      setForm({ product_id: "", movement_type: "purchase", quantity: 0, description: "" });
    } catch { /* handled */ }
  };

  const handleReplenish = (p: StockPositionProduct | { id: string; name: string; min_stock: number | null; stock_current: number }) => {
    const min = Number((p as any).min_stock || 0);
    const current = Number(p.stock_current || 0);
    const suggested = Math.max(min - current, 1);
    setForm({
      product_id: p.id,
      movement_type: "purchase",
      quantity: suggested,
      description: `Reposição de ${p.name}`,
    });
    setDialogOpen(true);
  };

  // Excel export — multi-sheet workbook
  const buildExcelSheets = (): XlsxSheet[] => {
    const sheets: XlsxSheet[] = [];

    // Resumo
    sheets.push({
      name: "Resumo",
      columns: [{ key: "metric", label: "Métrica" }, { key: "value", label: "Valor" }],
      data: [
        { metric: "Total de produtos", value: summary?.totalProducts || 0 },
        { metric: "Valor em estoque", value: formatCurrency(summary?.totalValue || 0) },
        { metric: "Estoque baixo", value: summary?.lowStockCount || 0 },
        { metric: "Sem estoque", value: summary?.outOfStockCount || 0 },
        { metric: "Lotes vencendo (30d)", value: expiringProducts.length },
        { metric: "Gerado em", value: new Date().toLocaleString("pt-BR") },
      ],
    });

    // Posição de Estoque
    sheets.push({
      name: "Posição de Estoque",
      columns: [
        { key: "name", label: "Produto" },
        { key: "category", label: "Categoria" },
        { key: "unit", label: "Unidade" },
        { key: "stock_current", label: "Estoque", format: "number" },
        { key: "min_stock", label: "Mínimo", format: "number" },
        { key: "cost_price", label: "Custo", format: "currency" },
        { key: "sale_price", label: "Preço venda", format: "currency" },
        { key: "stock_value", label: "Valor em estoque", format: "currency" },
        { key: "status", label: "Status" },
      ],
      data: positionProducts.map((p) => {
        const stock = Number(p.stock_current);
        const status = stock <= 0 ? "Sem estoque" : (p.min_stock != null && stock < Number(p.min_stock) ? "Baixo" : "OK");
        return {
          ...p,
          stock_value: stock * Number(p.cost_price || p.sale_price || 0),
          status,
        };
      }),
    });

    // Estoque Baixo
    sheets.push({
      name: "Estoque Baixo",
      columns: [
        { key: "name", label: "Produto" },
        { key: "stock_current", label: "Atual", format: "number" },
        { key: "min_stock", label: "Mínimo", format: "number" },
        { key: "deficit", label: "Déficit", format: "number" },
        { key: "unit", label: "Unidade" },
      ],
      data: lowStockProducts.map((p) => ({
        ...p,
        deficit: Math.max(Number(p.min_stock || 0) - Number(p.stock_current), 0),
      })),
    });

    // Sem Estoque
    sheets.push({
      name: "Sem Estoque",
      columns: [
        { key: "name", label: "Produto" },
        { key: "unit", label: "Unidade" },
        { key: "min_stock", label: "Mínimo", format: "number" },
      ],
      data: outOfStockProducts.map((p) => ({ ...p })),
    });

    // Movimentações (filtradas)
    sheets.push({
      name: "Movimentações",
      columns: [
        { key: "created_at", label: "Data", format: "datetime" },
        { key: "product_name", label: "Produto" },
        { key: "movement_type", label: "Tipo" },
        { key: "quantity", label: "Quantidade", format: "number" },
        { key: "unit", label: "Unidade" },
        { key: "description", label: "Descrição" },
      ],
      data: filteredMovements.map((m) => ({
        created_at: m.created_at,
        product_name: m.product?.name || "—",
        movement_type: MOVEMENT_LABELS[m.movement_type] || m.movement_type,
        quantity: Number(m.quantity),
        unit: m.product?.unit || "",
        description: m.description || "",
      })),
    });

    // Lotes & Validade
    const today = Date.now();
    sheets.push({
      name: "Lotes e Validade",
      columns: [
        { key: "product_name", label: "Produto" },
        { key: "lot_number", label: "Lote" },
        { key: "quantity", label: "Quantidade", format: "number" },
        { key: "manufacture_date", label: "Fabricação", format: "date" },
        { key: "expiry_date", label: "Validade", format: "date" },
        { key: "days_to_expiry", label: "Dias p/ vencer", format: "integer" },
        { key: "status", label: "Status" },
      ],
      data: allLots.map((lot) => {
        const days = lot.expiry_date ? Math.floor((new Date(lot.expiry_date).getTime() - today) / 86400000) : null;
        return {
          product_name: lot.product?.name || "—",
          lot_number: lot.lot_number,
          quantity: Number(lot.quantity),
          manufacture_date: lot.manufacture_date,
          expiry_date: lot.expiry_date,
          days_to_expiry: days,
          status: lot.status,
        };
      }),
    });

    return sheets;
  };

  return (
    <AppLayout title="Estoque">
      <div className="space-y-6 animate-fade-in">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {summaryLoading ? (
            <>{[1,2,3,4,5].map((i) => <SummaryCardSkeleton key={i} />)}</>
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

        <div className="flex justify-end gap-2 flex-wrap">
          <ExcelExportButton filenamePrefix="estoque_completo" getSheets={buildExcelSheets} />
          <Button variant="outline" onClick={() => navigate("/inventory")}>
            <ClipboardList className="w-4 h-4 mr-2" /> Inventário
          </Button>
          <Button onClick={() => setDialogOpen(true)} className="touch-target"><Plus className="w-4 h-4 mr-2" />Nova Movimentação</Button>
        </div>

        <Tabs defaultValue="position">
          <TabsList>
            <TabsTrigger value="position">Posição</TabsTrigger>
            <TabsTrigger value="low-stock">
              Estoque Baixo
              {lowStockProducts.length > 0 && (<Badge variant="secondary" className="ml-2">{lowStockProducts.length}</Badge>)}
            </TabsTrigger>
            <TabsTrigger value="movements">Movimentações</TabsTrigger>
            <TabsTrigger value="expiring">
              Vencendo
              {expiringProducts.length > 0 && (<Badge variant="destructive" className="ml-2">{expiringProducts.length}</Badge>)}
            </TabsTrigger>
            <TabsTrigger value="lots">Lotes</TabsTrigger>
          </TabsList>

          <TabsContent value="position" className="mt-4">
            <StockPositionTab products={positionProducts} onReplenish={handleReplenish} />
          </TabsContent>

          <TabsContent value="low-stock" className="mt-4 space-y-3">
            <div className="flex justify-between items-center">
              <Select value={lowStockMode} onValueChange={(v: "low" | "low_and_out") => setLowStockMode(v)}>
                <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Apenas estoque baixo</SelectItem>
                  <SelectItem value="low_and_out">Baixo + sem estoque</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{lowStockShown.length} produto(s)</span>
            </div>
            {lowStockShown.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum produto nesta lista</CardContent></Card>
            ) : (
              <div className="grid gap-3">
                {lowStockShown.map((p) => {
                  const isOut = Number(p.stock_current) <= 0;
                  return (
                    <Card key={p.id} className={isOut ? "border-destructive/30" : "border-warning/30"}>
                      <CardContent className="flex items-center gap-4 p-4">
                        {isOut ? <PackageX className="w-5 h-5 text-destructive" /> : <AlertTriangle className="w-5 h-5 text-warning" />}
                        <div className="flex-1">
                          <div className="font-medium">{p.name}</div>
                          <div className="text-sm text-muted-foreground">{p.unit}</div>
                        </div>
                        <div className="text-right">
                          <div className={`font-semibold ${isOut ? "text-destructive" : "text-warning"}`}>{p.stock_current}</div>
                          <div className="text-xs text-muted-foreground">Mín: {p.min_stock ?? "—"}</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleReplenish(p as any)}>
                          <Plus className="w-3 h-3 mr-1" /> Repor
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="movements" className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar produto ou descrição..." className="pl-10" value={movSearch} onChange={(e) => setMovSearch(e.target.value)} />
              </div>
              <Select value={movFilterType} onValueChange={setMovFilterType}>
                <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="sale">Venda</SelectItem>
                  <SelectItem value="purchase">Compra</SelectItem>
                  <SelectItem value="adjustment_plus">Ajuste +</SelectItem>
                  <SelectItem value="adjustment_minus">Ajuste -</SelectItem>
                </SelectContent>
              </Select>
              <Select value={movFilterPeriod} onValueChange={(v: any) => setMovFilterPeriod(v)}>
                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground">{filteredMovements.length} movimentação(ões)</div>
            <div className="grid gap-3">
              {movementsLoading ? (
                <>{[1,2,3,4,5].map((i) => (<EntryItemSkeleton key={i} />))}</>
              ) : filteredMovements.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma movimentação encontrada</CardContent></Card>
              ) : (
                filteredMovements.slice(0, 100).map((m) => (
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
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Buscar por produto ou número do lote..."
                  className="flex-1"
                  value={lotSearch}
                  onChange={(e) => setLotSearch(e.target.value)}
                />
                <Select value={lotFilter} onValueChange={(v: any) => setLotFilter(v)}>
                  <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os lotes</SelectItem>
                    <SelectItem value="expiring">Vencendo em 30 dias</SelectItem>
                    <SelectItem value="expired">Vencidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {Object.keys(lotsByProduct).length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum lote encontrado</CardContent></Card>
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
                          {lots.map((lot) => {
                            const days = lot.expiry_date ? Math.floor((new Date(lot.expiry_date).getTime() - Date.now()) / 86400000) : null;
                            const dayClass = days == null ? "text-muted-foreground"
                              : days < 0 ? "text-destructive font-semibold"
                              : days <= 30 ? "text-yellow-500 font-semibold"
                              : "text-green-600";
                            return (
                              <div key={lot.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                <div>
                                  <span className="font-medium">{lot.lot_number}</span>
                                  <span className="text-muted-foreground text-sm ml-2">Qtd: {lot.quantity}</span>
                                </div>
                                {lot.expiry_date && (
                                  <span className={`text-sm ${dayClass}`}>
                                    Val: {new Date(lot.expiry_date).toLocaleDateString("pt-BR")}
                                    {days != null && (days < 0 ? ` (vencido há ${Math.abs(days)}d)` : ` (${days}d)`)}
                                  </span>
                                )}
                              </div>
                            );
                          })}
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
