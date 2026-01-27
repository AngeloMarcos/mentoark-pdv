import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { PaymentMethodReport } from "@/hooks/useReports";
import { formatCurrency, formatPercent } from "@/lib/export-utils";

interface PaymentMethodChartProps {
  data: PaymentMethodReport[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function PaymentMethodChart({ data }: PaymentMethodChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vendas por Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64 text-muted-foreground">
          Sem dados para exibir
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((item, index) => ({
    name: item.payment_label,
    value: item.total_amount,
    count: item.sale_count,
    percentage: item.percentage,
    color: COLORS[index % COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(data.value)}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.count} vendas ({formatPercent(data.percentage)})
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Vendas por Forma de Pagamento</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis
                type="number"
                tickFormatter={(value) =>
                  new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    notation: "compact",
                  }).format(value)
                }
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Summary below chart */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          {data.slice(0, 3).map((item, index) => (
            <div key={item.payment_method} className="text-center p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">{item.payment_label}</p>
              <p className="text-lg font-bold">{formatCurrency(item.total_amount)}</p>
              <p className="text-xs text-muted-foreground">
                {item.sale_count} vendas
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
