import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCloseCash, useSessionSummary, CashSession, CashRegister } from "@/hooks/useCashRegister";
import { Lock, AlertTriangle, CheckCircle2, Banknote, CreditCard, Smartphone, Wallet } from "lucide-react";

interface CloseCashDialogProps {
  session: CashSession & { register: CashRegister };
  onSuccess?: () => void;
}

interface PaymentMethodCount {
  code: string;
  label: string;
  icon: React.ReactNode;
  expected: number;
  counted: string;
  requiresCount: boolean; // Only cash needs physical counting
}

const PAYMENT_METHOD_CONFIG: Record<string, { label: string; icon: React.ReactNode; requiresCount: boolean }> = {
  dinheiro: { label: "Dinheiro", icon: <Banknote className="w-4 h-4" />, requiresCount: true },
  cartao_debito: { label: "Cartão Débito", icon: <CreditCard className="w-4 h-4" />, requiresCount: false },
  cartao_credito: { label: "Cartão Crédito", icon: <CreditCard className="w-4 h-4" />, requiresCount: false },
  pix: { label: "PIX", icon: <Smartphone className="w-4 h-4" />, requiresCount: false },
  fiado: { label: "Fiado/Crediário", icon: <Wallet className="w-4 h-4" />, requiresCount: false },
};

export function CloseCashDialog({ session, onSuccess }: CloseCashDialogProps) {
  const [differenceReason, setDifferenceReason] = useState("");
  const [notes, setNotes] = useState(session.notes || "");
  const [paymentCounts, setPaymentCounts] = useState<Record<string, string>>({});

  const closeCash = useCloseCash();
  const summary = useSessionSummary(session.id);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Build payment method breakdown with expected values
  const paymentMethods: PaymentMethodCount[] = useMemo(() => {
    const methods: PaymentMethodCount[] = [];
    
    // Add cash with opening balance + supply - withdrawal
    const cashFromSales = summary.byPaymentMethod["dinheiro"] || 0;
    const expectedCash = session.opening_balance + cashFromSales + summary.totalSupply - summary.totalWithdrawal;
    
    methods.push({
      code: "dinheiro",
      label: PAYMENT_METHOD_CONFIG["dinheiro"]?.label || "Dinheiro",
      icon: PAYMENT_METHOD_CONFIG["dinheiro"]?.icon || <Banknote className="w-4 h-4" />,
      expected: expectedCash,
      counted: paymentCounts["dinheiro"] || "",
      requiresCount: true,
    });

    // Add other payment methods from sales
    Object.entries(summary.byPaymentMethod).forEach(([code, amount]) => {
      if (code !== "dinheiro" && amount > 0) {
        const config = PAYMENT_METHOD_CONFIG[code] || { 
          label: code.replace("_", " ").replace(/^\w/, c => c.toUpperCase()), 
          icon: <CreditCard className="w-4 h-4" />, 
          requiresCount: false 
        };
        methods.push({
          code,
          label: config.label,
          icon: config.icon,
          expected: amount,
          counted: paymentCounts[code] || "",
          requiresCount: config.requiresCount,
        });
      }
    });

    return methods;
  }, [summary, session.opening_balance, paymentCounts]);

  // Calculate totals
  const expectedTotal = paymentMethods.reduce((sum, m) => sum + m.expected, 0);
  const countedTotal = paymentMethods.reduce((sum, m) => {
    const counted = parseFloat(m.counted) || 0;
    // For non-cash methods that don't require counting, use expected value
    if (!m.requiresCount && !m.counted) {
      return sum + m.expected;
    }
    return sum + counted;
  }, 0);

  // Only cash affects physical balance
  const cashExpected = paymentMethods.find(m => m.code === "dinheiro")?.expected || 0;
  const cashCounted = parseFloat(paymentCounts["dinheiro"]) || 0;
  const cashDifference = cashCounted - cashExpected;
  const hasCashDifference = Math.abs(cashDifference) >= 0.01;

  const updatePaymentCount = (code: string, value: string) => {
    setPaymentCounts(prev => ({ ...prev, [code]: value }));
  };

  const cashCountEntered = paymentCounts["dinheiro"] !== undefined && paymentCounts["dinheiro"] !== "";

  const handleClose = async () => {
    if (!cashCountEntered) return;

    // O saldo de fechamento representa apenas o dinheiro físico da gaveta.
    // PIX/cartão não ficam no caixa e são conferidos separadamente por método.
    const closingBalance = paymentMethods
      .filter(m => m.requiresCount)
      .reduce((sum, m) => sum + (parseFloat(m.counted) || 0), 0);


    const discrepancy_by_method: Record<string, { expected: number; counted: number; difference: number }> = {};
    for (const m of paymentMethods) {
      const counted = m.requiresCount ? parseFloat(m.counted) || 0 : m.expected;
      discrepancy_by_method[m.code] = {
        expected: Number(m.expected.toFixed(2)),
        counted: Number(counted.toFixed(2)),
        difference: Number((counted - m.expected).toFixed(2)),
      };
    }

    await closeCash.mutateAsync({
      session_id: session.id,
      closing_balance: closingBalance,
      difference_reason: hasCashDifference ? differenceReason : undefined,
      notes: notes || undefined,
      discrepancy_by_method,
    });

    onSuccess?.();
  };

  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto">
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

      {/* Resumo rápido */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Fundo</p>
              <p className="font-semibold text-sm">{formatCurrency(session.opening_balance)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vendas</p>
              <p className="font-semibold text-sm text-success">{summary.salesCount}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Suprimentos</p>
              <p className="font-semibold text-sm text-success">+{formatCurrency(summary.totalSupply)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sangrias</p>
              <p className="font-semibold text-sm text-destructive">-{formatCurrency(summary.totalWithdrawal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conferência por forma de pagamento */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm flex items-center gap-2">
          Conferência por Forma de Pagamento
          <Badge variant="outline" className="text-xs">
            {paymentMethods.length} forma{paymentMethods.length !== 1 ? "s" : ""}
          </Badge>
        </h4>
        
        {paymentMethods.map((method) => (
          <Card key={method.code} className={method.requiresCount ? "border-primary/30" : "border-muted"}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  {method.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{method.label}</span>
                    <span className="text-sm text-muted-foreground">
                      Esperado: {formatCurrency(method.expected)}
                    </span>
                  </div>
                  
                  {method.requiresCount ? (
                    <div className="mt-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Valor contado..."
                        value={method.counted}
                        onChange={(e) => updatePaymentCount(method.code, e.target.value)}
                        className="h-9"
                      />
                      {method.counted && (
                        <div className={`mt-1 text-xs ${
                          Math.abs((parseFloat(method.counted) || 0) - method.expected) < 0.01
                            ? "text-success"
                            : "text-destructive"
                        }`}>
                          {(parseFloat(method.counted) || 0) - method.expected >= 0 ? "+" : ""}
                          {formatCurrency((parseFloat(method.counted) || 0) - method.expected)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">
                      Pagamento eletrônico - não requer contagem física
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Totais */}
      <Card className="border-primary">
        <CardContent className="p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total esperado:</span>
            <span className="font-medium">{formatCurrency(expectedTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total em dinheiro contado:</span>
            <span className="font-medium">{formatCurrency(cashCounted)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total em cartões/PIX:</span>
            <span className="font-medium">
              {formatCurrency(paymentMethods.filter(m => !m.requiresCount).reduce((sum, m) => sum + m.expected, 0))}
            </span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>Total geral:</span>
            <span>{formatCurrency(
              cashCounted + paymentMethods.filter(m => !m.requiresCount).reduce((sum, m) => sum + m.expected, 0)
            )}</span>
          </div>
        </CardContent>
      </Card>

      {/* Diferença de dinheiro */}
      {cashCountEntered && (
        <div className={`p-3 rounded-lg flex items-center gap-3 ${
          hasCashDifference 
            ? "bg-destructive/10 border border-destructive/20" 
            : "bg-success/10 border border-success/20"
        }`}>
          {hasCashDifference ? (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-success" />
          )}
          <div className="flex-1">
            <p className={`font-medium ${hasCashDifference ? "text-destructive" : "text-success"}`}>
              {hasCashDifference
                ? cashDifference > 0
                  ? `Sobra de dinheiro: ${formatCurrency(cashDifference)}`
                  : `Falta de dinheiro: ${formatCurrency(Math.abs(cashDifference))}`
                : "Dinheiro conferido corretamente"
              }
            </p>
          </div>
        </div>
      )}

      {/* Motivo da diferença */}
      {hasCashDifference && (
        <div className="space-y-2">
          <Label>Motivo da diferença *</Label>
          <Textarea
            placeholder="Explique o motivo da diferença de dinheiro..."
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
        disabled={!cashCountEntered || (hasCashDifference && !differenceReason) || closeCash.isPending}
      >
        {closeCash.isPending ? "Fechando..." : "Fechar Caixa"}
      </Button>
    </div>
  );
}
