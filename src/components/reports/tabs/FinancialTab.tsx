import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Wallet, Percent } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { format } from "date-fns";
import { KpiCard } from "../KpiCard";
import { TableExportActions } from "../TableExportActions";
import {
  useFinancialKPIs,
  useMonthlyFinancial,
  useOverdueReceivables,
  useUpcomingPayables,
} from "@/hooks/useBIReports";
import { useDREReport } from "@/hooks/useReports";
import { formatCurrency } from "@/lib/export-utils";

interface Props { start: Date; end: Date; }

export function FinancialTab({ start, end }: Props) {
  const { data: kpi, isLoading: l1 } = useFinancialKPIs(start, end);
  const { data: monthly = [], isLoading: l2 } = useMonthlyFinancial(6);
  const { data: overdue = [], isLoading: l3 } = useOverdueReceivables();
  const { data: upcoming = [], isLoading: l4 } = useUpcomingPayables();
  const { data: dre } = useDREReport({ startDate: start, endDate: end });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Receita total" value={formatCurrency(kpi?.income || 0)} icon={TrendingUp} />
        <KpiCard label="Despesa total" value={formatCurrency(kpi?.expense || 0)} icon={TrendingDown} />
        <KpiCard
          label="Resultado"
          value={formatCurrency(kpi?.profit || 0)}
          icon={Wallet}
          trend={(kpi?.profit || 0) >= 0 ? "up" : "down"}
          hint={(kpi?.profit || 0) >= 0 ? "Lucro" : "Prejuízo"}
        />
        <KpiCard label="Margem" value={`${(kpi?.margin || 0).toFixed(1)}%`} icon={Percent} />
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">Receitas vs despesas — últimos 6 meses</h3>
        {l2 ? <div className="h-72 animate-pulse bg-muted rounded" /> : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                formatter={(v: any) => formatCurrency(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Receita" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="p-4 border-b flex justify-between items-center">
            <div>
              <h3 className="font-semibold">A Receber vencidas</h3>
              <p className="text-xs text-muted-foreground">{overdue.length} conta(s)</p>
            </div>
            <TableExportActions
              data={overdue}
              filenamePrefix="receber-vencidas"
              columns={[
                { key: "description", label: "Descrição" },
                { key: "party_name", label: "Cliente" },
                { key: "due_date", label: "Vencimento", format: "date" },
                { key: "amount", label: "Valor", format: "currency" },
              ]}
            />
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left sticky top-0">
                <tr>
                  <th className="p-2 px-4">Descrição</th>
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Venc.</th>
                  <th className="p-2 text-right pr-4">Valor</th>
                </tr>
              </thead>
              <tbody>
                {l3 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
                {!l3 && overdue.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Sem contas vencidas ✓</td></tr>}
                {overdue.map((a: any) => (
                  <tr key={a.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 px-4 truncate max-w-[200px]">{a.description}</td>
                    <td className="p-2 truncate max-w-[150px] text-muted-foreground">{a.party_name || "—"}</td>
                    <td className="p-2"><Badge variant="destructive">{format(new Date(a.due_date), "dd/MM/yy")}</Badge></td>
                    <td className="p-2 text-right pr-4 font-medium">{formatCurrency(Number(a.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <div className="p-4 border-b flex justify-between items-center">
            <div>
              <h3 className="font-semibold">A Pagar — próximos 30 dias</h3>
              <p className="text-xs text-muted-foreground">{upcoming.length} conta(s)</p>
            </div>
            <TableExportActions
              data={upcoming}
              filenamePrefix="pagar-30dias"
              columns={[
                { key: "description", label: "Descrição" },
                { key: "party_name", label: "Fornecedor" },
                { key: "due_date", label: "Vencimento", format: "date" },
                { key: "amount", label: "Valor", format: "currency" },
              ]}
            />
          </div>
          <div className="overflow-x-auto max-h-80">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left sticky top-0">
                <tr>
                  <th className="p-2 px-4">Descrição</th>
                  <th className="p-2">Fornecedor</th>
                  <th className="p-2">Venc.</th>
                  <th className="p-2 text-right pr-4">Valor</th>
                </tr>
              </thead>
              <tbody>
                {l4 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
                {!l4 && upcoming.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum vencimento próximo</td></tr>}
                {upcoming.map((a: any) => (
                  <tr key={a.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 px-4 truncate max-w-[200px]">{a.description}</td>
                    <td className="p-2 truncate max-w-[150px] text-muted-foreground">{a.party_name || "—"}</td>
                    <td className="p-2"><Badge variant="outline">{format(new Date(a.due_date), "dd/MM/yy")}</Badge></td>
                    <td className="p-2 text-right pr-4 font-medium">{formatCurrency(Number(a.amount))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-4">DRE simplificado — período</h3>
        <div className="space-y-2 max-w-2xl">
          <DRELine label="Receita bruta de vendas" value={dre?.grossRevenue || 0} />
          <DRELine label="(-) Descontos concedidos" value={-(dre?.discounts || 0)} />
          <DRELine label="(=) Receita líquida" value={dre?.netRevenue || 0} bold />
          <DRELine label="(-) CMV (Custo das mercadorias vendidas)" value={-(dre?.costOfGoodsSold || 0)} />
          <DRELine label="(=) Lucro bruto" value={dre?.grossProfit || 0} bold highlight />
          <DRELine label="(-) Despesas operacionais" value={-(kpi?.expense || 0)} />
          <DRELine
            label="(=) Resultado do período"
            value={(dre?.grossProfit || 0) - (kpi?.expense || 0)}
            bold
            highlight
          />
          <div className="pt-2 text-xs text-muted-foreground">
            Margem líquida:{" "}
            {dre?.netRevenue
              ? (((dre.grossProfit - (kpi?.expense || 0)) / dre.netRevenue) * 100).toFixed(1)
              : "0"}
            %
          </div>
        </div>
      </Card>
    </div>
  );
}

function DRELine({ label, value, bold, highlight }: { label: string; value: number; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between border-b py-2 ${bold ? "font-semibold" : ""} ${highlight ? "text-primary" : ""}`}>
      <span>{label}</span>
      <span className={value < 0 ? "text-destructive" : ""}>{formatCurrency(value)}</span>
    </div>
  );
}
