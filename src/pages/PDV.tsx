import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { useProducts, Product } from "@/hooks/useProducts";
import { useCreateSale, SaleItem } from "@/hooks/useSales";
import { useFindByBarcode } from "@/hooks/useBarcodes";
import { useBarcodeScanner } from "@/hooks/useBarcodeScanner";
import { useActiveSession } from "@/hooks/useCashRegister";
import { SalePayment } from "@/hooks/usePaymentMethods";
import { PaymentDialog } from "@/components/pdv/PaymentDialog";
import { EmployeeSelector } from "@/components/pdv/EmployeeSelector";
import { CustomerSelector } from "@/components/pdv/CustomerSelector";
import type { Customer } from "@/hooks/useCustomers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, Barcode, Printer, AlertCircle, DollarSign, Wallet, Tag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReceiptPreview } from "@/components/print/ReceiptPreview";
import { useTenant } from "@/contexts/TenantContext";
import { useCompany } from "@/contexts/CompanyContext";
import { ApplyPromotionDialog } from "@/components/promotions/ApplyPromotionDialog";
import { Promotion } from "@/hooks/usePromotions";
import { useFiscal } from "@/hooks/useFiscal";
import { DanfeViewer } from "@/components/fiscal/DanfeViewer";
import type { FiscalDocument } from "@/hooks/useFiscalDocuments";

interface CartItem extends SaleItem {
  product_name: string;
  promotion_id?: string | null;
  promotion_name?: string | null;
}

const PDV = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSale, setLastSale] = useState<{ id: string; netTotal: number; payments: SalePayment[] } | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [employee, setEmployee] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [promoTarget, setPromoTarget] = useState<CartItem | null>(null);
  const [emittingNfce, setEmittingNfce] = useState(false);
  const [nfceDoc, setNfceDoc] = useState<FiscalDocument | null>(null);
  const [nfceItems, setNfceItems] = useState<Array<{ product_name: string; quantity: number; unit_price: number; total: number }>>([]);

  const { currentTenant } = useTenant();
  const { hasFeature } = useCompany();
  const { data: products = [] } = useProducts(search);
  const createSale = useCreateSale();
  const findByBarcode = useFindByBarcode();
  const { data: activeSession, isLoading: sessionLoading } = useActiveSession();
  const { emitNfce } = useFiscal();

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const addToCart = useCallback((product: Product) => {
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
  }, []);

  // Handler para busca por código de barras (Alta Performance)
  const handleBarcodeSearch = useCallback(async (barcode: string) => {
    // 1. Busca Local Instantânea no Cache
    const cachedProducts = queryClient.getQueryData<Product[]>(["products", "list", currentTenant?.id]) || [];
    const localProduct = cachedProducts.find(
      (p) => p.barcode === barcode || p.internal_code === barcode
    );

    if (localProduct) {
      addToCart(localProduct);
      toast.success(`${localProduct.name} adicionado`);
      return;
    }

    // 2. Busca de Contingência no Banco (Produto recém-criado ou não carregado)
    try {
      const product = await findByBarcode.mutateAsync(barcode);
      if (product) {
        addToCart(product as Product);
        toast.success(`${(product as Product).name} adicionado`);
      } else {
        toast.error("Produto não encontrado");
      }
    } catch {
      toast.error("Erro ao buscar produto");
    }
  }, [findByBarcode, addToCart, queryClient, currentTenant?.id]);

  // Global barcode scanner — detecta leitura rápida (<50ms entre teclas)
  // ignoreInputs=false porque o foco fica no input de busca
  useBarcodeScanner((code) => handleBarcodeSearch(code), { minLength: 4, ignoreInputs: false });

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F2 - Abrir pagamento
      if (e.key === "F2" && cart.length > 0 && !createSale.isPending) {
        e.preventDefault();
        if (!activeSession) {
          toast.error("Abra o caixa antes de realizar vendas");
          return;
        }
        setShowPaymentDialog(true);
      }
      // F3 - Limpar carrinho
      if (e.key === "F3") {
        e.preventDefault();
        setCart([]);
        searchRef.current?.focus();
      }
      // F4 - Focar busca
      if (e.key === "F4") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // Escape - Limpar busca ou fechar dialog
      if (e.key === "Escape") {
        if (showPaymentDialog) {
          setShowPaymentDialog(false);
        } else {
          setSearch("");
          searchRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, createSale.isPending, activeSession, showPaymentDialog]);

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

  const handlePaymentConfirm = async (payments: SalePayment[]) => {
    if (cart.length === 0) {
      toast.error("Adicione produtos ao carrinho");
      return;
    }

    if (!activeSession) {
      toast.error("Abra o caixa antes de realizar vendas");
      return;
    }

    const sale = await createSale.mutateAsync({
      items: cart,
      payments,
      customer_id: customer?.id ?? null,
      session_id: activeSession.id,
    });

    setLastSale({ id: sale.id, netTotal, payments });
    setShowPaymentDialog(false);

    // Auto NFC-e emission if enabled in tenant settings
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: t } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", currentTenant?.id || "")
        .maybeSingle();
      const fiscal = ((t?.settings as Record<string, unknown>)?.fiscal || {}) as { emite_nfce?: boolean };
      if (fiscal.emite_nfce) {
        setEmittingNfce(true);
        try {
          const doc = await emitNfce.mutateAsync(sale.id);
          setNfceDoc(doc as unknown as FiscalDocument);
          setNfceItems(
            cart.map((c) => ({
              product_name: c.product_name,
              quantity: c.quantity,
              unit_price: c.unit_price,
              total: c.total,
            }))
          );
          toast.success("NFC-e emitida!");
        } finally {
          setEmittingNfce(false);
        }
      }
    } catch {
      // already toasted by useFiscal
    }

    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setCart([]); setCustomer(null);
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
            <p className="text-muted-foreground mb-4">{formatCurrency(netTotal)}</p>
            {lastSale && (
              <div className="space-y-2">
                <div className="flex flex-wrap justify-center gap-1">
                  {lastSale.payments.map((p, i) => (
                    <Badge key={i} variant="secondary">
                      {p.payment_method_code}: {formatCurrency(p.amount)}
                    </Badge>
                  ))}
                </div>
                <Button variant="outline" onClick={() => setShowReceipt(true)}>
                  <Printer className="mr-2 h-4 w-4" />
                  Imprimir Cupom
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Dialog de impressão do cupom */}
        <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cupom da Venda</DialogTitle>
            </DialogHeader>
            {lastSale && (
              <ReceiptPreview
                data={{
                  saleId: lastSale.id,
                  datetime: new Date(),
                  items: cart,
                  grossTotal,
                  discountTotal,
                  netTotal: lastSale.netTotal,
                  paymentMethod: lastSale.payments.map(p => p.payment_method_code).join(", "),
                  tenantName: currentTenant?.name || "Loja",
                  tenantDocument: currentTenant?.document || undefined,
                  tenantPhone: currentTenant?.phone || undefined,
                }}
                onPrint={() => setShowReceipt(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="PDV">
      <div className="grid lg:grid-cols-[1fr,400px] gap-4 h-[calc(100vh-8rem)]">
        {/* Left: Search & Products */}
        <div className="flex flex-col gap-4 min-h-0">
          {/* Session indicator */}
          {activeSession && (
            <div className="flex items-center gap-2 p-2 bg-success/10 rounded-lg text-sm">
              <Wallet className="w-4 h-4 text-success" />
              <span>Caixa aberto: <strong>{activeSession.register?.name}</strong></span>
              <span className="ml-auto text-muted-foreground">
                Saldo inicial: {formatCurrency(activeSession.opening_balance)}
              </span>
            </div>
          )}

          {/* Employee selector */}
          {hasFeature('employee_selection') && (
            <EmployeeSelector employee={employee} onSelect={setEmployee} />
          )}

          {/* Customer selector */}
          <CustomerSelector customer={customer} onSelect={setCustomer} />


          {/* Cash register warning */}
          {!sessionLoading && !activeSession && (
            <Alert variant="destructive" className="mb-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Nenhum caixa aberto. Abra o caixa para realizar vendas.</span>
                <Button variant="outline" size="sm" onClick={() => navigate("/cash-register")}>
                  Abrir Caixa
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              ref={searchRef} 
              placeholder="Buscar produto ou ler código de barras... (F4)" 
              className="pl-10 pr-10 h-12 text-lg" 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              autoFocus 
            />
            <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>

          {/* Atalhos de teclado */}
          <div className="flex gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-muted rounded">F2 Pagamento</span>
            <span className="px-2 py-1 bg-muted rounded">F3 Limpar</span>
            <span className="px-2 py-1 bg-muted rounded">F4 Buscar</span>
            <span className="px-2 py-1 bg-muted rounded">ESC Fechar</span>
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
                <p className="text-lg">Digite o nome ou leia o código de barras</p>
                <p className="text-sm mt-2">Use um leitor de código de barras para busca rápida</p>
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
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Carrinho vazio</p>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} className="pdv-item flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">{formatCurrency(item.unit_price)} × {item.quantity}</div>
                      {item.promotion_name && (
                        <Badge className="mt-1 gap-1 text-[10px]">
                          <Tag className="w-3 h-3" /> {item.promotion_name} (-{formatCurrency(item.discount)})
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product_id, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => updateQuantity(item.product_id, 1)}><Plus className="w-3 h-3" /></Button>
                    </div>
                    <div className="font-semibold w-20 text-right">{formatCurrency(item.total)}</div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Aplicar promoção"
                      onClick={() => setPromoTarget(item)}
                    >
                      <Tag className={`w-4 h-4 ${item.promotion_id ? "text-primary" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFromCart(item.product_id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))
              )}
            </div>

            {/* Summary & Payment */}
            <div className="border-t pt-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{formatCurrency(grossTotal)}</span></div>
                {discountTotal > 0 && <div className="flex justify-between text-sm text-success"><span>Descontos</span><span>-{formatCurrency(discountTotal)}</span></div>}
                <div className="flex justify-between text-xl font-bold"><span>Total</span><span>{formatCurrency(netTotal)}</span></div>
              </div>

              <Button
                className="w-full h-14 text-lg touch-target sale-button"
                disabled={cart.length === 0 || createSale.isPending || !activeSession}
                onClick={() => setShowPaymentDialog(true)}
              >
                <DollarSign className="mr-2 h-5 w-5" />
                {createSale.isPending ? "Finalizando..." : "Pagamento (F2)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPaymentDialog}
        onOpenChange={setShowPaymentDialog}
        total={netTotal}
        onConfirm={handlePaymentConfirm}
        isProcessing={createSale.isPending}
        hasCustomer={!!customer}
      />

      {/* Apply Promotion Dialog */}
      {promoTarget && (
        <ApplyPromotionDialog
          open={!!promoTarget}
          onOpenChange={(o) => !o && setPromoTarget(null)}
          productId={promoTarget.product_id}
          productName={promoTarget.product_name}
          unitPrice={promoTarget.unit_price}
          quantity={promoTarget.quantity}
          hasDiscount={!!promoTarget.promotion_id}
          onApply={(promo: Promotion, discountAmount: number) => {
            setCart((prev) =>
              prev.map((it) =>
                it.product_id === promoTarget.product_id
                  ? {
                      ...it,
                      discount: discountAmount,
                      total: it.unit_price * it.quantity - discountAmount,
                      promotion_id: promo.id,
                      promotion_name: promo.name,
                    }
                  : it,
              ),
            );
            toast.success(`Promoção "${promo.name}" aplicada`);
          }}
          onClear={() => {
            setCart((prev) =>
              prev.map((it) =>
                it.product_id === promoTarget.product_id
                  ? {
                      ...it,
                      discount: 0,
                      total: it.unit_price * it.quantity,
                      promotion_id: null,
                      promotion_name: null,
                    }
                  : it,
              ),
            );
            toast.success("Desconto removido");
          }}
        />
      )}

      {/* NFC-e emitting overlay */}
      {emittingNfce && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 p-6 rounded-lg border bg-card shadow-lg">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="font-medium">Emitindo NFC-e...</p>
            <p className="text-xs text-muted-foreground">Não feche a janela</p>
          </div>
        </div>
      )}

      {/* DANFE viewer for emitted NFC-e */}
      <DanfeViewer
        document={nfceDoc}
        open={!!nfceDoc}
        onOpenChange={(o) => !o && setNfceDoc(null)}
        items={nfceItems}
        paymentLabel={lastSale?.payments.map((p) => p.payment_method_code).join(", ")}
      />
    </AppLayout>
  );
};

export default PDV;
