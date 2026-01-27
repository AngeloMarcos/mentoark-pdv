import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useSalesReport } from "@/hooks/useSales";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Package, Percent } from "lucide-react";
import { SummaryCardSkeleton, ListItemSkeleton } from "@/components/ui/skeletons";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { SummaryCards } from "@/components/reports/SummaryCards";
import { useDREReport, usePaymentMethodReport, ReportFilters as ReportFiltersType } from "@/hooks/useReports";
import { DRECard } from "@/components/reports/DRECard";
import { PaymentMethodChart } from "@/components/reports/PaymentMethodChart";
import { ExportColumn, formatCurrency } from "@/lib/export-utils";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro", cartao_credito: "Cartão Crédito", cartao_debito: "Cartão Débito", pix: "PIX", fiado: "Fiado",
};

const SalesReport = () => {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState("summary");

  const { data: report, isLoading } = useSalesReport(startDate, endDate);
  
  const filters: ReportFiltersType = { startDate, endDate };
  const { data: dreData, isLoading: loadingDRE } = useDREReport(filters);
  const { data: paymentData = [], isLoading: loadingPayment } = usePaymentMethodReport(filters);

  // Export columns for sales
  const salesColumns: ExportColumn[] = [
    { key: "date", label: "Data" },
    { key: "count", label: "Vendas", format: "number" },
    { key: "gross", label: "Bruto", format: "currency" },
    { key: "discount", label: "Desconto", format: "currency" },
    { key: "net", label: "Líquido", format: "currency" },
  ];

  const productColumns: ExportColumn[] = [
    { key: "product_name", label: "Produto" },
    { key: "quantity", label: "Quantidade", format: "number" },
    { key: "revenue", label: "Faturamento", format: "currency" },
  ];

  // Prepare export data
  const summaryExportData = report ? [{
    date: `${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`,
    count: report.count,
    gross: report.totalGross,
    discount: report.totalDiscount,
    net: report.totalNet,
  }] : [];

  const productExportData = report?.productRanking.map(p => ({
    product_name: p.product_name,
    quantity: p.quantity,
    revenue: p.revenue,
  })) || [];

  return (
    <AppLayout title="Relatório de Vendas">
      <div className="space-y-6 animate-fade-in">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <ReportFilters
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
              <ExportButtons
                data={summaryExportData}
                columns={salesColumns}
                pdfOptions={{
                  title: "Relatório de Vendas",
                  subtitle: `Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`,
                  summary: report ? [
                    { label: "Total Vendas", value: formatCurrency(report.totalNet) },
                    { label: "Ticket Médio", value: formatCurrency(report.count > 0 ? report.totalNet / report.count : 0) },
                  ] : undefined,
                }}
                filenamePrefix="relatorio-vendas"
                disabled={isLoading}
              />
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
          </div>
        ) : report ? (
          <>
            {/* Summary Cards with profit data */}
            {dreData && !loadingDRE ? (
              <SummaryCards
                totalRevenue={dreData.netRevenue}
                totalProfit={dreData.grossProfit}
                profitMargin={dreData.grossMargin}
                averageTicket={report.count > 0 ? report.totalNet / report.count : 0}
                saleCount={report.count}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="stat-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Vendas</CardTitle>
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(report.totalNet)}</div>
                    <p className="text-xs text-muted-foreground">{report.count} vendas</p>
                  </CardContent>
                </Card>
                <Card className="stat-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Bruto</CardTitle>
                    <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(report.totalGross)}</div>
                  </CardContent>
                </Card>
                <Card className="stat-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Descontos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">-{formatCurrency(report.totalDiscount)}</div>
                  </CardContent>
                </Card>
                <Card className="stat-card">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(report.count > 0 ? report.totalNet / report.count : 0)}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tabs for different views */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="summary">Resumo</TabsTrigger>
                <TabsTrigger value="products">Produtos</TabsTrigger>
                <TabsTrigger value="payments">Pagamentos</TabsTrigger>
                <TabsTrigger value="dre">DRE</TabsTrigger>
              </TabsList>

              {/* Summary Tab */}
              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Por Forma de Pagamento</CardTitle>
                  </CardHeader>
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
              </TabsContent>

              {/* Products Tab */}
              <TabsContent value="products" className="space-y-4">
                {report.productRanking.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        Produtos Mais Vendidos
                      </CardTitle>
                      <ExportButtons
                        data={productExportData}
                        columns={productColumns}
                        pdfOptions={{
                          title: "Produtos Mais Vendidos",
                          subtitle: `Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`,
                        }}
                        filenamePrefix="produtos-vendidos"
                        disabled={isLoading}
                      />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {report.productRanking.map((p, i) => (
                          <div key={p.product_id} className="flex items-center gap-4 py-2 border-b last:border-0">
                            <span className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center text-sm font-bold text-primary">{i + 1}</span>
                            <div className="flex-1">
                              <div className="font-medium">{p.product_name}</div>
                              <div className="text-sm text-muted-foreground">{p.quantity} unidades</div>
                            </div>
                            <span className="font-semibold">{formatCurrency(p.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="space-y-4">
                {loadingPayment ? (
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                          <ListItemSkeleton key={i} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <PaymentMethodChart data={paymentData} />
                )}
              </TabsContent>

              {/* DRE Tab */}
              <TabsContent value="dre" className="space-y-4">
                {loadingDRE || !dreData ? (
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-3">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <ListItemSkeleton key={i} />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <DRECard data={dreData} />
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
};

export default SalesReport;
