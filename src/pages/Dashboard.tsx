import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodaySales } from "@/hooks/useSales";
import { useLowStockProducts } from "@/hooks/useProducts";
import { useSalesLast7Days, useRecentSales } from "@/hooks/useSalesChart";
import { ShoppingCart, DollarSign, CreditCard, Banknote, QrCode, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

const PAYMENT_ICONS: Record<string, typeof CreditCard> = {
  dinheiro: Banknote,
  cartao_credito: CreditCard,
  cartao_debito: CreditCard,
  pix: QrCode,
};

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  pix: "PIX",
  fiado: "Fiado",
};

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

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6 animate-fade-in">
        {/* Quick Action */}
        <Link to="/pdv">
          <Card className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer stat-card">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-14 h-14 bg-primary-foreground/20 rounded-2xl flex items-center justify-center">
                <ShoppingCart className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Nova Venda</h2>
                <p className="text-primary-foreground/80">Iniciar ponto de venda</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Today Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="stat-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas Hoje
              </CardTitle>
              <DollarSign className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {salesLoading ? "..." : formatCurrency(todaySales?.total || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {todaySales?.count || 0} vendas realizadas
              </p>
            </CardContent>
          </Card>

          {Object.entries(todaySales?.byPaymentMethod || {}).map(([method, total]) => {
            const Icon = PAYMENT_ICONS[method] || DollarSign;
            return (
              <Card key={method} className="stat-card">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {PAYMENT_LABELS[method] || method}
                  </CardTitle>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(total)}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Sales Chart */}
        <Card className="stat-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Vendas - Últimos 7 Dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 50%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false}
                    tick={{ fill: 'hsl(215, 16%, 47%)', fontSize: 12 }}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(0, 0%, 100%)',
                      border: '1px solid hsl(215, 20%, 88%)',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCurrency(value), "Total"]}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(217, 91%, 50%)"
                    strokeWidth={2}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent Sales */}
          <Card className="stat-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Vendas Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentSales.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Nenhuma venda recente</p>
              ) : (
                <div className="space-y-3">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{formatCurrency(sale.net_total)}</p>
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
          <Card className={lowStockProducts.length > 0 ? "border-warning/50 bg-warning/5" : "stat-card"}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${lowStockProducts.length > 0 ? "text-warning" : ""}`}>
                <AlertTriangle className="w-5 h-5" />
                Produtos com Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lowStockProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">Todos os produtos estão com estoque adequado</p>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.slice(0, 5).map((product) => (
                    <div
                      key={product.id}
                      className="flex justify-between items-center py-2 border-b border-border last:border-0"
                    >
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground">
                        {product.stock_current} / {product.min_stock} {product.unit}
                      </span>
                    </div>
                  ))}
                  {lowStockProducts.length > 5 && (
                    <Link to="/stock">
                      <Button variant="link" className="mt-2 p-0">
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
