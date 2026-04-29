import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useSuppliers } from "@/hooks/useSuppliers";
import { NewPurchaseOrderDialog } from "@/components/purchases/NewPurchaseOrderDialog";
import { PurchaseOrderDetailDialog } from "@/components/purchases/PurchaseOrderDetailDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  partially_received: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};

const STATUS_CLASS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  sent: "bg-info/15 text-info border-info/30",
  partially_received: "bg-warning/15 text-warning border-warning/30",
  received: "bg-success/15 text-success border-success/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

export function PurchaseOrdersTab() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: orders = [], isLoading } = usePurchaseOrders();
  const { data: suppliers = [] } = useSuppliers(true);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const filtered = useMemo(() => {
    return (orders as any[]).filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (supplierFilter !== "all" && o.supplier_id !== supplierFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${o.order_number ?? ""} ${o.suppliers?.name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, supplierFilter, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nº ou fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            maxLength={80}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviado</SelectItem>
            <SelectItem value="partially_received">Parcial</SelectItem>
            <SelectItem value="received">Recebido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={supplierFilter} onValueChange={setSupplierFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos fornecedores</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo pedido
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Nº</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead>Previsão</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pedido encontrado.</TableCell></TableRow>
            )}
            {filtered.map((o: any) => (
              <TableRow key={o.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(o.id)}>
                <TableCell className="text-sm">
                  {format(new Date(o.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </TableCell>
                <TableCell className="text-sm">{o.order_number ?? "—"}</TableCell>
                <TableCell className="font-medium">{o.suppliers?.name ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {o.expected_date ? format(new Date(o.expected_date + "T00:00:00"), "dd/MM/yy") : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn("border", STATUS_CLASS[o.status])}>
                    {STATUS_LABEL[o.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-semibold">{fmt(Number(o.total_cost))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <NewPurchaseOrderDialog open={open} onOpenChange={setOpen} />
      <PurchaseOrderDetailDialog orderId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
