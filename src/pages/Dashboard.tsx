import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodaySales } from "@/hooks/useSales";
import { useLowStockProducts } from "@/hooks/useProducts";
import { useSalesLast7Days, useRecentSales } from "@/hooks/useSalesChart";
import { 
  ShoppingBag, 
  DollarSign, 
  CreditCard, 
  Banknote, 
  QrCode, 
  AlertTriangle, 
  TrendingUp, 
  Clock,
  ArrowRight,
  Hash,
  Receipt
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

const PAYMENT_LABELS_SHORT: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao_credito: "Crédito",
  cartao_debito: "Débito",
  pix: "PIX",
  fiado: "Fiado",
};

const Dashboard = () => {
  const { data: todaySales, isLoading: salesLoading } = useTodaySales();
  const { data: lowStockProducts = [] } = useLowStockProducts();
  const { data: chartData = [] } = useSalesLast7Days();
  const { data: recentSales = [] } = useRecentSales();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const ticketMedio = todaySales?.count ? (todaySales.total / todaySales.count) : 0;

  return (
    <AppLayout title="Painel">
      <div className="space-y-6 animate-fade-in">
        {/* Hero Card - Nova Venda */}
        <Link to="/pdv">
          <Card className="hero-card hover:border-primary/50 transition-all duration-300 cursor-pointer group overflow-hidden">
            <CardContent className="p-6 lg:p-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 lg:w-20 lg:h-20 bg-primary/20 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <ShoppingBag className="w-8 h-8 lg:w-10 lg:h-10 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl lg:text-3xl font-bold text-foreground">Nova Venda</h2>
                  <p className="text-muted-foreground mt-1">Abrir ponto de venda agora</p>
                </div>
                <Button className="sale-button h-12 px-6 gap-2 hidden sm:flex">
                  Iniciar PDV
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* KPIs - Resumo de Hoje */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">Resumo de Hoje</h3>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {/* Faturamento */}
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Faturamento</span>
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {salesLoading ? "..." : formatCurrency(todaySales?.total || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total do dia</p>
            </div>

            {/* Número de Vendas */}
            <div className="kpi-card">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Nº de Vendas</span>
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-accent" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {salesLoading ? "..." : todaySales?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Vendas realizadas</p>
            </div>

            {/* Ticket Médio */}
            <div className="kpi-card sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Ticket Médio</span>
                <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-warning" />
                </div>
              </div>
              <div className="text-3xl font-bold text-foreground">
                {salesLoading ? "..." : formatCurrency(ticketMedio)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Valor por venda</p>
            </div>
          </div>
        </div>

        {/* Sales Chart */}
        <Card className="stat-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <TrendingUp className="w-5 h-5 text-primary" />
              Vendas - Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 lg:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 16%, 55%)', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 16%, 55%)', fontSize: 12 }}
                    tickFormatter={(value) => `R$${value}`}
                    width={60}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(222, 47%, 9%)',
                      border: '1px solid hsl(222, 47%, 16%)',
                      borderRadius: '8px',
                      color: 'hsl(210, 20%, 95%)',
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(24, 95%, 53%)"
                    strokeWidth={2}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Grid */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Sales */}
          <Card className="stat-card">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-medium">
                <Clock className="w-5 h-5 text-accent" />
                Vendas Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">Nenhuma venda recente</p>
              ) : (
                <div className="space-y-2">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                      <div>
                        <p className="font-semibold">{formatCurrency(sale.net_total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {PAYMENT_LABELS_SHORT[sale.payment_method] || sale.payment_method}
                        </p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(sale.datetime), "HH:mm")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          <Card className={lowStockProducts.length > 0 ? "border-warning/40 bg-warning/5" : "stat-card"}>
            <CardHeader className="pb-2">
              <CardTitle className={`flex items-center gap-2 text-base font-medium ${lowStockProducts.length > 0 ? "text-warning" : ""}`}>
                <AlertTriangle className="w-5 h-5" />
                Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-6 text-sm">Estoque adequado em todos os produtos</p>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div
                      key={product.id}
                      className="flex justify-between items-center py-2.5 px-3 rounded-lg bg-secondary/30"
                    >
                      <span className="font-medium truncate mr-2">{product.name}</span>
                      <span className="text-sm text-warning whitespace-nowrap">
                        {product.stock_current}/{product.min_stock}
                      </span>
                    </div>
                  ))}
                  {lowStockProducts.length > 5 && (
                    <Link to="/stock">
                      <Button variant="link" className="mt-1 p-0 h-auto text-warning">
                        Ver todos ({lowStockProducts.length})
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;