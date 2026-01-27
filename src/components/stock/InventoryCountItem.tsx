import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { InventoryCountItem as InventoryCountItemType } from "@/hooks/useInventory";

interface InventoryCountItemProps {
  item: InventoryCountItemType;
  onUpdate: (itemId: string, countedQuantity: number, adjustmentReason?: string) => void;
  disabled?: boolean;
}

export function InventoryCountItem({
  item,
  onUpdate,
  disabled = false,
}: InventoryCountItemProps) {
  const [countedQty, setCountedQty] = useState<string>(
    item.counted_quantity?.toString() || ""
  );
  const [reason, setReason] = useState<string>(item.adjustment_reason || "");
  const [localDifference, setLocalDifference] = useState<number | null>(item.difference);

  useEffect(() => {
    const qty = parseFloat(countedQty);
    if (!isNaN(qty)) {
      setLocalDifference(qty - item.expected_quantity);
    } else {
      setLocalDifference(null);
    }
  }, [countedQty, item.expected_quantity]);

  const handleBlur = () => {
    const qty = parseFloat(countedQty);
    if (!isNaN(qty)) {
      onUpdate(item.id, qty, reason || undefined);
    }
  };

  const hasDifference = localDifference !== null && localDifference !== 0;
  const requiresReason = hasDifference && !reason;

  return (
    <Card className={hasDifference ? (localDifference! > 0 ? "border-green-500" : "border-destructive") : ""}>
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1">
            <div className="font-medium">{item.product?.name}</div>
            <div className="text-sm text-muted-foreground">
              {item.product?.internal_code && `Cód: ${item.product.internal_code}`}
              {item.product?.internal_code && item.product?.barcode && " | "}
              {item.product?.barcode && `EAN: ${item.product.barcode}`}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              Unidade: {item.product?.unit || "UN"}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="space-y-1">
              <Label className="text-xs">Esperado</Label>
              <div className="h-10 px-3 py-2 bg-muted rounded-md text-center font-medium">
                {item.expected_quantity}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Contado</Label>
              <Input
                type="number"
                step="0.001"
                className="w-24"
                value={countedQty}
                onChange={(e) => setCountedQty(e.target.value)}
                onBlur={handleBlur}
                disabled={disabled}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Diferença</Label>
              <div className="h-10 px-3 py-2 rounded-md text-center font-medium">
                {localDifference !== null ? (
                  <Badge
                    variant={
                      localDifference === 0
                        ? "outline"
                        : localDifference > 0
                        ? "secondary"
                        : "destructive"
                    }
                  >
                    {localDifference > 0 ? "+" : ""}
                    {localDifference}
                  </Badge>
                ) : (
                  "-"
                )}
              </div>
            </div>
          </div>
        </div>

        {hasDifference && (
          <div className="mt-4 space-y-2">
            <Label className={requiresReason ? "text-destructive" : ""}>
              Motivo do ajuste {requiresReason && "*"}
            </Label>
            <Textarea
              placeholder="Informe o motivo da diferença..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onBlur={handleBlur}
              disabled={disabled}
              className={requiresReason ? "border-destructive" : ""}
            />
            {requiresReason && (
              <p className="text-xs text-destructive">
                Motivo é obrigatório quando há diferença
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
