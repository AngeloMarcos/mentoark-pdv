import { useState } from "react";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Package, Plus, AlertTriangle, CheckCircle, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLots,
  useCreateLot,
  useUpdateLotStatus,
  getExpiryStatusColor,
  getExpiryBadgeVariant,
} from "@/hooks/useLots";

interface LotManagerProps {
  productId: string;
  productName: string;
}

export function LotManager({ productId, productName }: LotManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    lot_number: "",
    manufacture_date: "",
    expiry_date: "",
    quantity: "",
    cost_price: "",
    supplier_info: "",
    notes: "",
  });

  const { data: lots = [], isLoading } = useLots(productId);
  const createLot = useCreateLot();
  const updateStatus = useUpdateLotStatus();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createLot.mutateAsync({
      product_id: productId,
      lot_number: formData.lot_number,
      manufacture_date: formData.manufacture_date || null,
      expiry_date: formData.expiry_date || null,
      quantity: parseFloat(formData.quantity) || 0,
      cost_price: formData.cost_price ? parseFloat(formData.cost_price) : null,
      supplier_info: formData.supplier_info || null,
      notes: formData.notes || null,
    });
    setFormData({
      lot_number: "",
      manufacture_date: "",
      expiry_date: "",
      quantity: "",
      cost_price: "",
      supplier_info: "",
      notes: "",
    });
    setShowAddForm(false);
  };

  const getDaysUntilExpiry = (expiryDate: string | null): number | null => {
    if (!expiryDate) return null;
    return differenceInDays(parseISO(expiryDate), new Date());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "expired":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "blocked":
        return <Ban className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      active: "Ativo",
      expired: "Vencido",
      blocked: "Bloqueado",
    };
    return labels[status] || status;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="h-4 w-4 mr-2" />
          Lotes ({lots.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lotes - {productName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Lote
            </Button>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Número do Lote *</Label>
                  <Input
                    value={formData.lot_number}
                    onChange={(e) => setFormData({ ...formData, lot_number: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade *</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custo Unitário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Fabricação</Label>
                  <Input
                    type="date"
                    value={formData.manufacture_date}
                    onChange={(e) => setFormData({ ...formData, manufacture_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Data Validade</Label>
                  <Input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Input
                    value={formData.supplier_info}
                    onChange={(e) => setFormData({ ...formData, supplier_info: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createLot.isPending}>
                  {createLot.isPending ? "Salvando..." : "Salvar Lote"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          )}

          {isLoading ? (
            <p className="text-muted-foreground">Carregando lotes...</p>
          ) : lots.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum lote cadastrado para este produto.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lote</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Custo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lots.map((lot) => {
                  const daysUntilExpiry = getDaysUntilExpiry(lot.expiry_date);
                  return (
                    <TableRow key={lot.id}>
                      <TableCell className="font-medium">{lot.lot_number}</TableCell>
                      <TableCell>{lot.quantity}</TableCell>
                      <TableCell>
                        {lot.expiry_date ? (
                          <div className="flex flex-col">
                            <span>{format(parseISO(lot.expiry_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                            <Badge variant={getExpiryBadgeVariant(daysUntilExpiry)} className="w-fit mt-1">
                              <span className={getExpiryStatusColor(daysUntilExpiry)}>
                                {daysUntilExpiry !== null
                                  ? daysUntilExpiry < 0
                                    ? `Vencido há ${Math.abs(daysUntilExpiry)} dias`
                                    : daysUntilExpiry === 0
                                    ? "Vence hoje"
                                    : `${daysUntilExpiry} dias`
                                  : "-"}
                              </span>
                            </Badge>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {lot.cost_price
                          ? lot.cost_price.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(lot.status)}
                          <span>{getStatusLabel(lot.status)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lot.status === "active" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateStatus.mutate({ id: lot.id, status: "blocked" })
                            }
                          >
                            Bloquear
                          </Button>
                        )}
                        {lot.status === "blocked" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              updateStatus.mutate({ id: lot.id, status: "active" })
                            }
                          >
                            Desbloquear
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
