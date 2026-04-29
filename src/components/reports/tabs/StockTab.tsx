import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, DollarSign, BarChart3 } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { KpiCard } from "../KpiCard";
import { TableExportActions } from "../TableExportActions";
import { useStockReport, useStockByCategory, useProductsWithoutMovement } from "@/hooks/useBIReports";
import { formatCurrency } from "@/lib/export-utils";

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--accent))", "#8b5cf6", "#ec4899",
  "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#6366f1", "#14b8a6",
];

interface Props { start: Date; end: Date; }

type SortKey = "name" | "stock_current" | "min_stock" | "unit_cost" | "total_value";

export function StockTab({ start, end }: Props) {
  const { data: stock = [], isLoading: l1 } = useStockReport();
  const stockByCat = useStockByCategory();
  const { data: noMovement = [], isLoading: l2 } = useProductsWithoutMovement(start, end);

  const [sortKey, setSortKey] = useState<SortKey>("total_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const kpis = useMemo(() => {
    const total = stock.length;
    const low = stock.filter((s) => s.below_min).length;
    const value = stock.reduce((s, p) => s + p.total_value, 0);
    const avg = total > 0 ? value / total : 0;
    return { total, low, value, avg };
  }, [stock]);

  const sorted = useMemo(() => {
    const copy = [...stock];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string") return sortDir === "asc" ? av.localeCompare(String(bv)) : String(bv).localeCompare(av);
      return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return copy;
  }, [stock, sortKey, sortDir]);

  const handleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  };

  const SortHeader = ({ k, label, align }: { k: SortKey; label: string; align?: "right" }) => (
    <th
      onClick={() => handleSort(k)}
      className={`p-2 cursor-pointer hover:bg-muted/60 select-none ${align === "right" ? "text-right" : ""}`}
    >
      {label} {sortKey === k && (sortDir === "asc" ? "↑" : "↓")}
    </th>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total de produtos" value={String(kpis.total)} icon={Package} />
        <KpiCard
          label="Estoque baixo"
          value={String(kpis.low)}
          icon={AlertTriangle}
          hint={kpis.low > 0 ? "Verificar reposição" : "Tudo certo"}
          trend={kpis.low > 0 ? "down" : "up"}
        />
        <KpiCard label="Valor total" value={formatCurrency(kpis.value)} icon={DollarSign} />
        <KpiCard label="Valor médio/item" value={formatCurrency(kpis.avg)} icon={BarChart3} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <h3 className="font-semibold">Estoque atual</h3>
            <TableExportActions
              data={sorted}
              filenamePrefix="estoque-atual"
              columns={[
                { key: "name", label: "Produto" },
                { key: "category", label: "Categoria" },
                { key: "stock_current", label: "Estoque", format: "number" },
                { key: "min_stock", label: "Mínimo", format: "number" },
                { key: "unit_cost", label: "Valor unit.", format: "currency" },
                { key: "total_value", label: "Valor total", format: "currency" },
              ]}
            />
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left sticky top-0">
                <tr>
                  <SortHeader k="name" label="Produto" />
                  <th className="p-2">Categoria</th>
                  <SortHeader k="stock_current" label="Estoque" align="right" />
                  <SortHeader k="min_stock" label="Mínimo" align="right" />
                  <SortHeader k="unit_cost" label="Valor unit." align="right" />
                  <SortHeader k="total_value" label="Valor total" align="right" />
                </tr>
              </thead>
              <tbody>
                {l1 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
                {!l1 && sorted.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Sem produtos</td></tr>}
                {sorted.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/20">
                    <td className="p-2 font-medium">
                      <div className="flex items-center gap-2">
                        {p.below_min && <Badge variant="destructive" className="text-[10px] py-0">Baixo</Badge>}
                        <span className="truncate max-w-[200px]">{p.name}</span>
                      </div>
                    </td>
                    <td className="p-2 text-muted-foreground">{p.category || "—"}</td>
                    <td className="p-2 text-right">{p.stock_current.toFixed(0)}</td>
                    <td className="p-2 text-right text-muted-foreground">{p.min_stock?.toFixed(0) ?? "—"}</td>
                    <td className="p-2 text-right">{formatCurrency(p.unit_cost)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(p.total_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold mb-3">Distribuição por categoria</h3>
          {stockByCat.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stockByCat}
                  dataKey="value"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                >
                  {stockByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  formatter={(v: any) => formatCurrency(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <div className="p-4 border-b flex justify-between items-center">
          <div>
            <h3 className="font-semibold">Produtos sem movimento</h3>
            <p className="text-xs text-muted-foreground">Não vendidos no período selecionado</p>
          </div>
          <TableExportActions
            data={noMovement}
            filenamePrefix="sem-movimento"
            columns={[
              { key: "name", label: "Produto" },
              { key: "category", label: "Categoria" },
              { key: "stock_current", label: "Estoque", format: "number" },
            ]}
          />
        </div>
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left sticky top-0">
              <tr>
                <th className="p-2 px-4">Produto</th>
                <th className="p-2">Categoria</th>
                <th className="p-2 text-right pr-4">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {l2 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
              {!l2 && noMovement.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Todos os produtos tiveram movimento ✓</td></tr>}
              {noMovement.map((p: any) => (
                <tr key={p.id} className="border-t hover:bg-muted/20">
                  <td className="p-2 px-4 font-medium">{p.name}</td>
                  <td className="p-2 text-muted-foreground">{p.category || "—"}</td>
                  <td className="p-2 text-right pr-4">{Number(p.stock_current ?? 0).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
