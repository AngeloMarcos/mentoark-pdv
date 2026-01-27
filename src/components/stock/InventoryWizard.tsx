import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Play, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useInventoryCount,
  useInventoryCountItems,
  useCreateInventoryCount,
  useStartInventoryCount,
  useUpdateCountItem,
  useCompleteInventoryCount,
  useCancelInventoryCount,
  getInventoryStatusLabel,
  getInventoryStatusColor,
} from "@/hooks/useInventory";
import { InventoryCountItem } from "./InventoryCountItem";

interface InventoryWizardProps {
  inventoryId?: string;
  onClose: () => void;
}

export function InventoryWizard({ inventoryId, onClose }: InventoryWizardProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<"create" | "count" | "review" | "confirm">(
    inventoryId ? "count" : "create"
  );
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirmComplete, setShowConfirmComplete] = useState(false);
  const [showConfirmCancel, setShowConfirmCancel] = useState(false);

  const { data: inventory } = useInventoryCount(inventoryId);
  const { data: items = [] } = useInventoryCountItems(inventoryId);
  const createInventory = useCreateInventoryCount();
  const startInventory = useStartInventoryCount();
  const updateItem = useUpdateCountItem();
  const completeInventory = useCompleteInventoryCount();
  const cancelInventory = useCancelInventoryCount();

  const filteredItems = items.filter((item) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      item.product?.name?.toLowerCase().includes(search) ||
      item.product?.internal_code?.toLowerCase().includes(search) ||
      item.product?.barcode?.toLowerCase().includes(search)
    );
  });

  const countedCount = items.filter((i) => i.counted_quantity !== null).length;
  const totalDifference = items.reduce(
    (sum, item) => sum + (item.difference_value || 0),
    0
  );
  const itemsWithDifference = items.filter(
    (i) => i.difference !== null && i.difference !== 0
  );
  const itemsMissingReason = itemsWithDifference.filter(
    (i) => !i.adjustment_reason
  );

  const handleCreate = async () => {
    const result = await createInventory.mutateAsync({ name, notes: notes || null });
    if (result) {
      await startInventory.mutateAsync(result.id);
      navigate(`/inventory?id=${result.id}`);
      setStep("count");
    }
  };

  const handleUpdateItem = (
    itemId: string,
    countedQuantity: number,
    adjustmentReason?: string
  ) => {
    updateItem.mutate({ itemId, countedQuantity, adjustmentReason });
  };

  const handleComplete = async () => {
    if (inventoryId) {
      await completeInventory.mutateAsync(inventoryId);
      onClose();
    }
  };

  const handleCancel = async () => {
    if (inventoryId) {
      await cancelInventory.mutateAsync(inventoryId);
      onClose();
    }
  };

  const canComplete =
    countedCount === items.length && itemsMissingReason.length === 0;

  if (step === "create") {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Inventário</DialogTitle>
            <DialogDescription>
              Crie um novo inventário para fazer a contagem de estoque.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Inventário *</Label>
              <Input
                id="name"
                placeholder="Ex: Inventário Mensal - Janeiro"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações opcionais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name || createInventory.isPending || startInventory.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {createInventory.isPending || startInventory.isPending
                ? "Criando..."
                : "Criar e Iniciar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                {inventory?.name || "Inventário"}
              </CardTitle>
              <Badge variant={getInventoryStatusColor(inventory?.status || "draft")}>
                {getInventoryStatusLabel(inventory?.status || "draft")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Produtos:</span>{" "}
                <strong>{items.length}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Contados:</span>{" "}
                <strong>
                  {countedCount}/{items.length}
                </strong>
              </div>
              <div>
                <span className="text-muted-foreground">Com diferença:</span>{" "}
                <strong>{itemsWithDifference.length}</strong>
              </div>
              <div>
                <span className="text-muted-foreground">Valor diferença:</span>{" "}
                <strong
                  className={totalDifference < 0 ? "text-destructive" : "text-green-500"}
                >
                  {totalDifference.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código ou EAN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Items */}
        <ScrollArea className="h-[400px]">
          <div className="space-y-2 pr-4">
            {filteredItems.map((item) => (
              <InventoryCountItem
                key={item.id}
                item={item}
                onUpdate={handleUpdateItem}
                disabled={inventory?.status === "completed"}
              />
            ))}
          </div>
        </ScrollArea>

        {/* Actions */}
        {inventory?.status === "in_progress" && (
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowConfirmCancel(true)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar Inventário
            </Button>
            <Button
              onClick={() => setShowConfirmComplete(true)}
              disabled={!canComplete}
            >
              <Check className="h-4 w-4 mr-2" />
              Finalizar e Aplicar Ajustes
            </Button>
          </div>
        )}

        {!canComplete && inventory?.status === "in_progress" && (
          <p className="text-sm text-muted-foreground text-center">
            {countedCount < items.length
              ? `Faltam ${items.length - countedCount} produto(s) para contar.`
              : `${itemsMissingReason.length} item(ns) com diferença precisam de motivo.`}
          </p>
        )}
      </div>

      {/* Confirm Complete Dialog */}
      <AlertDialog open={showConfirmComplete} onOpenChange={setShowConfirmComplete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar Inventário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá aplicar os ajustes de estoque automaticamente.
              <br />
              <br />
              <strong>Resumo:</strong>
              <br />- {itemsWithDifference.length} produto(s) serão ajustados
              <br />- Valor total da diferença:{" "}
              {totalDifference.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete}>
              Confirmar e Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Cancel Dialog */}
      <AlertDialog open={showConfirmCancel} onOpenChange={setShowConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Inventário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Nenhum ajuste será aplicado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar Inventário
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
