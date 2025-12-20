import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useFinancialEntries, useTodayFinancialSummary, useCreateFinancialEntry, useDeleteFinancialEntry, CreateFinancialEntryInput } from "@/hooks/useFinancial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { SummaryCardSkeleton, EntryItemSkeleton } from "@/components/ui/skeletons";

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
];

const Financial = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateFinancialEntryInput>({
    entry_date: new Date().toISOString().split("T")[0],
    type: "expense",
    description: "",
    amount: 0,
    payment_method: "dinheiro",
  });

  const { data: todaySummary, isLoading: summaryLoading } = useTodayFinancialSummary();
  const { data: entries = [], isLoading: entriesLoading } = useFinancialEntries();
  const createEntry = useCreateFinancialEntry();
  const deleteEntry = useDeleteFinancialEntry();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleSubmit = async () => {
    if (!form.description || form.amount <= 0) return;
    await createEntry.mutateAsync(form);
    setDialogOpen(false);
    setForm({ entry_date: new Date().toISOString().split("T")[0], type: "expense", description: "", amount: 0, payment_method: "dinheiro" });
  };

  return (
    <AppLayout title="Financeiro">
      <div className="space-y-6 animate-fade-in">
        {/* Today Summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {summaryLoading ? (
            <>
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </>
          ) : (
            <>
              <Card className="stat-card border-success/30"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Entradas Hoje</CardTitle><TrendingUp className="w-4 h-4 text-success" /></CardHeader><CardContent><div className="text-2xl font-bold text-success">{formatCurrency(todaySummary?.income || 0)}</div></CardContent></Card>
              <Card className="stat-card border-destructive/30"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saídas Hoje</CardTitle><TrendingDown className="w-4 h-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(todaySummary?.expense || 0)}</div></CardContent></Card>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo Hoje</CardTitle><Wallet className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${(todaySummary?.balance || 0) >= 0 ? "text-success" : "text-destructive"}`}>{formatCurrency(todaySummary?.balance || 0)}</div></CardContent></Card>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)} className="touch-target"><Plus className="w-4 h-4 mr-2" />Novo Lançamento</Button>
        </div>

        {/* Entries List */}
        <div className="grid gap-3">
          {entriesLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <EntryItemSkeleton key={i} />
              ))}
            </>
          ) : (
            entries.slice(0, 50).map((e) => (
              <Card key={e.id}>
                <CardContent className="flex items-center gap-4 p-4">
                  {e.type === "income" ? <TrendingUp className="w-5 h-5 text-success" /> : <TrendingDown className="w-5 h-5 text-destructive" />}
                  <div className="flex-1"><div className="font-medium">{e.description}</div><div className="text-sm text-muted-foreground">{format(new Date(e.entry_date), "dd/MM/yyyy")} • {e.payment_method || ""}</div></div>
                  <div className={`font-semibold ${e.type === "income" ? "text-success" : "text-destructive"}`}>{e.type === "income" ? "+" : "-"}{formatCurrency(e.amount)}</div>
                  {!e.sale_id && <Button variant="ghost" size="icon" onClick={() => deleteEntry.mutate(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* New Entry Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Lançamento</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2"><Label>Tipo *</Label>
                <Select value={form.type} onValueChange={(v: "income" | "expense") => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="income">Receita</SelectItem><SelectItem value="expense">Despesa</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Data *</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Descrição *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="space-y-2"><Label>Valor *</Label><Input type="number" step="0.01" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} /></div>
              <div className="space-y-2"><Label>Forma de Pagamento</Label>
                <Select value={form.payment_method || ""} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={!form.description || form.amount <= 0 || createEntry.isPending}>{createEntry.isPending ? "Salvando..." : "Criar Lançamento"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Financial;
