import { useState } from "react";
import { PaymentMethod, PAYMENT_TYPE_ICONS } from "@/hooks/usePaymentMethods";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, CreditCard, QrCode, Ticket, FileText, FileCheck, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  Banknote,
  CreditCard,
  QrCode,
  Ticket,
  FileText,
  FileCheck,
};

interface PaymentMethodCardProps {
  method: PaymentMethod;
  amount: number;
  receivedAmount?: number;
  installments?: number;
  isSelected: boolean;
  onSelect: () => void;
  onAmountChange: (amount: number) => void;
  onReceivedChange?: (received: number) => void;
  onInstallmentsChange?: (installments: number) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export function PaymentMethodCard({
  method,
  amount,
  receivedAmount,
  installments = 1,
  isSelected,
  onSelect,
  onAmountChange,
  onReceivedChange,
  onInstallmentsChange,
  onRemove,
  disabled = false,
}: PaymentMethodCardProps) {
  const Icon = iconMap[PAYMENT_TYPE_ICONS[method.type] as keyof typeof iconMap] || Banknote;
  const [inputValue, setInputValue] = useState(amount > 0 ? amount.toFixed(2) : "");

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleAmountChange = (value: string) => {
    setInputValue(value);
    const numValue = parseFloat(value.replace(",", ".")) || 0;
    onAmountChange(numValue);
  };

  const changeAmount = method.requires_change && receivedAmount !== undefined
    ? receivedAmount - amount
    : 0;

  // Sugestões de valor para dinheiro
  const suggestions = [10, 20, 50, 100, 200];

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer transition-all border-2",
        isSelected ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/30",
        disabled && "opacity-50 pointer-events-none"
      )}
      onClick={() => !isSelected && onSelect()}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{method.name}</p>
          {method.fee_percentage > 0 && (
            <p className="text-xs text-muted-foreground">
              Taxa: {method.fee_percentage}%
            </p>
          )}
        </div>
        {isSelected && onRemove && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <X className="w-4 h-4" />
          </Button>
        )}
        {!isSelected && (
          <Check className={cn("w-5 h-5", isSelected ? "text-primary" : "text-transparent")} />
        )}
      </div>

      {isSelected && (
        <div className="mt-3 space-y-3" onClick={(e) => e.stopPropagation()}>
          {/* Valor */}
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={inputValue}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0,00"
              className="h-10"
              autoFocus
            />
          </div>

          {/* Parcelas para cartão de crédito */}
          {method.allows_installments && method.max_installments > 1 && (
            <div className="space-y-1">
              <Label className="text-xs">Parcelas</Label>
              <Select
                value={String(installments)}
                onValueChange={(v) => onInstallmentsChange?.(parseInt(v))}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  {Array.from({ length: method.max_installments }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}x de {formatCurrency(amount / n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Troco para dinheiro */}
          {method.requires_change && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Valor Recebido</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={amount}
                  value={receivedAmount?.toFixed(2) || ""}
                  onChange={(e) => onReceivedChange?.(parseFloat(e.target.value) || 0)}
                  placeholder="0,00"
                  className="h-10"
                />
              </div>

              {/* Sugestões de valores */}
              <div className="flex flex-wrap gap-1">
                {suggestions.filter(s => s >= amount).map((value) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => onReceivedChange?.(value)}
                  >
                    R$ {value}
                  </Button>
                ))}
              </div>

              {changeAmount > 0 && (
                <div className="p-2 bg-success/10 rounded-lg">
                  <p className="text-sm text-center">
                    Troco: <span className="font-bold text-success">{formatCurrency(changeAmount)}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
