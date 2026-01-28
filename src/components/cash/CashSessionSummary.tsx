import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCashMovements, CashSession, CashRegister, useSessionSummary } from "@/hooks/useCashRegister";
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ShoppingCart, 
  DollarSign, 
  Lock, 
  Banknote, 
  CreditCard, 
  Smartphone,
  Wallet 
} from "lucide-react";

interface CashSessionSummaryProps {
  session: CashSession & { register: CashRegister };
}

const PAYMENT_METHOD_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  dinheiro: { label: "Dinheiro", icon: <Banknote className="w-4 h-4" /> },
  cartao_debito: { label: "Cartão Débito", icon: <CreditCard className="w-4 h-4" /> },
  cartao_credito: { label: "Cartão Crédito", icon: <CreditCard className="w-4 h-4" /> },
  pix: { label: "PIX", icon: <Smartphone className="w-4 h-4" /> },
  fiado: { label: "Fiado/Crediário", icon: <Wallet className="w-4 h-4" /> },
};

export function CashSessionSummary({ session }: CashSessionSummaryProps) {
  const { data: movements = [] } = useCashMovements(session.id);
  const summary = useSessionSummary(session.id);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const getMovementIcon = (type: string) => {
    switch (type) {
      case "opening":
        return <DollarSign className="w-4 h-4 text-primary" />;
      case "sale":
        return <ShoppingCart className="w-4 h-4 text-success" />;
      case "supply":
        return <ArrowDownCircle className="w-4 h-4 text-success" />;
      case "withdrawal":
        return <ArrowUpCircle className="w-4 h-4 text-destructive" />;
      case "closing":
        return <Lock className="w-4 h-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  const getMovementLabel = (type: string) => {
    switch (type) {
      case "opening":
        return "Abertura";
      case "sale":
        return "Venda";
      case "supply":
        return "Suprimento";
      case "withdrawal":
        return "Sangria";
      case "closing":
        return "Fechamento";
      default:
        return type;
    }
  };

  const expectedBalance = session.opening_balance + summary.totalSales + summary.totalSupply - summary.totalWithdrawal;
  const hasPaymentBreakdown = Object.keys(summary.byPaymentMethod).length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {session.register.name}
            <Badge variant={session.status === "open" ? "default" : "secondary"} className="ml-2">
              {session.status === "open" ? "Aberto" : "Fechado"}
            </Badge>
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Aberto em {new Date(session.opened_at).toLocaleString("pt-BR")}
          {session.closed_at && ` • Fechado em ${new Date(session.closed_at).toLocaleString("pt-BR")}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo financeiro */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">Fundo Inicial</p>
            <p className="font-semibold">{formatCurrency(session.opening_balance)}</p>
          </div>
          <div className="p-3 bg-success/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Vendas ({summary.salesCount})</p>
            <p className="font-semibold text-success">{formatCurrency(summary.totalSales)}</p>
          </div>
          <div className="p-3 bg-success/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Suprimentos</p>
            <p className="font-semibold text-success">+{formatCurrency(summary.totalSupply)}</p>
          </div>
          <div className="p-3 bg-destructive/10 rounded-lg">
            <p className="text-xs text-muted-foreground">Sangrias</p>
            <p className="font-semibold text-destructive">-{formatCurrency(summary.totalWithdrawal)}</p>
          </div>
        </div>

        {/* Detalhamento por forma de pagamento */}
        {hasPaymentBreakdown && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Vendas por Forma de Pagamento
            </h4>
            <div className="grid gap-2">
              {Object.entries(summary.byPaymentMethod).map(([code, amount]) => {
                const config = PAYMENT_METHOD_CONFIG[code] || { 
                  label: code.replace("_", " ").replace(/^\w/, c => c.toUpperCase()), 
                  icon: <CreditCard className="w-4 h-4" /> 
                };
                return (
                  <div key={code} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-background flex items-center justify-center">
                        {config.icon}
                      </div>
                      <span className="text-sm font-medium">{config.label}</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(amount)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Saldo */}
        <div className="p-4 bg-primary/10 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Saldo Esperado:</span>
            <span className="text-xl font-bold">{formatCurrency(expectedBalance)}</span>
          </div>
          {session.status === "closed" && session.closing_balance !== null && (
            <>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm text-muted-foreground">Saldo Conferido:</span>
                <span className="font-medium">{formatCurrency(session.closing_balance)}</span>
              </div>
              {session.difference !== null && Math.abs(session.difference) >= 0.01 && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">Diferença:</span>
                  <span className={`font-medium ${session.difference > 0 ? "text-success" : "text-destructive"}`}>
                    {session.difference > 0 ? "+" : ""}{formatCurrency(session.difference)}
                  </span>
                </div>
              )}
              {session.difference_reason && (
                <p className="text-xs text-muted-foreground mt-2 italic border-t pt-2">
                  <span className="font-medium">Motivo:</span> {session.difference_reason}
                </p>
              )}
            </>
          )}
        </div>

        {/* Movimentações */}
        {movements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              Movimentações
              <Badge variant="outline" className="text-xs">{movements.length}</Badge>
            </h4>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {movements.map((mov) => (
                <div key={mov.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                  {getMovementIcon(mov.movement_type)}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{getMovementLabel(mov.movement_type)}</span>
                    {mov.payment_method && (
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {PAYMENT_METHOD_CONFIG[mov.payment_method]?.label || mov.payment_method}
                      </Badge>
                    )}
                    {mov.description && mov.movement_type !== "sale" && (
                      <span className="text-muted-foreground block truncate text-xs">{mov.description}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{formatTime(mov.created_at)}</span>
                  <span className={`font-medium ${
                    mov.movement_type === "withdrawal" ? "text-destructive" : 
                    mov.movement_type === "closing" ? "" : "text-success"
                  }`}>
                    {mov.movement_type === "withdrawal" ? "-" : mov.movement_type === "closing" ? "" : "+"}
                    {formatCurrency(mov.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {session.notes && (
          <div className="text-sm text-muted-foreground border-t pt-3">
            <span className="font-medium">Observações:</span> {session.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
