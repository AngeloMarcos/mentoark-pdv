import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useProducts } from "@/hooks/useProducts";
import { useCreatePurchaseOrder, type PurchaseOrderStatus } from "@/hooks/usePurchaseOrders";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface DraftItem {
  product_id: string;
  product_name: string;
  unit_cost: number;
  quantity_ordered: number;
}

export function NewPurchaseOrderDialog({ open, onOpenChange }: Props) {
  const { data: suppliers = [] } = useSuppliers();
  const { data: products = [] } = useProducts();
  const create = useCreatePurchaseOrder();

  const [supplierId, setSupplierId] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [freight, setFreight] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<PurchaseOrderStatus>("draft");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productPick, setProductPick] = useState("");

  const total = useMemo(
    () => items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0) + freight - discount,
    [items, freight, discount]
  );

  const reset = () => {
    setSupplierId(""); setOrderNumber(""); setExpectedDate("");
    setFreight(0); setDiscount(0); setNotes("");
    setStatus("draft"); setItems([]); setProductPick("");
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleAddProduct = () => {
    if (!productPick) return;
    if (items.find((i) => i.product_id === productPick)) {
      toast.error("Produto já adicionado");
      return;
    }
    const p = products.find((x: any) => x.id === productPick);
    if (!p) return;
    setItems((prev) => [...prev, {
      product_id: p.id,
      product_name: p.name,
      unit_cost: Number(p.cost_price ?? p.weighted_avg_cost ?? 0),
      quantity_ordered: 1,
    }]);
    setProductPick("");
  };

  const handleSubmit = async () => {
    if (!supplierId) { toast.error("Selecione o fornecedor"); return; }
    if (items.length === 0) { toast.error("Adicione ao menos um produto"); return; }
    if (items.some((i) => i.quantity_ordered <= 0 || i.unit_cost < 0)) {
      toast.error("Confira quantidades e custos");
      return;
    }
    await create.mutateAsync({
      supplier_id: supplierId,
      order_number: orderNumber || undefined,
      expected_date: expectedDate || undefined,
      freight,
      discount,
      notes: notes || undefined,
      status,
      items: items.map((i) => ({
        product_id: i.product_id,
        quantity_ordered: i.quantity_ordered,
        unit_cost: i.unit_cost,
      })),
    });
    handleClose(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo pedido de compra</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Fornecedor *</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status inicial</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PurchaseOrderStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="sent">Enviado (pronto p/ receber)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Número do pedido</Label>
            <Input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Opcional" />
          </div>
          <div>
            <Label>Previsão de entrega</Label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 mt-3">
          <Label>Produtos</Label>
          <div className="flex gap-2">
            <Select value={productPick} onValueChange={setProductPick}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar produto" /></SelectTrigger>
              <SelectContent>
                {products.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={handleAddProduct}><Plus className="w-4 h-4" /></Button>
          </div>

          {items.length > 0 && (
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead className="w-24">Qtd</TableHead>
                    <TableHead className="w-32">Custo unit.</TableHead>
                    <TableHead className="w-28 text-right">Total</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={it.product_id}>
                      <TableCell className="text-sm">{it.product_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} step="0.001"
                          value={it.quantity_ordered}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setItems((arr) => arr.map((x, i) => i === idx ? { ...x, quantity_ordered: v } : x));
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} step="0.01"
                          value={it.unit_cost}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value) || 0;
                            setItems((arr) => arr.map((x, i) => i === idx ? { ...x, unit_cost: v } : x));
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        R$ {(it.quantity_ordered * it.unit_cost).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost"
                          onClick={() => setItems((arr) => arr.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <Label>Frete</Label>
            <Input type="number" min={0} step="0.01" value={freight}
              onChange={(e) => setFreight(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Desconto</Label>
            <Input type="number" min={0} step="0.01" value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Total</Label>
            <div className="h-10 flex items-center px-3 rounded-md bg-primary/10 border border-primary/20 font-bold">
              R$ {total.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Label>Observações</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Criar pedido"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
