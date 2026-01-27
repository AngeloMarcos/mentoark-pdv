import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useCloseCash, useSessionSummary, CashSession, CashRegister } from "@/hooks/useCashRegister";
import { Lock, AlertTriangle, CheckCircle } from "lucide-react";

interface CloseCashDialogProps {
  session: CashSession & { register: CashRegister };
  onSuccess?: () => void;
}

export function CloseCashDialog({ session, onSuccess }: CloseCashDialogProps) {
  const [closingBalance, setClosingBalance] = useState("");
  const [differenceReason, setDifferenceReason] = useState("");
  const [notes, setNotes] = useState(session.notes || "");

  const closeCash = useCloseCash();
  const summary = useSessionSummary(session.id);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Calcula saldo esperado
  const expectedBalance = session.opening_balance + summary.totalSales + summary.totalSupply - summary.totalWithdrawal;
  const actualBalance = parseFloat(closingBalance) || 0;
  const difference = actualBalance - expectedBalance;
  const hasDifference = Math.abs(difference) >= 0.01;

  const handleClose = async () => {
    if (!closingBalance) return;

    await closeCash.mutateAsync({
      session_id: session.id,
      closing_balance: actualBalance,
      difference_reason: hasDifference ? differenceReason : undefined,
      notes: notes || undefined,
    });

    onSuccess?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
        <div className="w-12 h-12 rounded-full bg-destructive flex items-center justify-center">
          <Lock className="w-6 h-6 text-destructive-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">Fechamento de Caixa</h3>
          <p className="text-sm text-muted-foreground">
            {session.register.name} • Aberto em {new Date(session.opened_at).toLocaleString("pt-BR")}
          </p>
        </div>
      </div>

      {/* Resumo do dia */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground">Resumo da Sessão</h4>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fundo inicial:</span>
              <span>{formatCurrency(session.opening_balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendas ({summary.salesCount}):</span>
              <span className="text-success">+{formatCurrency(summary.totalSales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Suprimentos:</span>
              <span className="text-success">+{formatCurrency(summary.totalSupply)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sangrias:</span>
              <span className="text-destructive">-{formatCurrency(summary.totalWithdrawal)}</span>
            </div>
          </div>

          <div className="border-t pt-2">
            <div className="flex justify-between font-semibold">
              <span>Saldo esperado:</span>
              <span>{formatCurrency(expectedBalance)}</span>
            </div>
          </div>

          {/* Detalhamento por forma de pagamento */}
          {Object.keys(summary.byPaymentMethod).length > 0 && (
            <div className="border-t pt-2 space-y-1">
              <h5 className="text-xs font-medium text-muted-foreground">Por forma de pagamento:</h5>
              {Object.entries(summary.byPaymentMethod).map(([method, amount]) => (
                <div key={method} className="flex justify-between text-sm">
                  <span className="capitalize">{method.replace("_", " ")}</span>
                  <span>{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conferência */}
      <div className="space-y-2">
        <Label>Valor conferido no caixa (R$) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder="0,00"
          value={closingBalance}
          onChange={(e) => setClosingBalance(e.target.value)}
          className="text-lg"
        />
      </div>

      {/* Diferença */}
      {closingBalance && (
        <div className={`p-3 rounded-lg flex items-center gap-3 ${
          hasDifference 
            ? "bg-destructive/10 border border-destructive/20" 
            : "bg-success/10 border border-success/20"
        }`}>
          {hasDifference ? (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          ) : (
            <CheckCircle className="w-5 h-5 text-success" />
          )}
          <div className="flex-1">
            <p className={`font-medium ${hasDifference ? "text-destructive" : "text-success"}`}>
              {hasDifference
                ? difference > 0
                  ? `Sobra de ${formatCurrency(difference)}`
                  : `Falta de ${formatCurrency(Math.abs(difference))}`
                : "Caixa conferido corretamente"
              }
            </p>
          </div>
        </div>
      )}

      {/* Motivo da diferença */}
      {hasDifference && (
        <div className="space-y-2">
          <Label>Motivo da diferença *</Label>
          <Textarea
            placeholder="Explique o motivo da diferença..."
            value={differenceReason}
            onChange={(e) => setDifferenceReason(e.target.value)}
            rows={2}
          />
        </div>
      )}

      {/* Observações */}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea
          placeholder="Observações adicionais..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </div>

      <Button
        variant="destructive"
        className="w-full"
        onClick={handleClose}
        disabled={!closingBalance || (hasDifference && !differenceReason) || closeCash.isPending}
      >
        {closeCash.isPending ? "Fechando..." : "Fechar Caixa"}
      </Button>
    </div>
  );
}
