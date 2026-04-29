import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid } from "recharts";
import { ShoppingCart, DollarSign, Receipt, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { KpiCard } from "./KpiCard";
import { TableExportActions } from "./TableExportActions";
import { useDailyReport, useProductRevenueReport, usePaymentMethodReport } from "@/hooks/useReports";
import { useHourlyReport, useSalesHistory } from "@/hooks/useBIReports";
import { formatCurrency } from "@/lib/export-utils";

interface Props {
  start: Date;
  end: Date;
}

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "PIX", cartao_debito: "Cartão Débito",
  cartao_credito: "Cartão Crédito", fiado: "Fiado",
};

export function SalesTab({ start, end }: Props) {
  const filters = { startDate: start, endDate: end, limit: 10 };
  const { data: daily = [], isLoading: l1 } = useDailyReport(filters);
  const { data: top = [], isLoading: l2 } = useProductRevenueReport(filters);
  const { data: payments = [], isLoading: l3 } = usePaymentMethodReport(filters);
  const { data: hourly = [], isLoading: l4 } = useHourlyReport(start, end);
  const { data: history = [], isLoading: l5 } = useSalesHistory(start, end);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  const totals = useMemo(() => {
    const total = daily.reduce((s, d) => s + d.net_total, 0);
    const count = daily.reduce((s, d) => s + d.sale_count, 0);
    const avg = count > 0 ? total / count : 0;
    return { total, count, avg };
  }, [daily]);

  const filteredHistory = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return history;
    return history.filter(
      (h) =>
        h.operator_name?.toLowerCase().includes(q) ||
        h.customer_name?.toLowerCase().includes(q) ||
        h.payment_method.toLowerCase().includes(q)
    );
  }, [history, search]);

  const pagedHistory = filteredHistory.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredHistory.length / PAGE_SIZE);

  const dailyChart = daily.map((d) => ({
    date: format(new Date(d.date + "T00:00:00"), "dd/MM"),
    Faturamento: d.net_total,
  }));

  const hourlyChart = hourly.map((h) => ({
    hour: `${String(h.hour).padStart(2, "0")}h`,
    Vendas: h.sale_count,
  }));

  const topProduct = top[0];

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total vendido" value={formatCurrency(totals.total)} icon={DollarSign} />
        <KpiCard label="Transações" value={String(totals.count)} icon={ShoppingCart} />
        <KpiCard label="Ticket médio" value={formatCurrency(totals.avg)} icon={Receipt} />
        <KpiCard
          label="Top produto"
          value={topProduct?.product_name || "—"}
          icon={Trophy}
          hint={topProduct ? `${topProduct.quantity_sold.toFixed(0)} un · ${formatCurrency(topProduct.revenue)}` : ""}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Faturamento diário</h3>
          {l1 ? <div className="h-64 animate-pulse bg-muted rounded" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={dailyChart}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: any) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="Faturamento" stroke="hsl(var(--primary))" fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Vendas por hora</h3>
          {l4 ? <div className="h-64 animate-pulse bg-muted rounded" /> : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={hourlyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="Vendas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Top 10 + Payments */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Top 10 produtos</h3>
            <TableExportActions
              data={top}
              filenamePrefix="top-produtos"
              columns={[
                { key: "product_name", label: "Produto" },
                { key: "quantity_sold", label: "Qtd", format: "number" },
                { key: "revenue", label: "Total", format: "currency" },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2 px-4">#</th>
                  <th className="p-2">Produto</th>
                  <th className="p-2 text-right">Qtd</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-right pr-4">%</th>
                </tr>
              </thead>
              <tbody>
                {l2 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
                {!l2 && top.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sem dados</td></tr>}
                {top.map((p, i) => (
                  <tr key={p.product_id} className="border-t hover:bg-muted/20">
                    <td className="p-2 px-4 text-muted-foreground">{i + 1}</td>
                    <td className="p-2 truncate max-w-[200px]">{p.product_name}</td>
                    <td className="p-2 text-right">{p.quantity_sold.toFixed(0)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(p.revenue)}</td>
                    <td className="p-2 text-right pr-4 text-muted-foreground">
                      {totals.total > 0 ? ((p.revenue / totals.total) * 100).toFixed(1) : "0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Por forma de pagamento</h3>
            <TableExportActions
              data={payments}
              filenamePrefix="formas-pagamento"
              columns={[
                { key: "payment_label", label: "Forma" },
                { key: "sale_count", label: "Vendas", format: "number" },
                { key: "total_amount", label: "Total", format: "currency" },
                { key: "percentage", label: "%", format: "percent" },
              ]}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  <th className="p-2 px-4">Forma</th>
                  <th className="p-2 text-right">Vendas</th>
                  <th className="p-2 text-right">Total</th>
                  <th className="p-2 text-right pr-4">%</th>
                </tr>
              </thead>
              <tbody>
                {l3 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
                {!l3 && payments.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sem dados</td></tr>}
                {payments.map((p) => (
                  <tr key={p.payment_method} className="border-t hover:bg-muted/20">
                    <td className="p-2 px-4">{p.payment_label}</td>
                    <td className="p-2 text-right">{p.sale_count}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(p.total_amount)}</td>
                    <td className="p-2 text-right pr-4 text-muted-foreground">{p.percentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* History */}
      <Card>
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Histórico de vendas</h3>
            <p className="text-xs text-muted-foreground">{filteredHistory.length} resultado(s)</p>
          </div>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-48 h-9"
            />
            <TableExportActions
              data={filteredHistory}
              filenamePrefix="historico-vendas"
              columns={[
                { key: "datetime", label: "Data", format: "datetime" },
                { key: "operator_name", label: "Operador" },
                { key: "customer_name", label: "Cliente" },
                { key: "item_count", label: "Itens", format: "number" },
                { key: "net_total", label: "Total", format: "currency" },
                { key: "payment_method", label: "Pagamento" },
              ]}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="p-2 px-4">Data</th>
                <th className="p-2">Operador</th>
                <th className="p-2">Cliente</th>
                <th className="p-2 text-right">Itens</th>
                <th className="p-2 text-right">Total</th>
                <th className="p-2 pr-4">Pagamento</th>
              </tr>
            </thead>
            <tbody>
              {l5 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
              {!l5 && pagedHistory.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Nenhuma venda encontrada</td></tr>}
              {pagedHistory.map((s) => (
                <tr key={s.id} className="border-t hover:bg-muted/20">
                  <td className="p-2 px-4">{format(new Date(s.datetime), "dd/MM/yy HH:mm")}</td>
                  <td className="p-2 truncate max-w-[180px]">{s.operator_name || "—"}</td>
                  <td className="p-2 truncate max-w-[180px]">{s.customer_name || "—"}</td>
                  <td className="p-2 text-right">{s.item_count}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(s.net_total)}</td>
                  <td className="p-2 pr-4">
                    <Badge variant="outline">{PAYMENT_LABELS[s.payment_method] || s.payment_method}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="p-3 border-t flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Página {page + 1} de {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-muted"
              >Anterior</button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-muted"
              >Próxima</button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
