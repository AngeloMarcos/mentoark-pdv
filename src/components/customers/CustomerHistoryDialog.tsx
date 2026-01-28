import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCustomerPurchaseHistory, CustomerSale } from "@/hooks/useCustomerPurchaseHistory";
import { useCustomerPoints, useLoyaltySettings, calculatePointsValue } from "@/hooks/useLoyalty";
import { PointsBalance } from "@/components/loyalty/PointsBalance";
import { PointsHistoryDialog } from "@/components/loyalty/PointsHistoryDialog";
import { RedeemPointsDialog } from "@/components/loyalty/RedeemPointsDialog";
import { AddManualPointsDialog } from "@/components/loyalty/AddManualPointsDialog";
import { DollarSign, ShoppingCart, TrendingUp, Calendar, Package, Gift, Plus } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

interface CustomerHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: {
    id: string;
    name: string;
  } | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getPaymentMethodLabel = (method: string) => {
  const labels: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao_credito: "Cartão Crédito",
    cartao_debito: "Cartão Débito",
  };
  return labels[method] || method;
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  subValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue?: string;
}) => (
  <Card className="bg-muted/50">
    <CardContent className="p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold truncate">{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground truncate">{subValue}</p>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const SaleItemRow = ({ item }: { item: CustomerSale["sale_items"][0] }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <div className="flex items-center gap-2 min-w-0 flex-1">
      <Package className="w-3 h-3 text-muted-foreground shrink-0" />
      <span className="text-sm truncate">
        {item.quantity}x {item.products?.name || "Produto removido"}
      </span>
    </div>
    <span className="text-sm font-medium shrink-0 ml-2">
      {formatCurrency(item.total)}
    </span>
  </div>
);

export function CustomerHistoryDialog({
  open,
  onOpenChange,
  customer,
}: CustomerHistoryDialogProps) {
  const { data, isLoading } = useCustomerPurchaseHistory(customer?.id || null);
  const { sales = [], stats } = data || {};
  const { data: settings } = useLoyaltySettings();
  const { currentTenant } = useTenant();

  const [showPointsHistory, setShowPointsHistory] = useState(false);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [showAddPointsDialog, setShowAddPointsDialog] = useState(false);

  const loyaltyEnabled = settings?.loyalty_enabled || false;
  const isAdmin = currentTenant?.role === "admin";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Histórico do Cliente
              {customer && (
                <span className="text-muted-foreground font-normal">
                  — {customer.name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
              <Skeleton className="h-32" />
            </div>
          ) : (
            <Tabs defaultValue="purchases" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="purchases">
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Compras
                </TabsTrigger>
                <TabsTrigger value="loyalty" disabled={!loyaltyEnabled}>
                  <Gift className="w-4 h-4 mr-2" />
                  Fidelidade
                </TabsTrigger>
              </TabsList>

              {/* Aba Compras */}
              <TabsContent value="purchases" className="flex-1 flex flex-col min-h-0 mt-4">
                {/* Stats Cards */}
                {stats && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <StatCard
                      icon={DollarSign}
                      label="Total Gasto"
                      value={formatCurrency(stats.totalSpent)}
                    />
                    <StatCard
                      icon={ShoppingCart}
                      label="Compras"
                      value={stats.purchaseCount.toString()}
                    />
                    <StatCard
                      icon={TrendingUp}
                      label="Ticket Médio"
                      value={formatCurrency(stats.averageTicket)}
                    />
                    <StatCard
                      icon={Calendar}
                      label="Última Compra"
                      value={
                        stats.lastPurchase
                          ? format(new Date(stats.lastPurchase), "dd/MM/yyyy", { locale: ptBR })
                          : "—"
                      }
                      subValue={
                        stats.lastPurchase
                          ? format(new Date(stats.lastPurchase), "HH:mm", { locale: ptBR })
                          : undefined
                      }
                    />
                  </div>
                )}

                {/* Sales List */}
                <ScrollArea className="flex-1 -mx-6 px-6">
                  {sales.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhuma compra registrada</p>
                    </div>
                  ) : (
                    <Accordion type="single" collapsible className="space-y-2">
                      {sales.map((sale) => (
                        <AccordionItem
                          key={sale.id}
                          value={sale.id}
                          className="border rounded-lg px-4 bg-card"
                        >
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <div className="text-left">
                                  <p className="font-medium">
                                    {format(new Date(sale.datetime), "dd/MM/yyyy", { locale: ptBR })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(sale.datetime), "HH:mm", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="shrink-0">
                                  {getPaymentMethodLabel(sale.payment_method)}
                                </Badge>
                                <span className="font-semibold text-primary shrink-0">
                                  {formatCurrency(sale.net_total)}
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="pt-2 border-t">
                              {sale.sale_items.map((item, idx) => (
                                <SaleItemRow key={idx} item={item} />
                              ))}
                              {sale.discount_total && sale.discount_total > 0 && (
                                <div className="flex justify-between pt-2 text-sm text-green-600">
                                  <span>Desconto</span>
                                  <span>-{formatCurrency(sale.discount_total)}</span>
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Aba Fidelidade */}
              <TabsContent value="loyalty" className="flex-1 flex flex-col min-h-0 mt-4 space-y-4">
                {customer && (
                  <>
                    <PointsBalance
                      customerId={customer.id}
                      onViewHistory={() => setShowPointsHistory(true)}
                      onRedeem={() => setShowRedeemDialog(true)}
                    />

                    {isAdmin && (
                      <Button
                        variant="outline"
                        onClick={() => setShowAddPointsDialog(true)}
                        className="w-full"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Ajustar Pontos Manualmente
                      </Button>
                    )}
                  </>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialogs de pontos */}
      <PointsHistoryDialog
        open={showPointsHistory}
        onOpenChange={setShowPointsHistory}
        customerId={customer?.id || null}
        customerName={customer?.name}
      />

      <RedeemPointsDialog
        open={showRedeemDialog}
        onOpenChange={setShowRedeemDialog}
        customerId={customer?.id || null}
        customerName={customer?.name}
      />

      <AddManualPointsDialog
        open={showAddPointsDialog}
        onOpenChange={setShowAddPointsDialog}
        customerId={customer?.id || null}
        customerName={customer?.name}
      />
    </>
  );
}
