import { Card } from "@/components/ui/card";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Users, Receipt, DollarSign } from "lucide-react";
import { KpiCard } from "../KpiCard";
import { TableExportActions } from "../TableExportActions";
import { useOperatorReport } from "@/hooks/useBIReports";
import { formatCurrency } from "@/lib/export-utils";
import { useMemo } from "react";

interface Props { start: Date; end: Date; }

export function OperatorsTab({ start, end }: Props) {
  const { data: ops = [], isLoading } = useOperatorReport(start, end);

  const totals = useMemo(() => {
    const total = ops.reduce((s, o) => s + o.total_sold, 0);
    const sales = ops.reduce((s, o) => s + o.sale_count, 0);
    const avg = sales > 0 ? total / sales : 0;
    return { total, sales, avg };
  }, [ops]);

  const chartData = ops.slice(0, 10).map((o) => ({
    name: o.name.length > 18 ? o.name.slice(0, 16) + "…" : o.name,
    Vendas: o.total_sold,
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Operadores ativos" value={String(ops.length)} icon={Users} />
        <KpiCard label="Total vendido" value={formatCurrency(totals.total)} icon={DollarSign} />
        <KpiCard label="Total transações" value={String(totals.sales)} icon={Receipt} />
        <KpiCard label="Ticket médio geral" value={formatCurrency(totals.avg)} icon={Receipt} />
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Vendas por operador</h3>
        {isLoading ? <div className="h-72 animate-pulse bg-muted rounded" /> : ops.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Sem vendas no período</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(v: any) => formatCurrency(v)}
              />
              <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Performance por operador</h3>
          <TableExportActions
            data={ops}
            filenamePrefix="performance-operadores"
            columns={[
              { key: "name", label: "Operador" },
              { key: "sale_count", label: "Vendas", format: "number" },
              { key: "total_sold", label: "Total", format: "currency" },
              { key: "avg_ticket", label: "Ticket médio", format: "currency" },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2 px-4">#</th>
                <th className="p-2">Operador</th>
                <th className="p-2 text-right">Nº vendas</th>
                <th className="p-2 text-right">Total vendido</th>
                <th className="p-2 text-right pr-4">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
              {!isLoading && ops.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sem vendas</td></tr>}
              {ops.map((o, i) => (
                <tr key={o.user_id} className="border-t hover:bg-muted/20">
                  <td className="p-2 px-4 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-medium truncate max-w-[250px]">{o.name}</td>
                  <td className="p-2 text-right">{o.sale_count}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(o.total_sold)}</td>
                  <td className="p-2 text-right pr-4 text-muted-foreground">{formatCurrency(o.avg_ticket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
