import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  useRecentSalesForReturn,
  useSaleForReturn,
  useProcessReturn,
  type RefundMethod,
  type ReturnReasonType,
} from "@/hooks/useReturns";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function NewReturnDialog({ open, onOpenChange }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [search, setSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reasonType, setReasonType] = useState<ReturnReasonType>("defect");
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("cash");
  const [notes, setNotes] = useState("");

  const { data: sales = [] } = useRecentSalesForReturn(search);
  const { data: sale } = useSaleForReturn(selectedSaleId);
  const processReturn = useProcessReturn();

  const totalRefund = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((sum, item) => {
      const qty = quantities[item.id] || 0;
      return sum + qty * item.unit_price;
    }, 0);
  }, [sale, quantities]);

  const reset = () => {
    setStep(1);
    setSearch("");
    setSelectedSaleId(null);
    setQuantities({});
    setReason("");
    setReasonType("defect");
    setRefundMethod("cash");
    setNotes("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleSelectSale = (id: string) => {
    setSelectedSaleId(id);
    setQuantities({});
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!sale) return;
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([sale_item_id, quantity]) => ({ sale_item_id, quantity }));

    if (items.length === 0) {
      toast.error("Selecione ao menos um item para devolver");
      return;
    }
    if (!reason.trim()) {
      toast.error("Informe o motivo da devolução");
      return;
    }
    if (refundMethod === "store_credit" && !sale.customer_id) {
      toast.error("Esta venda não tem cliente — não é possível dar crédito em loja");
      return;
    }

    await processReturn.mutateAsync({
      sale_id: sale.id,
      reason: reason.trim(),
      reason_type: reasonType,
      refund_method: refundMethod,
      notes: notes.trim() || undefined,
      items,
    });

    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? "Selecionar venda" : "Nova devolução"}
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <Input
              placeholder="Buscar por ID da venda (cole o ID completo ou início)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                        Nenhuma venda encontrada
                      </TableCell>
                    </TableRow>
                  )}
                  {sales.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">
                        {format(new Date(s.datetime), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">{s.customers?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs uppercase">{s.payment_method}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {Number(s.net_total).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleSelectSale(s.id)}>
                          Selecionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        )}

        {step === 2 && sale && (
          <div className="space-y-4">
            <Card className="p-3 bg-muted/40">
              <div className="flex justify-between text-sm">
                <span>Cliente: <strong>{sale.customer_name ?? "Sem cliente"}</strong></span>
                <span>Venda: R$ {sale.net_total.toFixed(2)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(sale.datetime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
            </Card>

            <div>
              <Label className="text-sm mb-2 block">Itens a devolver</Label>
              <Card className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead className="text-right">Vendido</TableHead>
                      <TableHead className="text-right">Já devolvido</TableHead>
                      <TableHead className="text-right">Devolver agora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium text-sm">{item.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            R$ {item.unit_price.toFixed(2)} cada
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {item.already_returned > 0 ? (
                            <Badge variant="secondary">{item.already_returned}</Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min={0}
                            max={item.returnable}
                            step="0.001"
                            disabled={item.returnable === 0}
                            value={quantities[item.id] ?? ""}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              setQuantities((q) => ({
                                ...q,
                                [item.id]: isNaN(v) ? 0 : Math.min(v, item.returnable),
                              }));
                            }}
                            className="w-24 text-right ml-auto"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={reasonType} onValueChange={(v) => setReasonType(v as ReturnReasonType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="defect">Produto com defeito</SelectItem>
                    <SelectItem value="regret">Desistência</SelectItem>
                    <SelectItem value="exchange">Troca</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reembolso</Label>
                <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as RefundMethod)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro (caixa)</SelectItem>
                    <SelectItem value="pix">PIX (caixa)</SelectItem>
                    <SelectItem value="store_credit" disabled={!sale.customer_id}>
                      Crédito em loja {!sale.customer_id && "(requer cliente)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Motivo</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex: Produto chegou danificado" />
            </div>

            <div>
              <Label>Observações (opcional)</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>

            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/20">
              <span className="font-medium">Total a reembolsar</span>
              <span className="text-xl font-bold text-primary">R$ {totalRefund.toFixed(2)}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              Voltar
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          {step === 2 && (
            <Button
              onClick={handleSubmit}
              disabled={processReturn.isPending || totalRefund <= 0}
            >
              {processReturn.isPending ? "Processando..." : "Confirmar devolução"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
