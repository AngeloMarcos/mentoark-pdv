import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSalesReport } from "@/hooks/useSales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, DollarSign, TrendingUp, Package } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SummaryCardSkeleton, ListItemSkeleton } from "@/components/ui/skeletons";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito", pix: "PIX", fiado: "Fiado",
};

const SalesReport = () => {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());

  const { data: report, isLoading } = useSalesReport(startDate, endDate);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <AppLayout title="Relatório de Vendas">
      <div className="space-y-6 animate-fade-in">
        {/* Date Filters */}
        <Card>
          <CardContent className="flex flex-wrap gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">De:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40"><CalendarIcon className="w-4 h-4 mr-2" />{format(startDate, "dd/MM/yyyy")}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} locale={ptBR} /></PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Até:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-40"><CalendarIcon className="w-4 h-4 mr-2" />{format(endDate, "dd/MM/yyyy")}</Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} locale={ptBR} /></PopoverContent>
              </Popover>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <SummaryCardSkeleton key={i} />
              ))}
            </div>
            <Card>
              <CardHeader><CardTitle>Por Forma de Pagamento</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <ListItemSkeleton key={i} />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : report ? (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Vendas</CardTitle><DollarSign className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(report.totalNet)}</div><p className="text-xs text-muted-foreground">{report.count} vendas</p></CardContent></Card>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Bruto</CardTitle><TrendingUp className="w-4 h-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(report.totalGross)}</div></CardContent></Card>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Descontos</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">-{formatCurrency(report.totalDiscount)}</div></CardContent></Card>
              <Card className="stat-card"><CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(report.count > 0 ? report.totalNet / report.count : 0)}</div></CardContent></Card>
            </div>

            {/* By Payment Method */}
            <Card>
              <CardHeader><CardTitle>Por Forma de Pagamento</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(report.byPaymentMethod).map(([method, value]) => (
                    <div key={method} className="flex justify-between items-center py-2 border-b last:border-0">
                      <span className="font-medium">{PAYMENT_LABELS[method] || method}</span>
                      <span className="font-semibold">{formatCurrency(value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Products */}
            {report.productRanking.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5" />Produtos Mais Vendidos</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {report.productRanking.map((p, i) => (
                      <div key={p.product_id} className="flex items-center gap-4 py-2 border-b last:border-0">
                        <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">{i + 1}</span>
                        <div className="flex-1"><div className="font-medium">{p.product_name}</div><div className="text-sm text-muted-foreground">{p.quantity} unidades</div></div>
                        <span className="font-semibold">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </AppLayout>
  );
};

export default SalesReport;
