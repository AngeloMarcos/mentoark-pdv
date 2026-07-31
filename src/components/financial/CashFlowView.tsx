import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { useCashFlow } from "@/hooks/useCashFlow";
import { format } from "date-fns";
import { downloadCSV } from "@/lib/csv-utils";

export function CashFlowView() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [start, setStart] = useState(firstOfMonth.toISOString().split("T")[0]);
  const [end, setEnd] = useState(today.toISOString().split("T")[0]);

  const { data: rows = [], isLoading } = useCashFlow(new Date(start + "T00:00:00"), new Date(end + "T00:00:00"));

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const totals = useMemo(() => {
    const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
    return { income, expense, balance: income - expense };
  }, [rows]);

  const handleExport = () => {
    const headers = ["Data", "Descricao", "Tipo", "Forma", "Valor", "Saldo"];
    const lines = rows.map((r) =>
      [
        format(new Date(r.date + "T00:00:00"), "dd/MM/yyyy"),
        `"${r.description.replace(/"/g, '""')}"`,
        r.type === "income" ? "Entrada" : "Saida",
        r.payment_method ?? "",
        r.amount.toFixed(2).replace(".", ","),
        r.balance.toFixed(2).replace(".", ","),
      ].join(";"),
    );
    const csv = "\uFEFF" + headers.join(";") + "\n" + lines.join("\n");
    downloadCSV(csv, `fluxo-de-caixa-${start}-a-${end}.csv`);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">De</label>
          <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-[150px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Até</label>
          <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-[150px]" />
        </div>
        <div className="ml-auto">
          <Button variant="outline" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Entradas</div>
          <div className="text-2xl font-bold text-success">{fmt(totals.income)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Saídas</div>
          <div className="text-2xl font-bold text-destructive">{fmt(totals.expense)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Saldo</div>
          <div className={`text-2xl font-bold ${totals.balance >= 0 ? "text-success" : "text-destructive"}`}>
            {fmt(totals.balance)}
          </div>
        </CardContent></Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/30">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Data</th>
                  <th className="p-3 font-semibold">Descrição</th>
                  <th className="p-3 font-semibold">Tipo</th>
                  <th className="p-3 font-semibold text-right">Valor</th>
                  <th className="p-3 font-semibold text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Carregando...</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Sem movimentações no período.
                  </td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-3 whitespace-nowrap">{format(new Date(r.date + "T00:00:00"), "dd/MM/yyyy")}</td>
                    <td className="p-3">{r.description}</td>
                    <td className="p-3">
                      {r.type === "income" ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <ArrowUpCircle className="w-3 h-3" /> Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-destructive">
                          <ArrowDownCircle className="w-3 h-3" /> Saída
                        </span>
                      )}
                    </td>
                    <td className={`p-3 text-right font-medium ${r.type === "income" ? "text-success" : "text-destructive"}`}>
                      {r.type === "income" ? "+" : "-"}{fmt(r.amount)}
                    </td>
                    <td className={`p-3 text-right font-bold ${r.balance >= 0 ? "text-foreground" : "text-destructive"}`}>
                      {fmt(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
