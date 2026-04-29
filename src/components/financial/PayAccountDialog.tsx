import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Account, usePayAccount } from "@/hooks/useAccounts";

interface Props {
  account: Account | null;
  onOpenChange: (v: boolean) => void;
}

const METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "boleto", label: "Boleto" },
  { value: "transferencia", label: "Transferência" },
];

export function PayAccountDialog({ account, onOpenChange }: Props) {
  const pay = usePayAccount();
  const [form, setForm] = useState({
    paid_at: new Date().toISOString().split("T")[0],
    paid_amount: 0,
    payment_method: "dinheiro",
  });

  useEffect(() => {
    if (account) {
      setForm({
        paid_at: new Date().toISOString().split("T")[0],
        paid_amount: Number(account.amount),
        payment_method: "dinheiro",
      });
    }
  }, [account]);

  const handleSubmit = async () => {
    if (!account) return;
    await pay.mutateAsync({ id: account.id, ...form });
    onOpenChange(false);
  };

  return (
    <Dialog open={!!account} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como pago</DialogTitle>
        </DialogHeader>
        {account && (
          <div className="space-y-4 pt-2">
            <div className="text-sm text-muted-foreground">{account.description}</div>
            <div className="space-y-2">
              <Label>Data do pagamento</Label>
              <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valor {account.type === "receber" ? "recebido" : "pago"}</Label>
              <Input
                type="number"
                step="0.01"
                value={form.paid_amount || ""}
                onChange={(e) => setForm({ ...form, paid_amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSubmit} disabled={form.paid_amount <= 0 || pay.isPending}>
              {pay.isPending ? "Confirmando..." : "Confirmar pagamento"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
