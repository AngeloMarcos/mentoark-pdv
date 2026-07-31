import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Users, UserPlus, ShoppingCart, Receipt } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { KpiCard } from "../KpiCard";
import { TableExportActions } from "../TableExportActions";
import { useCustomerKPIs, useTopCustomers, useInactiveCustomers } from "@/hooks/useBIReports";
import { formatCurrency } from "@/lib/export-utils";

interface Props { start: Date; end: Date; }

export function CustomersTab({ start, end }: Props) {
  const { data: kpi, isLoading: l1 } = useCustomerKPIs(start, end);
  const { data: top = [], isLoading: l2 } = useTopCustomers(start, end);
  const [days, setDays] = useState(60);
  const { data: inactive = [], isLoading: l3 } = useInactiveCustomers(days);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total de clientes" value={String(kpi?.total_customers || 0)} icon={Users} />
        <KpiCard label="Novos no período" value={String(kpi?.new_in_period || 0)} icon={UserPlus} />
        <KpiCard label="Ativos no período" value={String(kpi?.active_in_period || 0)} icon={ShoppingCart} />
        <KpiCard label="Ticket médio/cliente" value={formatCurrency(kpi?.avg_ticket || 0)} icon={Receipt} />
      </div>

      <Card>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Top clientes</h3>
          <TableExportActions
            data={top}
            filenamePrefix="top-clientes"
            columns={[
              { key: "name", label: "Cliente" },
              { key: "purchase_count", label: "Compras", format: "number" },
              { key: "total_spent", label: "Total gasto", format: "currency" },
              { key: "last_purchase", label: "Última compra", format: "datetime" },
            ]}
          />
        </div>
        <div className="overflow-x-auto max-h-[450px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left sticky top-0">
              <tr>
                <th className="p-2 px-4">#</th>
                <th className="p-2">Cliente</th>
                <th className="p-2 text-right">Compras</th>
                <th className="p-2 text-right">Total gasto</th>
                <th className="p-2 pr-4">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {l2 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
              {!l2 && top.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">Sem clientes ativos no período</td></tr>}
              {top.map((c, i) => (
                <tr key={c.id} className="border-t hover:bg-muted/20">
                  <td className="p-2 px-4 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 font-medium truncate max-w-[200px]">{c.name}</td>
                  <td className="p-2 text-right">{c.purchase_count}</td>
                  <td className="p-2 text-right font-medium">{formatCurrency(c.total_spent)}</td>
                  <td className="p-2 pr-4 text-muted-foreground">{c.last_purchase ? format(new Date(c.last_purchase), "dd/MM/yy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Clientes inativos</h3>
            <p className="text-xs text-muted-foreground">{inactive.length} cliente(s) sem compra há mais de {days} dias</p>
          </div>
          <div className="flex gap-2 items-center">
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="180">180 dias</SelectItem>
              </SelectContent>
            </Select>
            <TableExportActions
              data={inactive}
              filenamePrefix="clientes-inativos"
              columns={[
                { key: "name", label: "Cliente" },
                { key: "phone", label: "Telefone" },
                { key: "email", label: "E-mail" },
                { key: "last_purchase", label: "Última compra", format: "datetime" },
              ]}
            />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[450px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left sticky top-0">
              <tr>
                <th className="p-2 px-4">Cliente</th>
                <th className="p-2">Telefone</th>
                <th className="p-2">E-mail</th>
                <th className="p-2 pr-4">Última compra</th>
              </tr>
            </thead>
            <tbody>
              {l3 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Carregando...</td></tr>}
              {!l3 && inactive.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Nenhum cliente inativo ✓</td></tr>}
              {inactive.map((c: any) => (
                <tr key={c.id} className="border-t hover:bg-muted/20">
                  <td className="p-2 px-4 font-medium truncate max-w-[200px]">{c.name}</td>
                  <td className="p-2 text-muted-foreground">{c.phone || "—"}</td>
                  <td className="p-2 text-muted-foreground truncate max-w-[200px]">{c.email || "—"}</td>
                  <td className="p-2 pr-4 text-muted-foreground">
                    {c.last_purchase ? format(new Date(c.last_purchase), "dd/MM/yy") : "Nunca"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
