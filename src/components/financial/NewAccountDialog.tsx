import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateAccount, AccountType } from "@/hooks/useAccounts";
import { useFinancialCategories } from "@/hooks/useFinancialCategories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  type: AccountType;
}

export function NewAccountDialog({ open, onOpenChange, type }: Props) {
  const create = useCreateAccount();
  const { data: categories = [] } = useFinancialCategories();
  const [form, setForm] = useState({
    description: "",
    amount: 0,
    due_date: new Date().toISOString().split("T")[0],
    category_id: "",
    party_name: "",
    notes: "",
  });

  const partyLabel = type === "receber" ? "Cliente" : "Fornecedor";
  const filteredCats = categories.filter((c) =>
    type === "receber" ? c.type === "receita" : c.type === "despesa"
  );

  const handleSubmit = async () => {
    if (!form.description || form.amount <= 0 || !form.due_date) return;
    await create.mutateAsync({
      type,
      description: form.description,
      amount: form.amount,
      due_date: form.due_date,
      category_id: form.category_id || null,
      party_name: form.party_name || null,
      notes: form.notes || null,
    });
    onOpenChange(false);
    setForm({
      description: "",
      amount: 0,
      due_date: new Date().toISOString().split("T")[0],
      category_id: "",
      party_name: "",
      notes: "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta a {type}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{partyLabel}</Label>
            <Input value={form.party_name} onChange={(e) => setForm({ ...form, party_name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observação</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!form.description || form.amount <= 0 || create.isPending}
          >
            {create.isPending ? "Salvando..." : "Criar conta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
