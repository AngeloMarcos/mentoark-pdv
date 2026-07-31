import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePaymentMethods, PaymentMethod, SalePayment, useSeedDefaultPaymentMethods } from "@/hooks/usePaymentMethods";
import { PaymentMethodCard } from "./PaymentMethodCard";
import { PixPaymentSection } from "./PixPaymentSection";
import { useTenant } from "@/contexts/TenantContext";
import { AlertTriangle, Plus, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  onConfirm: (payments: SalePayment[]) => void;
  isProcessing?: boolean;
  hasCustomer?: boolean;
}


interface PaymentEntry {
  method: PaymentMethod;
  amount: number;
  receivedAmount?: number;
  installments: number;
}

export function PaymentDialog({
  open,
  onOpenChange,
  total,
  onConfirm,
  isProcessing = false,
  hasCustomer = false,
}: PaymentDialogProps) {

  const { currentTenant } = useTenant();
  const { data: paymentMethods = [], isLoading } = usePaymentMethods();
  const seedDefaults = useSeedDefaultPaymentMethods();

  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"simple" | "mixed">("simple");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setPayments([]);
      setActiveTab("simple");
    }
  }, [open]);

  // Seed automático se não houver formas de pagamento
  useEffect(() => {
    if (open && !isLoading && paymentMethods.length === 0 && currentTenant) {
      seedDefaults.mutate();
    }
  }, [open, isLoading, paymentMethods.length, currentTenant]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = total - totalPaid;
  const totalChange = payments.reduce((sum, p) => {
    if (p.method.requires_change && p.receivedAmount) {
      return sum + Math.max(0, p.receivedAmount - p.amount);
    }
    return sum;
  }, 0);

  const hasCreditPayment = payments.some(p => p.method.type === "credit" || p.method.code === "fiado");
  const missingCustomerForCredit = hasCreditPayment && !hasCustomer;

  const canFinish =
    totalPaid >= total && payments.every(p => p.amount > 0) && !missingCustomerForCredit;


  const addPayment = (method: PaymentMethod) => {
    // Em modo simples, substitui
    if (activeTab === "simple") {
      setPayments([{ method, amount: total, installments: 1 }]);
    } else {
      // Em modo misto, adiciona
      if (!payments.find(p => p.method.id === method.id)) {
        setPayments([...payments, { method, amount: remaining, installments: 1 }]);
      }
    }
  };

  const updatePayment = (methodId: string, updates: Partial<PaymentEntry>) => {
    setPayments(payments.map(p =>
      p.method.id === methodId ? { ...p, ...updates } : p
    ));
  };

  const removePayment = (methodId: string) => {
    setPayments(payments.filter(p => p.method.id !== methodId));
  };

  const handleConfirm = () => {
    const salePayments: SalePayment[] = payments.map(p => ({
      payment_method_id: p.method.id,
      payment_method_code: p.method.code,
      amount: p.amount,
      change_amount: p.method.requires_change && p.receivedAmount
        ? Math.max(0, p.receivedAmount - p.amount)
        : 0,
      installments: p.installments,
    }));

    onConfirm(salePayments);
  };

  // PIX key from tenant (placeholder - should come from settings)
  const pixKey = currentTenant?.document?.replace(/\D/g, "") || "";

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Forma de Pagamento</DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <div className="p-3 bg-muted rounded-lg space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total da venda</span>
            <span className="font-bold text-lg">{formatCurrency(total)}</span>
          </div>
          {totalPaid > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Pago</span>
              <span className="text-success">{formatCurrency(totalPaid)}</span>
            </div>
          )}
          {remaining > 0 && totalPaid > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Restante</span>
              <span className="text-warning">{formatCurrency(remaining)}</span>
            </div>
          )}
          {totalChange > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Troco</span>
              <span className="text-primary">{formatCurrency(totalChange)}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v as "simple" | "mixed");
          setPayments([]);
        }}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="simple">Pagamento Único</TabsTrigger>
            <TabsTrigger value="mixed">Pagamento Misto</TabsTrigger>
          </TabsList>

          <TabsContent value="simple" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {paymentMethods.map((method) => {
                  const selected = payments.find(p => p.method.id === method.id);

                  // Renderização especial para PIX
                  if (method.type === "pix" && selected) {
                    return (
                      <div key={method.id} className="border-2 border-primary rounded-lg p-3 bg-primary/5">
                        <PixPaymentSection
                          amount={selected.amount}
                          pixKey={pixKey}
                          merchantName={currentTenant?.name || "LOJA"}
                          onAmountChange={(amount) => updatePayment(method.id, { amount })}
                        />
                      </div>
                    );
                  }

                  return (
                    <PaymentMethodCard
                      key={method.id}
                      method={method}
                      amount={selected?.amount || 0}
                      receivedAmount={selected?.receivedAmount}
                      installments={selected?.installments || 1}
                      isSelected={!!selected}
                      onSelect={() => addPayment(method)}
                      onAmountChange={(amount) => updatePayment(method.id, { amount })}
                      onReceivedChange={(receivedAmount) => updatePayment(method.id, { receivedAmount })}
                      onInstallmentsChange={(installments) => updatePayment(method.id, { installments })}
                    />
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mixed" className="mt-4">
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {/* Pagamentos adicionados */}
                {payments.map((payment) => (
                  <PaymentMethodCard
                    key={payment.method.id}
                    method={payment.method}
                    amount={payment.amount}
                    receivedAmount={payment.receivedAmount}
                    installments={payment.installments}
                    isSelected={true}
                    onSelect={() => {}}
                    onAmountChange={(amount) => updatePayment(payment.method.id, { amount })}
                    onReceivedChange={(receivedAmount) => updatePayment(payment.method.id, { receivedAmount })}
                    onInstallmentsChange={(installments) => updatePayment(payment.method.id, { installments })}
                    onRemove={() => removePayment(payment.method.id)}
                  />
                ))}

                {/* Botões para adicionar */}
                {remaining > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground mb-2">
                      Adicionar forma de pagamento:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {paymentMethods
                        .filter(m => !payments.find(p => p.method.id === m.id))
                        .map((method) => (
                          <Button
                            key={method.id}
                            variant="outline"
                            size="sm"
                            onClick={() => addPayment(method)}
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            {method.name}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Aviso de valor insuficiente */}
        {totalPaid > 0 && remaining > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Faltam {formatCurrency(remaining)} para completar o pagamento
            </AlertDescription>
          </Alert>
        )}

        {/* Fiado exige cliente */}
        {missingCustomerForCredit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Venda no fiado exige um cliente. Selecione o cliente no PDV antes de confirmar — será gerada uma Conta a Receber.
            </AlertDescription>
          </Alert>
        )}

        {hasCreditPayment && hasCustomer && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              O valor no fiado não entra no caixa: será gerada uma Conta a Receber para o cliente.
            </AlertDescription>
          </Alert>
        )}


        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canFinish || isProcessing}
            className="min-w-[150px]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Finalizando...
              </>
            ) : (
              <>
                <Check className="mr-2 h-4 w-4" />
                Confirmar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
