import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, Percent, ShoppingCart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

interface SummaryCardsProps {
  totalRevenue: number;
  totalProfit: number;
  profitMargin: number;
  averageTicket: number;
  saleCount?: number;
  previousPeriod?: {
    revenue: number;
    profit: number;
  };
}

export function SummaryCards({
  totalRevenue,
  totalProfit,
  profitMargin,
  averageTicket,
  saleCount,
  previousPeriod,
}: SummaryCardsProps) {
  const revenueChange = previousPeriod
    ? ((totalRevenue - previousPeriod.revenue) / previousPeriod.revenue) * 100
    : null;
  const profitChange = previousPeriod
    ? ((totalProfit - previousPeriod.profit) / previousPeriod.profit) * 100
    : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Revenue */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Faturamento
          </CardTitle>
          <DollarSign className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
          {revenueChange !== null && (
            <div
              className={cn(
                "flex items-center text-xs mt-1",
                revenueChange >= 0 ? "text-green-500" : "text-red-500"
              )}
            >
              {revenueChange >= 0 ? (
                <ArrowUpRight className="w-3 h-3 mr-1" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-1" />
              )}
              {formatPercent(Math.abs(revenueChange))} vs período anterior
            </div>
          )}
          {saleCount !== undefined && (
            <p className="text-xs text-muted-foreground mt-1">
              {saleCount} vendas
            </p>
          )}
        </CardContent>
      </Card>

      {/* Gross Profit */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Lucro Bruto
          </CardTitle>
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-2xl font-bold",
              totalProfit >= 0 ? "text-green-500" : "text-red-500"
            )}
          >
            {formatCurrency(totalProfit)}
          </div>
          {profitChange !== null && (
            <div
              className={cn(
                "flex items-center text-xs mt-1",
                profitChange >= 0 ? "text-green-500" : "text-red-500"
              )}
            >
              {profitChange >= 0 ? (
                <ArrowUpRight className="w-3 h-3 mr-1" />
              ) : (
                <ArrowDownRight className="w-3 h-3 mr-1" />
              )}
              {formatPercent(Math.abs(profitChange))} vs período anterior
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profit Margin */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Margem de Lucro
          </CardTitle>
          <Percent className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-2xl font-bold",
              profitMargin >= 30
                ? "text-green-500"
                : profitMargin >= 15
                ? "text-yellow-500"
                : "text-red-500"
            )}
          >
            {formatPercent(profitMargin)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {profitMargin >= 30
              ? "Margem saudável"
              : profitMargin >= 15
              ? "Margem moderada"
              : "Margem baixa"}
          </p>
        </CardContent>
      </Card>

      {/* Average Ticket */}
      <Card className="stat-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Ticket Médio
          </CardTitle>
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(averageTicket)}</div>
          <p className="text-xs text-muted-foreground mt-1">Por venda</p>
        </CardContent>
      </Card>
    </div>
  );
}
