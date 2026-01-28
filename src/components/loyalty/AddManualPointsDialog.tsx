import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAddManualPoints } from "@/hooks/useLoyalty";
import { Gift, Plus, Minus, Loader2 } from "lucide-react";

interface AddManualPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  customerName?: string;
}

export function AddManualPointsDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: AddManualPointsDialogProps) {
  const addPointsMutation = useAddManualPoints();

  const [type, setType] = useState<"add" | "remove">("add");
  const [points, setPoints] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async () => {
    if (!customerId || !points || !description) return;

    const pointsValue = parseInt(points);
    if (isNaN(pointsValue) || pointsValue <= 0) return;

    await addPointsMutation.mutateAsync({
      customerId,
      points: type === "add" ? pointsValue : -pointsValue,
      description,
    });

    setPoints("");
    setDescription("");
    onOpenChange(false);
  };

  const isValid = points && parseInt(points) > 0 && description.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Ajustar Pontos
            {customerName && (
              <span className="text-muted-foreground font-normal">
                — {customerName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tipo de ajuste */}
          <RadioGroup
            value={type}
            onValueChange={(v) => setType(v as "add" | "remove")}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem value="add" id="add" className="peer sr-only" />
              <Label
                htmlFor="add"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-green-500 [&:has([data-state=checked])]:border-green-500 cursor-pointer"
              >
                <Plus className="mb-3 h-6 w-6 text-green-500" />
                Adicionar
              </Label>
            </div>
            <div>
              <RadioGroupItem value="remove" id="remove" className="peer sr-only" />
              <Label
                htmlFor="remove"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-orange-500 [&:has([data-state=checked])]:border-orange-500 cursor-pointer"
              >
                <Minus className="mb-3 h-6 w-6 text-orange-500" />
                Remover
              </Label>
            </div>
          </RadioGroup>

          {/* Quantidade */}
          <div className="space-y-2">
            <Label htmlFor="points">Quantidade de Pontos</Label>
            <Input
              id="points"
              type="number"
              min={1}
              placeholder="Ex: 100"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="description">Motivo do Ajuste *</Label>
            <Textarea
              id="description"
              placeholder="Descreva o motivo do ajuste manual..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || addPointsMutation.isPending}
            variant={type === "add" ? "default" : "destructive"}
          >
            {addPointsMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                {type === "add" ? (
                  <Plus className="mr-2 h-4 w-4" />
                ) : (
                  <Minus className="mr-2 h-4 w-4" />
                )}
                {type === "add" ? "Adicionar" : "Remover"} Pontos
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
