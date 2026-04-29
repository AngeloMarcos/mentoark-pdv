import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, Trash2, AlertTriangle, Search } from "lucide-react";
import { Account, AccountType, useAccounts, useDeleteAccount, useUpdateAccountStatus } from "@/hooks/useAccounts";
import { useFinancialCategories } from "@/hooks/useFinancialCategories";
import { NewAccountDialog } from "./NewAccountDialog";
import { PayAccountDialog } from "./PayAccountDialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  type: AccountType;
}

const STATUS_BADGE: Record<string, string> = {
  paga: "bg-success/15 text-success border-success/30",
  aberta: "bg-warning/15 text-warning border-warning/30",
  vencida: "bg-destructive/15 text-destructive border-destructive/30",
  cancelada: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  paga: "Paga",
  aberta: "Aberta",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export function AccountsList({ type }: Props) {
  const { data: accounts = [], isLoading } = useAccounts(type);
  const { data: categories = [] } = useFinancialCategories();
  const deleteAcc = useDeleteAccount();
  const updateStatus = useUpdateAccountStatus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Account | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search && !a.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [accounts, statusFilter, search]);

  const totals = useMemo(() => {
    const open = filtered.filter((a) => a.status === "aberta" || a.status === "vencida");
    const paid = filtered.filter((a) => a.status === "paga");
    return {
      open: open.reduce((s, a) => s + Number(a.amount), 0),
      paid: paid.reduce((s, a) => s + Number(a.paid_amount ?? a.amount), 0),
    };
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="aberta">Abertas</SelectItem>
            <SelectItem value="vencida">Vencidas</SelectItem>
            <SelectItem value="paga">Pagas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nova conta a {type}
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Em aberto</div>
          <div className="text-2xl font-bold text-warning">{fmtCurrency(totals.open)}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground">Pago no período</div>
          <div className="text-2xl font-bold text-success">{fmtCurrency(totals.paid)}</div>
        </CardContent></Card>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-8">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 border border-dashed border-border rounded-lg">
            Nenhuma conta a {type} encontrada.
          </div>
        ) : (
          filtered.map((a) => {
            const isVencida = a.status === "vencida";
            return (
              <Card
                key={a.id}
                className={cn(isVencida && "border-destructive/40 bg-destructive/5")}
              >
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      {isVencida && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      <span className="font-medium">{a.description}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.party_name && <span>{a.party_name} · </span>}
                      {catName(a.category_id)} · Vence {format(new Date(a.due_date + "T00:00:00"), "dd/MM/yyyy")}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{fmtCurrency(Number(a.amount))}</div>
                    {a.paid_at && (
                      <div className="text-xs text-success">
                        Pago em {format(new Date(a.paid_at + "T00:00:00"), "dd/MM/yyyy")}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("border", STATUS_BADGE[a.status])}>
                    {STATUS_LABEL[a.status]}
                  </Badge>
                  <div className="flex gap-1">
                    {a.status !== "paga" && a.status !== "cancelada" && (
                      <Button size="sm" variant="outline" onClick={() => setPayTarget(a)}>
                        <Check className="w-4 h-4 mr-1" /> Pagar
                      </Button>
                    )}
                    {a.status !== "paga" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteAcc.mutate(a.id)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <NewAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} type={type} />
      <PayAccountDialog account={payTarget} onOpenChange={(v) => !v && setPayTarget(null)} />
    </div>
  );
}
