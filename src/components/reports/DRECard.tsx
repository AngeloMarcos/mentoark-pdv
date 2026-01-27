import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatPercent } from "@/lib/export-utils";
import { cn } from "@/lib/utils";
import { DREReport } from "@/hooks/useReports";

interface DRECardProps {
  data: DREReport;
}

export function DRECard({ data }: DRECardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Demonstrativo de Resultado (Simplificado)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Gross Revenue */}
        <div className="flex justify-between items-center">
          <span className="text-sm">(+) Receita Bruta de Vendas</span>
          <span className="font-medium">{formatCurrency(data.grossRevenue)}</span>
        </div>

        {/* Discounts */}
        <div className="flex justify-between items-center text-red-500">
          <span className="text-sm">(-) Descontos Concedidos</span>
          <span className="font-medium">- {formatCurrency(data.discounts)}</span>
        </div>

        <Separator />

        {/* Net Revenue */}
        <div className="flex justify-between items-center font-medium">
          <span className="text-sm">(=) Receita Líquida</span>
          <span>{formatCurrency(data.netRevenue)}</span>
        </div>

        {/* COGS */}
        <div className="flex justify-between items-center text-red-500">
          <span className="text-sm">(-) Custo dos Produtos Vendidos (CMV)</span>
          <span className="font-medium">- {formatCurrency(data.costOfGoodsSold)}</span>
        </div>

        <Separator />

        {/* Gross Profit */}
        <div
          className={cn(
            "flex justify-between items-center font-bold text-lg",
            data.grossProfit >= 0 ? "text-green-500" : "text-red-500"
          )}
        >
          <span>(=) Lucro Bruto</span>
          <span>{formatCurrency(data.grossProfit)}</span>
        </div>

        {/* Gross Margin */}
        <div className="flex justify-between items-center pt-2 border-t">
          <span className="text-sm text-muted-foreground">Margem Bruta</span>
          <span
            className={cn(
              "font-medium",
              data.grossMargin >= 30
                ? "text-green-500"
                : data.grossMargin >= 15
                ? "text-yellow-500"
                : "text-red-500"
            )}
          >
            {formatPercent(data.grossMargin)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
