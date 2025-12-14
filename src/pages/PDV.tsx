import { useState, useRef, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProducts, Product } from "@/hooks/useProducts";
import { useCreateSale, SaleItem } from "@/hooks/useSales";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Minus, Trash2, ShoppingCart, Check } from "lucide-react";
import { toast } from "sonner";

interface CartItem extends SaleItem {
  product_name: string;
}

const PAYMENT_METHODS = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "pix", label: "PIX" },
  { value: "fiado", label: "Fiado" },
];

const PDV = () => {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("dinheiro");
  const [showSuccess, setShowSuccess] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { data: products = [] } = useProducts(search);
  const createSale = useCreateSale();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unit_price - item.discount }
            : item
        );
      }
      return [...prev, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: product.sale_price,
        discount: 0,
        total: product.sale_price,
      }];
    });
    setSearch("");
    searchRef.current?.focus();
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.product_id === productId) {
          const newQty = Math.max(0, item.quantity + delta);
          if (newQty === 0) return item;
          return { ...item, quantity: newQty, total: newQty * item.unit_price - item.discount };
        }
        return item;
      }).filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const grossTotal = cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const discountTotal = cart.reduce((sum, item) => sum + item.discount, 0);
  const netTotal = grossTotal - discountTotal;

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast.error("Adicione produtos ao carrinho");
      return;
    }

    await createSale.mutateAsync({
      items: cart,
      payment_method: paymentMethod,
    });

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setCart([]);
      setPaymentMethod("dinheiro");
      searchRef.current?.focus();
    }, 1500);
  };

  if (showSuccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
          <Card className="w-full max-w-sm text-center p-8 animate-success-glow border-success">
            <div className="w-20 h-20 bg-success rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-success-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-success mb-2">Venda Finalizada!</h2>
            <p className="text-muted-foreground">{formatCurrency(netTotal)}</p>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="PDV">
      <div className="grid lg:grid-cols-[1fr,400px] gap-4 h-[calc(100vh-8rem)]">
        {/* Left: Search & Products */}
        <div className="flex flex-col gap-4 min-h-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input ref={searchRef} placeholder="Buscar produto (nome, código ou código de barras)..." className="pl-10 h-12 text-lg" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
          </div>

          {search && products.length > 0 && (
            <Card className="flex-1 overflow-auto">
              <CardContent className="p-2 space-y-1">
                {products.slice(0, 10).map((product) => (
                  <button
                    key={product.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors text-left touch-target"
                    onClick={() => addToCart(product)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{product.name}</div>
                      <div className="text-sm text-muted-foreground">{product.internal_code || product.barcode || ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(product.sale_price)}</div>
                      <div className="text-xs text-muted-foreground">Est: {product.stock_current}</div>
                    </div>
                    <Plus className="w-5 h-5 text-primary" />
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {!search && cart.length === 0 && (
            <Card className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground p-8">
                <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg">Digite o nome ou código do produto para começar</p>
              </div>
            </Card>
          )}
        </div>

        {/* Right: Cart & Summary */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Carrinho ({cart.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col min-h-0 gap-4">
            {/* Cart Items */}
            <div className="flex-1 overflow-auto space-y-2">
              {cart.map((item) => (
                <div key={item.product_id} className="pdv-item">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.product_name}</div>
                    <div className="text-sm text-muted-foreground">{formatCurrency(item.unit_price)} × {item.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product_id, -1)}><Minus className="w-3 h-3" /></Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product_id, 1)}><Plus className="w-3 h-3" /></Button>
                  </div>
                  <div className="font-semibold w-20 text-right">{formatCurrency(item.total)}</div>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.product_id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              ))}
            </div>

            {/* Summary & Payment */}
            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(grossTotal)}</span></div>
                {discountTotal > 0 && <div className="flex justify-between text-sm text-success"><span>Descontos</span><span>-{formatCurrency(discountTotal)}</span></div>}
                <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{formatCurrency(netTotal)}</span></div>
              </div>

              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                </SelectContent>
              </Select>

              <Button className="w-full h-14 text-lg touch-target" disabled={cart.length === 0 || createSale.isPending} onClick={handleFinalizeSale}>
                {createSale.isPending ? "Finalizando..." : "Finalizar Venda"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default PDV;
