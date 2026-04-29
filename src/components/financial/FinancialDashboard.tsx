import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from "lucide-react";
import { useFinancialDashboard, useMonthlyComparison } from "@/hooks/useFinancialDashboard";
import { useUpcomingAccounts } from "@/hooks/useAccounts";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import { format } from "date-fns";

type Period = "today" | "week" | "month" | "previous";

function getRange(p: Period): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  switch (p) {
    case "today": {
      const s = new Date(now); s.setHours(0, 0, 0, 0);
      return { start: s, end };
    }
    case "week": {
      const s = new Date(now); s.setDate(now.getDate() - 6); s.setHours(0, 0, 0, 0);
      return { start: s, end };
    }
    case "previous": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start: s, end: e };
    }
    case "month":
    default: {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: s, end };
    }
  }
}

export function FinancialDashboard() {
  const [period, setPeriod] = useState<Period>("month");
  const range = useMemo(() => getRange(period), [period]);
  const { data, isLoading } = useFinancialDashboard(range.start, range.end);
  const { data: monthly = [] } = useMonthlyComparison();
  const { data: upcoming = [] } = useUpcomingAccounts(7);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Visão geral</h2>
          <p className="text-sm text-muted-foreground">
            {format(range.start, "dd/MM/yyyy")} – {format(range.end, "dd/MM/yyyy")}
          </p>
        </div>
        <Select value={period} onValueChange={(v: Period) => setPeriod(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="week">Últimos 7 dias</SelectItem>
            <SelectItem value="month">Mês atual</SelectItem>
            <SelectItem value="previous">Mês anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.balance ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
              {isLoading ? "—" : fmt(data?.balance ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">Receitas - Despesas</p>
          </CardContent>
        </Card>
        <Card className="stat-card border-success/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
            <TrendingUp className="w-4 h-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{isLoading ? "—" : fmt(data?.income ?? 0)}</div>
          </CardContent>
        </Card>
        <Card className="stat-card border-destructive/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
            <TrendingDown className="w-4 h-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{isLoading ? "—" : fmt(data?.expense ?? 0)}</div>
          </CardContent>
        </Card>
        <Card className="stat-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">A receber / A pagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <ArrowUpCircle className="w-4 h-4 text-success" />
              <span className="text-success font-semibold">{fmt(data?.to_receive ?? 0)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm mt-1">
              <ArrowDownCircle className="w-4 h-4 text-destructive" />
              <span className="text-destructive font-semibold">{fmt(data?.to_pay ?? 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receitas vs Despesas (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v}`} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(v: number) => fmt(v)}
              />
              <Legend />
              <Bar dataKey="income" name="Receitas" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Despesas" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Upcoming */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vencimentos próximos (7 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum vencimento próximo. 🎉</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((a) => {
                const isVencida = a.status === "vencida";
                return (
                  <div
                    key={a.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      isVencida ? "border-destructive/40 bg-destructive/5" : "border-border"
                    }`}
                  >
                    {isVencida && <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.type === "receber" ? "A receber" : "A pagar"} · Vence{" "}
                        {format(new Date(a.due_date + "T00:00:00"), "dd/MM/yyyy")}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-bold ${a.type === "receber" ? "text-success" : "text-destructive"}`}>
                        {fmt(Number(a.amount))}
                      </div>
                      {isVencida && <Badge variant="destructive" className="text-[10px]">Vencida</Badge>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
