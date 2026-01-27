import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent } from "@/lib/export-utils";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ProfitMarginCardProps {
  rank: number;
  productName: string;
  category?: string | null;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  quantity: number;
}

export function ProfitMarginCard({
  rank,
  productName,
  category,
  revenue,
  cost,
  profit,
  margin,
  quantity,
}: ProfitMarginCardProps) {
  const getMarginColor = (m: number) => {
    if (m >= 30) return "text-green-500";
    if (m >= 15) return "text-yellow-500";
    return "text-red-500";
  };

  const getProgressColor = (m: number) => {
    if (m >= 30) return "bg-green-500";
    if (m >= 15) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getIcon = (m: number) => {
    if (m >= 30) return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (m >= 15) return <Minus className="w-4 h-4 text-yellow-500" />;
    return <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  // Normalize margin for progress bar (cap at 100%)
  const progressValue = Math.min(Math.max(margin, 0), 100);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Rank badge */}
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0",
              rank <= 3
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {rank}
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium truncate">{productName}</h4>
              {getIcon(margin)}
            </div>
            
            {category && (
              <p className="text-xs text-muted-foreground mb-2">{category}</p>
            )}

            {/* Margin progress bar */}
            <div className="mb-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Margem</span>
                <span className={cn("font-medium", getMarginColor(margin))}>
                  {formatPercent(margin)}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn("h-full transition-all", getProgressColor(margin))}
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            </div>

            {/* Financial details */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Receita</p>
                <p className="font-medium">{formatCurrency(revenue)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Custo</p>
                <p className="font-medium">{formatCurrency(cost)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Lucro</p>
                <p
                  className={cn(
                    "font-medium",
                    profit >= 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  {formatCurrency(profit)}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-2">
              {quantity} unidades vendidas
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
