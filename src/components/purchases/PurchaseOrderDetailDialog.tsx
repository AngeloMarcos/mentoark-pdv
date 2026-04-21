import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePurchaseOrderDetail, useReceivePurchaseOrder, useUpdatePurchaseOrderStatus } from "@/hooks/usePurchaseOrders";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  orderId: string | null;
  onClose: () => void;
}

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

export function PurchaseOrderDetailDialog({ orderId, onClose }: Props) {
  const { data: order, isLoading } = usePurchaseOrderDetail(orderId);
  const receive = useReceivePurchaseOrder();
  const updateStatus = useUpdatePurchaseOrderStatus();
  const [receiveQty, setReceiveQty] = useState<Record<string, number>>({});

  const canReceive = order && (order.status === "sent" || order.status === "partially_received");

  const totalToReceive = useMemo(() => {
    if (!order) return 0;
    return (order.purchase_order_items || []).reduce((s: number, it: any) => {
      const q = receiveQty[it.id] || 0;
      return s + q * Number(it.unit_cost);
    }, 0);
  }, [order, receiveQty]);

  const handleReceive = async () => {
    if (!order) return;
    const items = Object.entries(receiveQty)
      .filter(([, q]) => q > 0)
      .map(([item_id, quantity_received]) => ({ item_id, quantity_received }));
    if (items.length === 0) { toast.error("Informe quantidades a receber"); return; }
    await receive.mutateAsync({ orderId: order.id, items });
    setReceiveQty({});
  };

  const handleSend = async () => {
    if (!order) return;
    await updateStatus.mutateAsync({ id: order.id, status: "sent" });
  };

  const handleCancel = async () => {
    if (!order) return;
    await updateStatus.mutateAsync({ id: order.id, status: "cancelled" });
  };

  return (
    <Dialog open={!!orderId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            Pedido de compra
            {order && (
              <Badge variant={STATUS_VARIANT[order.status]}>{STATUS_LABEL[order.status]}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && <div className="p-6 text-center text-muted-foreground">Carregando...</div>}

        {order && (
          <div className="space-y-4">
            <Card className="p-3 bg-muted/40 grid grid-cols-2 gap-2 text-sm">
              <div><strong>Fornecedor:</strong> {order.suppliers?.name}</div>
              <div><strong>Nº pedido:</strong> {order.order_number ?? "—"}</div>
              <div>
                <strong>Criado em:</strong>{" "}
                {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
              <div>
                <strong>Previsão:</strong>{" "}
                {order.expected_date ? format(new Date(order.expected_date), "dd/MM/yyyy") : "—"}
              </div>
              {order.received_date && (
                <div className="col-span-2">
                  <strong>Recebido em:</strong> {format(new Date(order.received_date), "dd/MM/yyyy")}
                </div>
              )}
              {order.notes && <div className="col-span-2"><strong>Obs:</strong> {order.notes}</div>}
            </Card>

            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Pedido</TableHead>
                    <TableHead className="text-right">Recebido</TableHead>
                    <TableHead className="text-right">Custo unit.</TableHead>
                    {canReceive && <TableHead className="w-32 text-right">Receber agora</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.purchase_order_items?.map((it: any) => {
                    const remaining = Number(it.quantity_ordered) - Number(it.quantity_received);
                    return (
                      <TableRow key={it.id}>
                        <TableCell className="text-sm font-medium">{it.products?.name}</TableCell>
                        <TableCell className="text-right">{Number(it.quantity_ordered)}</TableCell>
                        <TableCell className="text-right">
                          {Number(it.quantity_received)}
                          {remaining > 0 && <span className="text-xs text-muted-foreground ml-1">({remaining} pend.)</span>}
                        </TableCell>
                        <TableCell className="text-right">R$ {Number(it.unit_cost).toFixed(2)}</TableCell>
                        {canReceive && (
                          <TableCell>
                            <Input
                              type="number" min={0} max={remaining} step="0.001"
                              disabled={remaining === 0}
                              value={receiveQty[it.id] ?? ""}
                              onChange={(e) => {
                                const v = parseFloat(e.target.value);
                                setReceiveQty((q) => ({
                                  ...q,
                                  [it.id]: isNaN(v) ? 0 : Math.min(v, remaining),
                                }));
                              }}
                              className="text-right"
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>

            <div className="flex justify-between items-center text-sm">
              <div className="text-muted-foreground">
                Frete: R$ {Number(order.freight).toFixed(2)} · Desconto: R$ {Number(order.discount).toFixed(2)}
              </div>
              <div className="text-lg font-bold">
                Total: R$ {Number(order.total_cost).toFixed(2)}
              </div>
            </div>

            {canReceive && totalToReceive > 0 && (
              <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/20">
                <span className="font-medium">Valor desta entrada</span>
                <span className="text-lg font-bold text-primary">R$ {totalToReceive.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {order?.status === "draft" && (
            <Button variant="default" onClick={handleSend} disabled={updateStatus.isPending}>
              Marcar como enviado
            </Button>
          )}
          {order && ["draft", "sent", "partially_received"].includes(order.status) && (
            <Button variant="outline" onClick={handleCancel} disabled={updateStatus.isPending}>
              Cancelar pedido
            </Button>
          )}
          {canReceive && (
            <Button onClick={handleReceive} disabled={receive.isPending || totalToReceive <= 0}>
              {receive.isPending ? "Recebendo..." : "Confirmar recebimento"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
