import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTodaySales } from "@/hooks/useSales";
import { useLowStockProducts } from "@/hooks/useProducts";
import { ShoppingCart, DollarSign, CreditCard, Banknote, QrCode, AlertTriangle } from "lucide-react";

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

const Dashboard = () => {
  const { data: todaySales, isLoading: salesLoading } = useTodaySales();
  const { data: lowStockProducts = [] } = useLowStockProducts();

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

        {/* Low Stock Alert */}
        {lowStockProducts.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-warning">
                <AlertTriangle className="w-5 h-5" />
                Produtos com Estoque Baixo
              </CardTitle>
            </CardHeader>
            <CardContent>
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
              </div>
              {lowStockProducts.length > 5 && (
                <Link to="/stock">
                  <Button variant="link" className="mt-2 p-0">
                    Ver todos ({lowStockProducts.length})
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Dashboard;
