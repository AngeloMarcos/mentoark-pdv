import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Package } from "lucide-react";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { NewPurchaseOrderDialog } from "@/components/purchases/NewPurchaseOrderDialog";
import { PurchaseOrderDetailDialog } from "@/components/purchases/PurchaseOrderDetailDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviado",
  partially_received: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
};
const STATUS_VARIANT: Record<string, any> = {
  draft: "secondary",
  sent: "default",
  partially_received: "outline",
  received: "default",
  cancelled: "destructive",
};

export default function PurchaseOrders() {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: orders = [], isLoading } = usePurchaseOrders();

  return (
    <AppLayout title="Pedidos de Compra">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Package className="w-6 h-6" /> Pedidos de Compra
            </h1>
            <p className="text-sm text-muted-foreground">Gerencie pedidos a fornecedores e recebimentos</p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo pedido
          </Button>
        </div>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Nº</TableHead>
                <TableHead>Previsão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && orders.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum pedido cadastrado</TableCell></TableRow>
              )}
              {orders.map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelectedId(o.id)}>
                  <TableCell className="text-sm">
                    {format(new Date(o.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-medium">{o.suppliers?.name}</TableCell>
                  <TableCell className="text-sm">{o.order_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {o.expected_date ? format(new Date(o.expected_date), "dd/MM/yy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {Number(o.total_cost).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <NewPurchaseOrderDialog open={open} onOpenChange={setOpen} />
      <PurchaseOrderDetailDialog orderId={selectedId} onClose={() => setSelectedId(null)} />
    </AppLayout>
  );
}
