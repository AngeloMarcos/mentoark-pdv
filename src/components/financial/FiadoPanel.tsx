import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Plus, Check, ChevronDown, ChevronRight, AlertTriangle, NotebookPen } from "lucide-react";
import { Account, useAccounts } from "@/hooks/useAccounts";
import { useCustomers } from "@/hooks/useCustomers";
import { NewAccountDialog } from "./NewAccountDialog";
import { PayAccountDialog } from "./PayAccountDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Group {
  key: string;
  name: string;
  open: Account[];
  openTotal: number;
  overdue: number;
  paidTotal: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function FiadoPanel() {
  const { data: accounts = [], isLoading } = useAccounts("receber");
  const { data: customers = [] } = useCustomers();

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Account | null>(null);

  const customerName = (id: string | null) => customers.find((c) => c.id === id)?.name;

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    accounts.forEach((a) => {
      const key = a.customer_id ?? a.party_name ?? "sem-cliente";
      const name = customerName(a.customer_id) ?? a.party_name ?? "Sem cliente";
      if (!map.has(key)) {
        map.set(key, { key, name, open: [], openTotal: 0, overdue: 0, paidTotal: 0 });
      }
      const g = map.get(key)!;
      if (a.status === "paga") {
        g.paidTotal += Number(a.paid_amount ?? a.amount);
      } else if (a.status !== "cancelada") {
        g.open.push(a);
        g.openTotal += Number(a.amount);
        if (a.status === "vencida") g.overdue += Number(a.amount);
      }
    });
    return Array.from(map.values())
      .filter((g) => g.open.length > 0 || g.paidTotal > 0)
      .filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.openTotal - a.openTotal);
  }, [accounts, customers, search]);

  const totals = useMemo(
    () => ({
      open: groups.reduce((s, g) => s + g.openTotal, 0),
      overdue: groups.reduce((s, g) => s + g.overdue, 0),
      clients: groups.filter((g) => g.openTotal > 0).length,
    }),
    [groups]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova comanda fiado
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Total em aberto</div>
          <div className="text-2xl font-bold text-warning">{fmt(totals.open)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Vencido</div>
          <div className="text-2xl font-bold text-destructive">{fmt(totals.overdue)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Clientes devedores</div>
          <div className="text-2xl font-bold">{totals.clients}</div>
        </CardContent></Card>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Carregando...</div>
        ) : groups.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-lg">
            <NotebookPen className="w-6 h-6 mx-auto mb-2 opacity-60" />
            Nenhuma comanda fiado registrada.
          </div>
        ) : (
          groups.map((g) => {
            const isOpen = expanded === g.key;
            return (
              <Card key={g.key} className={cn(g.overdue > 0 && "border-destructive/40")}>
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : g.key)}
                    className="w-full flex flex-wrap items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                  >
                    {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-medium flex items-center gap-2">
                        {g.overdue > 0 && <AlertTriangle className="w-4 h-4 text-destructive" />}
                        {g.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {g.open.length} lançamento(s) em aberto
                        {g.paidTotal > 0 && ` · ${fmt(g.paidTotal)} já pago`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-warning">{fmt(g.openTotal)}</div>
                      {g.overdue > 0 && (
                        <div className="text-xs text-destructive">{fmt(g.overdue)} vencido</div>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border divide-y divide-border">
                      {g.open.length === 0 ? (
                        <div className="p-4 text-sm text-muted-foreground">Sem pendências.</div>
                      ) : (
                        g.open.map((a) => (
                          <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                            <div className="flex-1 min-w-[180px]">
                              <div className="text-sm font-medium">{a.description}</div>
                              <div className="text-xs text-muted-foreground">
                                Vence {format(new Date(a.due_date + "T00:00:00"), "dd/MM/yyyy")}
                                {a.notes && ` · ${a.notes}`}
                              </div>
                            </div>
                            <div className="font-semibold">{fmt(Number(a.amount))}</div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border",
                                a.status === "vencida"
                                  ? "bg-destructive/15 text-destructive border-destructive/30"
                                  : "bg-warning/15 text-warning border-warning/30"
                              )}
                            >
                              {a.status === "vencida" ? "Vencida" : "Aberta"}
                            </Badge>
                            <Button size="sm" variant="outline" onClick={() => setPayTarget(a)}>
                              <Check className="w-4 h-4 mr-1" /> Receber
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <NewAccountDialog open={newOpen} onOpenChange={setNewOpen} type="receber" />
      <PayAccountDialog account={payTarget} onOpenChange={(v) => !v && setPayTarget(null)} />
    </div>
  );
}
