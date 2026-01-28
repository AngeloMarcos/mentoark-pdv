import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePointsHistory, CustomerPointsMovement } from "@/hooks/useLoyalty";
import { Gift, TrendingUp, TrendingDown, Clock, Wrench } from "lucide-react";

interface PointsHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  customerName?: string;
}

const MOVEMENT_CONFIG: Record<
  CustomerPointsMovement["movement_type"],
  { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  earn: { label: "Ganhou", icon: TrendingUp, variant: "default" },
  redeem: { label: "Resgatou", icon: TrendingDown, variant: "secondary" },
  expire: { label: "Expirado", icon: Clock, variant: "destructive" },
  manual: { label: "Ajuste", icon: Wrench, variant: "outline" },
};

export function PointsHistoryDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
}: PointsHistoryDialogProps) {
  const { data: history = [], isLoading } = usePointsHistory(customerId);

  const totalEarned = history
    .filter((m) => m.movement_type === "earn" || (m.movement_type === "manual" && m.points > 0))
    .reduce((sum, m) => sum + m.points, 0);

  const totalRedeemed = history
    .filter((m) => m.movement_type === "redeem")
    .reduce((sum, m) => sum + m.points, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-primary" />
            Histórico de Pontos
            {customerName && (
              <span className="text-muted-foreground font-normal">
                — {customerName}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-green-500/10 text-center">
            <p className="text-xs text-muted-foreground">Total Ganho</p>
            <p className="text-lg font-bold text-green-600">
              +{totalEarned.toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-orange-500/10 text-center">
            <p className="text-xs text-muted-foreground">Total Resgatado</p>
            <p className="text-lg font-bold text-orange-600">
              -{totalRedeemed.toLocaleString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Lista */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma movimentação de pontos</p>
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((movement) => {
                const config = MOVEMENT_CONFIG[movement.movement_type];
                const Icon = config.icon;
                const isPositive =
                  movement.movement_type === "earn" ||
                  (movement.movement_type === "manual" && movement.points > 0);

                return (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-full ${
                          isPositive ? "bg-green-500/10" : "bg-orange-500/10"
                        }`}
                      >
                        <Icon
                          className={`w-4 h-4 ${
                            isPositive ? "text-green-600" : "text-orange-600"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={config.variant} className="text-xs">
                            {config.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        </div>
                        {movement.description && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {movement.description}
                          </p>
                        )}
                        {movement.expires_at && (
                          <p className="text-xs text-muted-foreground">
                            Expira em{" "}
                            {format(new Date(movement.expires_at), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`font-bold ${
                        isPositive ? "text-green-600" : "text-orange-600"
                      }`}
                    >
                      {isPositive ? "+" : "-"}
                      {movement.points.toLocaleString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
