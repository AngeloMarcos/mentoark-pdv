import { Gift, TrendingUp, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerPoints, useLoyaltySettings, calculatePointsValue } from "@/hooks/useLoyalty";

interface PointsBalanceProps {
  customerId: string | null | undefined;
  onViewHistory?: () => void;
  onRedeem?: () => void;
  compact?: boolean;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function PointsBalance({ customerId, onViewHistory, onRedeem, compact = false }: PointsBalanceProps) {
  const { data: points = 0, isLoading: isLoadingPoints } = useCustomerPoints(customerId);
  const { data: settings, isLoading: isLoadingSettings } = useLoyaltySettings();

  const isLoading = isLoadingPoints || isLoadingSettings;

  if (!settings?.loyalty_enabled) {
    return null;
  }

  const pointsValue = calculatePointsValue(points, settings.loyalty_currency_per_points);
  const canRedeem = points >= settings.loyalty_min_redeem_points;

  if (compact) {
    return (
      <Badge variant="secondary" className="gap-1">
        <Gift className="w-3 h-3" />
        {isLoading ? "..." : `${points.toLocaleString("pt-BR")} pts`}
      </Badge>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Gift className="w-4 h-4 text-primary" />
                Pontos de Fidelidade
              </div>
              {onViewHistory && (
                <Button variant="ghost" size="sm" onClick={onViewHistory}>
                  <History className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-primary">
                {points.toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-muted-foreground">pontos</span>
            </div>

            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3" />
              Equivale a {formatCurrency(pointsValue)}
            </div>

            {onRedeem && (
              <Button
                variant="default"
                size="sm"
                className="w-full mt-3"
                disabled={!canRedeem}
                onClick={onRedeem}
              >
                <Gift className="w-4 h-4 mr-2" />
                {canRedeem
                  ? "Resgatar Pontos"
                  : `Mínimo: ${settings.loyalty_min_redeem_points} pts`}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
