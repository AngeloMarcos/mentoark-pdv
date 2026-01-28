import { useState, useEffect } from "react";
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
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useCustomerPoints,
  useLoyaltySettings,
  useRedeemPoints,
  calculatePointsValue,
} from "@/hooks/useLoyalty";
import { Gift, AlertCircle, Loader2, Check } from "lucide-react";

interface RedeemPointsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  customerName?: string;
  maxDiscount?: number; // Limite máximo de desconto (ex: valor total da venda)
  onRedeem?: (discountValue: number, pointsUsed: number) => void;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function RedeemPointsDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  maxDiscount,
  onRedeem,
}: RedeemPointsDialogProps) {
  const { data: availablePoints = 0 } = useCustomerPoints(customerId);
  const { data: settings } = useLoyaltySettings();
  const redeemMutation = useRedeemPoints();

  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const minPoints = settings?.loyalty_min_redeem_points || 100;
  const currencyPerPoints = settings?.loyalty_currency_per_points || 100;

  // Calcular limites
  const maxPointsAvailable = availablePoints;
  const maxPointsByDiscount = maxDiscount
    ? Math.floor(maxDiscount * currencyPerPoints)
    : Infinity;
  const maxPointsToRedeem = Math.min(maxPointsAvailable, maxPointsByDiscount);

  const discountValue = calculatePointsValue(pointsToRedeem, currencyPerPoints);
  const canRedeem = pointsToRedeem >= minPoints && pointsToRedeem <= maxPointsToRedeem;

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setPointsToRedeem(Math.min(minPoints, maxPointsToRedeem));
    }
  }, [open, minPoints, maxPointsToRedeem]);

  const handleRedeem = async () => {
    if (!customerId || !canRedeem) return;

    try {
      const result = await redeemMutation.mutateAsync({
        customerId,
        points: pointsToRedeem,
        description: "Resgate no PDV",
      });

      onRedeem?.(result, pointsToRedeem);
      onOpenChange(false);
    } catch (error) {
      // Erro já tratado pelo hook
    }
  };

  const handleSliderChange = (values: number[]) => {
    // Arredondar para múltiplos de 10
    const rounded = Math.round(values[0] / 10) * 10;
    setPointsToRedeem(Math.max(minPoints, Math.min(maxPointsToRedeem, rounded)));
  };

  if (!settings?.loyalty_enabled) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Resgatar Pontos
            {customerName && (
              <span className="text-muted-foreground font-normal">
                — {customerName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Saldo disponível */}
          <div className="p-4 rounded-lg bg-muted text-center">
            <p className="text-sm text-muted-foreground">Saldo Disponível</p>
            <p className="text-3xl font-bold text-primary">
              {availablePoints.toLocaleString("pt-BR")}
            </p>
            <p className="text-sm text-muted-foreground">
              = {formatCurrency(calculatePointsValue(availablePoints, currencyPerPoints))}
            </p>
          </div>

          {/* Slider de pontos */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Label>Pontos a Resgatar</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={pointsToRedeem}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setPointsToRedeem(Math.max(0, Math.min(maxPointsToRedeem, value)));
                  }}
                  className="w-24 text-right"
                  min={minPoints}
                  max={maxPointsToRedeem}
                />
                <span className="text-sm text-muted-foreground">pts</span>
              </div>
            </div>

            <Slider
              value={[pointsToRedeem]}
              onValueChange={handleSliderChange}
              min={0}
              max={maxPointsToRedeem}
              step={10}
              className="py-2"
            />

            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Mín: {minPoints.toLocaleString("pt-BR")} pts</span>
              <span>Máx: {maxPointsToRedeem.toLocaleString("pt-BR")} pts</span>
            </div>
          </div>

          {/* Valor do desconto */}
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
            <p className="text-sm text-green-700">Desconto a Aplicar</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(discountValue)}
            </p>
          </div>

          {/* Alertas */}
          {pointsToRedeem < minPoints && pointsToRedeem > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Mínimo para resgate: {minPoints.toLocaleString("pt-BR")} pontos
              </AlertDescription>
            </Alert>
          )}

          {maxDiscount && discountValue > maxDiscount && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Desconto limitado ao valor da compra: {formatCurrency(maxDiscount)}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleRedeem}
            disabled={!canRedeem || redeemMutation.isPending}
          >
            {redeemMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resgatando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirmar Resgate
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
