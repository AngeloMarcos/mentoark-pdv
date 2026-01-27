import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReportFilters } from "@/components/reports/ReportFilters";
import { ExportButtons } from "@/components/reports/ExportButtons";
import { SummaryCards } from "@/components/reports/SummaryCards";
import { ProfitMarginCard } from "@/components/reports/ProfitMarginCard";
import { DRECard } from "@/components/reports/DRECard";
import { CategoryChart } from "@/components/reports/CategoryChart";
import { PaymentMethodChart } from "@/components/reports/PaymentMethodChart";
import {
  useProductProfitReport,
  useProductRevenueReport,
  useCategoryReport,
  usePaymentMethodReport,
  useDREReport,
  useCategories,
  ReportFilters as ReportFiltersType,
} from "@/hooks/useReports";
import { ExportColumn } from "@/lib/export-utils";
import { FileBarChart, TrendingUp, Package, CreditCard, PieChart, BarChart3 } from "lucide-react";
import { SummaryCardSkeleton, ListItemSkeleton } from "@/components/ui/skeletons";

const Reports = () => {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("overview");

  const filters: ReportFiltersType = {
    startDate,
    endDate,
    category: selectedCategory,
    limit: 20,
  };

  const { data: categories = [] } = useCategories();
  const { data: profitData = [], isLoading: loadingProfit } = useProductProfitReport(filters);
  const { data: revenueData = [], isLoading: loadingRevenue } = useProductRevenueReport(filters);
  const { data: categoryData = [], isLoading: loadingCategory } = useCategoryReport(filters);
  const { data: paymentData = [], isLoading: loadingPayment } = usePaymentMethodReport(filters);
  const { data: dreData, isLoading: loadingDRE } = useDREReport(filters);

  // Calculate summary data
  const totalRevenue = profitData.reduce((sum, p) => sum + p.revenue, 0);
  const totalProfit = profitData.reduce((sum, p) => sum + p.gross_profit, 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const saleCount = profitData.length > 0 ? profitData.length : 0;
  const averageTicket = saleCount > 0 ? totalRevenue / saleCount : 0;

  // Export columns for product ranking
  const productColumns: ExportColumn[] = [
    { key: "product_name", label: "Produto" },
    { key: "category", label: "Categoria" },
    { key: "quantity_sold", label: "Qtd Vendida", format: "number" },
    { key: "revenue", label: "Faturamento", format: "currency" },
    { key: "cost", label: "Custo", format: "currency" },
    { key: "gross_profit", label: "Lucro", format: "currency" },
    { key: "profit_margin", label: "Margem %", format: "percent" },
  ];

  const categoryColumns: ExportColumn[] = [
    { key: "category", label: "Categoria" },
    { key: "product_count", label: "Produtos", format: "number" },
    { key: "quantity_sold", label: "Qtd Vendida", format: "number" },
    { key: "revenue", label: "Faturamento", format: "currency" },
    { key: "percentage", label: "% Total", format: "percent" },
  ];

  const isLoading = loadingProfit || loadingRevenue || loadingCategory || loadingPayment || loadingDRE;

  return (
    <AppLayout title="Central de Relatórios">
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
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                showCategoryFilter
              />
              <ExportButtons
                data={profitData}
                columns={productColumns}
                pdfOptions={{
                  title: "Relatório de Produtos",
                  subtitle: `Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`,
                }}
                filenamePrefix="relatorio-produtos"
                disabled={isLoading}
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <SummaryCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <SummaryCards
            totalRevenue={totalRevenue}
            totalProfit={totalProfit}
            profitMargin={profitMargin}
            averageTicket={averageTicket}
            saleCount={saleCount}
          />
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="margin" className="gap-2">
              <TrendingUp className="w-4 h-4" />
              Margem
            </TabsTrigger>
            <TabsTrigger value="categories" className="gap-2">
              <PieChart className="w-4 h-4" />
              Categorias
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <CreditCard className="w-4 h-4" />
              Pagamentos
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
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
              {loadingCategory ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="space-y-3">
                      {[1, 2, 3, 4].map((i) => (
                        <ListItemSkeleton key={i} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <CategoryChart data={categoryData} />
              )}
            </div>
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

          {/* Products Tab - Ranking by Revenue */}
          <TabsContent value="products" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Ranking de Produtos por Faturamento</CardTitle>
                  <CardDescription>Top produtos ordenados por receita total</CardDescription>
                </div>
                <ExportButtons
                  data={revenueData}
                  columns={productColumns}
                  pdfOptions={{
                    title: "Ranking de Produtos por Faturamento",
                    subtitle: `Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`,
                  }}
                  filenamePrefix="ranking-faturamento"
                  disabled={loadingRevenue}
                />
              </CardHeader>
              <CardContent>
                {loadingRevenue ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <ListItemSkeleton key={i} />
                    ))}
                  </div>
                ) : revenueData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma venda encontrada no período
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {revenueData.map((product, index) => (
                      <ProfitMarginCard
                        key={product.product_id}
                        rank={index + 1}
                        productName={product.product_name}
                        category={product.category}
                        revenue={product.revenue}
                        cost={product.cost}
                        profit={product.gross_profit}
                        margin={product.profit_margin}
                        quantity={product.quantity_sold}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Margin Tab - Ranking by Profit Margin */}
          <TabsContent value="margin" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Ranking de Produtos por Margem de Lucro</CardTitle>
                  <CardDescription>
                    Produtos ordenados pela margem percentual (lucro / receita)
                  </CardDescription>
                </div>
                <ExportButtons
                  data={profitData}
                  columns={productColumns}
                  pdfOptions={{
                    title: "Ranking de Produtos por Margem",
                    subtitle: `Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`,
                  }}
                  filenamePrefix="ranking-margem"
                  disabled={loadingProfit}
                />
              </CardHeader>
              <CardContent>
                {loadingProfit ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <ListItemSkeleton key={i} />
                    ))}
                  </div>
                ) : profitData.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma venda encontrada no período
                  </p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {profitData.map((product, index) => (
                      <ProfitMarginCard
                        key={product.product_id}
                        rank={index + 1}
                        productName={product.product_name}
                        category={product.category}
                        revenue={product.revenue}
                        cost={product.cost}
                        profit={product.gross_profit}
                        margin={product.profit_margin}
                        quantity={product.quantity_sold}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Análise por Categoria</CardTitle>
                  <CardDescription>Distribuição de vendas por categoria de produto</CardDescription>
                </div>
                <ExportButtons
                  data={categoryData}
                  columns={categoryColumns}
                  pdfOptions={{
                    title: "Vendas por Categoria",
                    subtitle: `Período: ${startDate.toLocaleDateString("pt-BR")} a ${endDate.toLocaleDateString("pt-BR")}`,
                  }}
                  filenamePrefix="vendas-categoria"
                  disabled={loadingCategory}
                />
              </CardHeader>
              <CardContent>
                {loadingCategory ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <ListItemSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <CategoryChart data={categoryData} />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Análise por Forma de Pagamento</CardTitle>
                <CardDescription>Distribuição de vendas por método de pagamento</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPayment ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <ListItemSkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <PaymentMethodChart data={paymentData} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Reports;
