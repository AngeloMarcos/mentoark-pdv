import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  Clock,
  Receipt,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import { useTab, useTabItems, useAddTabItem, useRemoveTabItem, useCloseTab, useCancelTab } from '@/hooks/useTabs';
import { CloseTabDialog } from '@/components/restaurant/CloseTabDialog';
import { useTabBill } from '@/hooks/useTabBilling';
import { useProducts, type Product } from '@/hooks/useProducts';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PAYMENT_METHODS = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
];

const TabOrder = () => {
  const { tabId } = useParams<{ tabId: string }>();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('dinheiro');
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);

  const { data: tab, isLoading: tabLoading } = useTab(tabId);
  const { data: tabItems = [], isLoading: itemsLoading } = useTabItems(tabId);
  const { data: products = [] } = useProducts();
  const { data: bill } = useTabBill(tabId);
  const addItem = useAddTabItem();
  const removeItem = useRemoveTabItem();
  const closeTab = useCloseTab();
  const cancelTab = useCancelTab();

  const filteredProducts = useMemo(() => {
    if (!search) return products;
    const term = search.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        p.internal_code?.toLowerCase().includes(term) ||
        p.barcode?.includes(term)
    );
  }, [products, search]);

  const totals = useMemo(() => {
    return tabItems.reduce(
      (acc, item) => ({
        gross: acc.gross + item.total + (item.discount || 0),
        discount: acc.discount + (item.discount || 0),
        net: acc.net + item.total,
      }),
      { gross: 0, discount: 0, net: 0 }
    );
  }, [tabItems]);

  const handleAddItem = async () => {
    if (!selectedProduct || !tabId) return;
    await addItem.mutateAsync({
      tab_id: tabId,
      product_id: selectedProduct.id,
      quantity,
      unit_price: selectedProduct.sale_price,
      notes: notes || undefined,
    });
    setSelectedProduct(null);
    setQuantity(1);
    setNotes('');
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!tabId) return;
    await removeItem.mutateAsync({ itemId, tabId });
  };

  const handleCloseTab = async () => {
    if (!tab || !tabId) return;

    await closeTab.mutateAsync({
      tabId,
      tableId: tab.table_id,
      paymentMethod,
      items: tabItems,
    });

    navigate('/tables');
  };

  const handleCancelTab = async () => {
    if (!tab || !tabId) return;
    if (!confirm('Tem certeza que deseja cancelar esta comanda? Os itens não serão cobrados.')) return;

    await cancelTab.mutateAsync({
      tabId,
      tableId: tab.table_id,
    });

    navigate('/tables');
  };

  if (tabLoading || itemsLoading) {
    return (
      <AppLayout title="">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-10 h-10 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-5 w-16" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!tab) {
    return (
      <AppLayout title="Comanda não encontrada">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">Comanda não encontrada ou sem permissão</p>
          <Button onClick={() => navigate('/tables')}>Voltar para Mesas</Button>
        </div>
      </AppLayout>
    );
  }

  const title = tab.table ? `Mesa ${tab.table.number}` : tab.customer_name || `Comanda #${tab.id.slice(0, 6)}`;

  return (
    <AppLayout title={title}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tables')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{title}</h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Aberta há{' '}
                  {formatDistanceToNow(new Date(tab.opened_at), { locale: ptBR })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="destructive" size="sm" onClick={handleCancelTab}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={() => setIsCloseDialogOpen(true)}
              disabled={(bill?.lines.length ?? 0) === 0}
            >
              <Receipt className="h-4 w-4 mr-2" />
              Fechar Conta
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Product Search */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Adicionar Itens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              {selectedProduct ? (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{selectedProduct.name}</p>
                      <p className="text-lg font-bold text-primary">
                        R$ {selectedProduct.sale_price.toFixed(2)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedProduct(null)}
                    >
                      <XCircle className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4" />
                      <span>Observação (opcional)</span>
                    </div>
                    <Textarea
                      placeholder="Ex: Sem cebola, bem passado..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t">
                    <p className="text-lg font-bold">
                      Total: R$ {(selectedProduct.sale_price * quantity).toFixed(2)}
                    </p>
                    <Button onClick={handleAddItem} disabled={addItem.isPending}>
                      <Plus className="h-4 w-4 mr-2" />
                      Adicionar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-80 overflow-auto">
                  {filteredProducts.slice(0, 20).map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
                      onClick={() => setSelectedProduct(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        {product.internal_code && (
                          <p className="text-xs text-muted-foreground">
                            Cód: {product.internal_code}
                          </p>
                        )}
                      </div>
                      <p className="font-bold text-primary">
                        R$ {product.sale_price.toFixed(2)}
                      </p>
                    </div>
                  ))}
                  {filteredProducts.length === 0 && search && (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum produto encontrado
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Itens do Pedido</CardTitle>
              <Badge variant="secondary">{tabItems.length} itens</Badge>
            </CardHeader>
            <CardContent>
              {tabItems.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum item adicionado</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-80 overflow-auto">
                  {tabItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.quantity}x</span>
                          <span>{item.product?.name}</span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mt-1">
                            📝 {item.notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(item.added_at).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold">R$ {item.total.toFixed(2)}</p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pedidos lançados pelo garçom / cozinha */}
              {(bill?.lines.filter((l) => l.origin === 'order_item').length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <p className="text-sm font-semibold">Pedidos da cozinha</p>
                  {bill!.lines
                    .filter((l) => l.origin === 'order_item')
                    .map((l) => (
                      <div key={l.id} className="flex justify-between text-sm">
                        <span>
                          {l.quantity}x {l.name}
                          {l.order_number ? (
                            <Badge variant="outline" className="ml-1 text-[10px]">#{l.order_number}</Badge>
                          ) : null}
                        </span>
                        <span>R$ {l.total.toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Totals */}
              {(bill?.lines.length ?? 0) > 0 && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  {totals.discount > 0 && (
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Descontos</span>
                      <span>-R$ {totals.discount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold">
                    <span>Total da comanda</span>
                    <span className="text-primary">R$ {(bill?.subtotal ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Close Tab Dialog (conta completa: produtos + pedidos do restaurante) */}
        {tabId && (
          <CloseTabDialog
            open={isCloseDialogOpen}
            onOpenChange={setIsCloseDialogOpen}
            tabId={tabId}
            tabLabel={title}
            peopleCount={(tab as any)?.people_count ?? null}
            onClosed={() => navigate('/tables')}
          />
        )}
      </div>
    </AppLayout>
  );
}

export default TabOrder;
