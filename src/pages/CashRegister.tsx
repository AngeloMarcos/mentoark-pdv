import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  useActiveSession, 
  useCashSessions, 
  CashSession, 
  CashRegister as CashRegisterType,
  useSessionSummary 
} from "@/hooks/useCashRegister";
import { OpenCashDialog } from "@/components/cash/OpenCashDialog";
import { CloseCashDialog } from "@/components/cash/CloseCashDialog";
import { CashMovementDialog } from "@/components/cash/CashMovementDialog";
import { CashSessionSummary } from "@/components/cash/CashSessionSummary";
import { 
  DollarSign, 
  Lock, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Clock,
  CheckCircle,
  ShoppingCart
} from "lucide-react";

const CashRegister = () => {
  const [openDialog, setOpenDialog] = useState<"open" | "close" | "movement" | "history" | null>(null);
  const [selectedSession, setSelectedSession] = useState<(CashSession & { register: CashRegisterType }) | null>(null);

  const { data: activeSession, isLoading: loadingActive } = useActiveSession();
  const { data: sessions = [], isLoading: loadingHistory } = useCashSessions(50);
  const summary = useSessionSummary(activeSession?.id);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const expectedBalance = activeSession 
    ? activeSession.opening_balance + summary.totalSales + summary.totalSupply - summary.totalWithdrawal
    : 0;

  return (
    <AppLayout title="Caixa">
      <div className="space-y-6 animate-fade-in">
        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Caixa Atual
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-4">
            {loadingActive ? (
              <Card>
                <CardContent className="py-8">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3" />
                    <div className="h-24 bg-muted rounded" />
                  </div>
                </CardContent>
              </Card>
            ) : activeSession ? (
              <>
                {/* Caixa ativo */}
                <Card className="border-primary">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-success rounded-full animate-pulse" />
                        Caixa Aberto
                      </CardTitle>
                      <Badge variant="outline">{activeSession.register.name}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Aberto em {formatDateTime(activeSession.opened_at)}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Fundo Inicial</p>
                        <p className="text-lg font-bold">{formatCurrency(activeSession.opening_balance)}</p>
                      </div>
                      <div className="p-4 bg-success/10 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Vendas</p>
                        <p className="text-lg font-bold text-success">{formatCurrency(summary.totalSales)}</p>
                        <p className="text-xs text-muted-foreground">{summary.salesCount} vendas</p>
                      </div>
                      <div className="p-4 bg-primary/10 rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Saldo Esperado</p>
                        <p className="text-lg font-bold">{formatCurrency(expectedBalance)}</p>
                      </div>
                      <div className="p-4 bg-muted rounded-lg text-center">
                        <p className="text-xs text-muted-foreground">Mov. Caixa</p>
                        <p className="text-lg font-bold">
                          <span className="text-success">+{formatCurrency(summary.totalSupply)}</span>
                          {" / "}
                          <span className="text-destructive">-{formatCurrency(summary.totalWithdrawal)}</span>
                        </p>
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <Button variant="outline" onClick={() => setOpenDialog("movement")} className="flex items-center gap-2">
                        <ArrowDownCircle className="w-4 h-4 text-success" />
                        Suprimento
                      </Button>
                      <Button variant="outline" onClick={() => setOpenDialog("movement")} className="flex items-center gap-2">
                        <ArrowUpCircle className="w-4 h-4 text-destructive" />
                        Sangria
                      </Button>
                      <Button variant="destructive" onClick={() => setOpenDialog("close")} className="md:col-span-1 col-span-2">
                        <Lock className="w-4 h-4 mr-2" />
                        Fechar Caixa
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Resumo detalhado */}
                <CashSessionSummary session={activeSession} />
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <DollarSign className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Nenhum caixa aberto</h3>
                  <p className="text-muted-foreground mb-4">
                    Abra o caixa para começar a registrar vendas
                  </p>
                  <Button onClick={() => setOpenDialog("open")}>
                    <DollarSign className="w-4 h-4 mr-2" />
                    Abrir Caixa
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            {loadingHistory ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <div className="animate-pulse h-20 bg-muted rounded" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum histórico de caixa
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Card 
                    key={session.id} 
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => {
                      setSelectedSession(session);
                      setOpenDialog("history");
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          session.status === "open" ? "bg-success/20" : "bg-muted"
                        }`}>
                          {session.status === "open" ? (
                            <DollarSign className="w-5 h-5 text-success" />
                          ) : (
                            <CheckCircle className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{session.register.name}</h4>
                            <Badge variant={session.status === "open" ? "default" : "secondary"}>
                              {session.status === "open" ? "Aberto" : "Fechado"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(session.opened_at)}
                            {session.closed_at && ` - ${formatDateTime(session.closed_at)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          {session.closing_balance !== null ? (
                            <>
                              <p className="font-semibold">{formatCurrency(session.closing_balance)}</p>
                              {session.difference !== null && Math.abs(session.difference) >= 0.01 && (
                                <p className={`text-xs ${session.difference > 0 ? "text-success" : "text-destructive"}`}>
                                  {session.difference > 0 ? "+" : ""}{formatCurrency(session.difference)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="font-semibold">{formatCurrency(session.opening_balance)}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialogs */}
        <Dialog open={openDialog === "open"} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Abrir Caixa</DialogTitle>
            </DialogHeader>
            <OpenCashDialog onSuccess={() => setOpenDialog(null)} />
          </DialogContent>
        </Dialog>

        <Dialog open={openDialog === "close"} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Fechar Caixa</DialogTitle>
            </DialogHeader>
            {activeSession && (
              <CloseCashDialog session={activeSession} onSuccess={() => setOpenDialog(null)} />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={openDialog === "movement"} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Movimentação de Caixa</DialogTitle>
            </DialogHeader>
            {activeSession && (
              <CashMovementDialog sessionId={activeSession.id} onSuccess={() => setOpenDialog(null)} />
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={openDialog === "history"} onOpenChange={() => setOpenDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes da Sessão</DialogTitle>
            </DialogHeader>
            {selectedSession && <CashSessionSummary session={selectedSession} />}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default CashRegister;
