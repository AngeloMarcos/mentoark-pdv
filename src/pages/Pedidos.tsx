import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Plus, Bike, Store, MapPin, Phone, Send } from 'lucide-react';
import { useMenuItems } from '@/hooks/useMenus';
import {
  useOrders, useOrdersRealtime, useCreateOrder, useSetOrderStatus,
  ORDER_STATUS_LABELS, ORDER_TYPE_LABELS, type Order, type OrderType, type OrderStatus,
} from '@/hooks/useOrders';
import { OrderComposer, cartTotal, type CartLine } from '@/components/restaurant/OrderComposer';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const NEXT_STATUS: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  received: { next: 'preparing', label: 'Iniciar preparo' },
  preparing: { next: 'ready', label: 'Marcar pronto' },
  ready: { next: 'dispatched', label: 'Despachar' },
  dispatched: { next: 'delivered', label: 'Entregue' },
  delivered: { next: 'closed', label: 'Concluir' },
};

const Pedidos = () => {
  useOrdersRealtime();
  const { data: orders = [] } = useOrders();
  const { data: menuItems = [] } = useMenuItems();
  const createOrder = useCreateOrder();
  const setStatus = useSetOrderStatus();

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<OrderType>('balcao');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState('');
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [delivery, setDelivery] = useState({
    recipient_name: '', phone: '', street: '', number: '', neighborhood: '', city: '', reference_point: '',
  });

  const submit = async () => {
    if (!cart.length) return;
    await createOrder.mutateAsync({
      order_type: type,
      notes: notes || null,
      delivery_fee: type === 'delivery' ? deliveryFee : 0,
      items: cart.map((l) => ({
        menu_item_id: l.menu_item_id,
        quantity: l.quantity,
        notes: l.notes ?? null,
        options: l.options,
      })),
      delivery: type === 'delivery' ? delivery : undefined,
    });
    setCart([]);
    setNotes('');
    setDeliveryFee(0);
    setOpen(false);
  };

  const renderOrder = (order: Order) => {
    const action = NEXT_STATUS[order.status];
    return (
      <Card key={order.id}>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">#{order.order_number}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                {order.order_type === 'delivery' ? <Bike className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                {ORDER_TYPE_LABELS[order.order_type]}
                {order.table ? ` · Mesa ${order.table.number}` : ''}
              </p>
            </div>
            <Badge variant={order.status === 'ready' ? 'default' : 'secondary'}>
              {ORDER_STATUS_LABELS[order.status]}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground">
            {(order.items ?? []).map((i) => (
              <p key={i.id}>{Number(i.quantity)}x {i.item_name}</p>
            ))}
          </div>

          {order.delivery && (
            <div className="text-xs text-muted-foreground space-y-0.5 rounded-lg bg-muted/40 p-2">
              <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />
                {order.delivery.street}, {order.delivery.number} — {order.delivery.neighborhood}
              </p>
              {order.delivery.phone && (
                <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{order.delivery.phone}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-semibold">{brl(Number(order.total))}</span>
            {action && (
              <Button size="sm" onClick={() => setStatus.mutate({ orderId: order.id, status: action.next })}>
                {action.label}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const groups: { key: string; label: string; filter: (o: Order) => boolean }[] = [
    { key: 'active', label: 'Em andamento', filter: (o) => ['received', 'preparing', 'ready', 'dispatched'].includes(o.status) },
    { key: 'delivery', label: 'Delivery', filter: (o) => o.order_type === 'delivery' },
    { key: 'all', label: 'Todos', filter: () => true },
  ];

  return (
    <AppLayout title="Pedidos">
      <PermissionGuard permission="orders">
        <div className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-1" /> Novo pedido</Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[92vh] overflow-auto">
                <DialogHeader><DialogTitle>Novo pedido</DialogTitle></DialogHeader>

                <div className="flex gap-2">
                  <Button variant={type === 'balcao' ? 'default' : 'outline'} onClick={() => setType('balcao')}>
                    <Store className="w-4 h-4 mr-1" /> Balcão
                  </Button>
                  <Button variant={type === 'delivery' ? 'default' : 'outline'} onClick={() => setType('delivery')}>
                    <Bike className="w-4 h-4 mr-1" /> Delivery
                  </Button>
                </div>

                <OrderComposer items={menuItems} cart={cart} onChange={setCart} />

                {type === 'delivery' && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label>Cliente</Label>
                      <Input value={delivery.recipient_name} onChange={(e) => setDelivery({ ...delivery, recipient_name: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Telefone</Label>
                      <Input value={delivery.phone} onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Rua</Label>
                      <Input value={delivery.street} onChange={(e) => setDelivery({ ...delivery, street: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Número</Label>
                      <Input value={delivery.number} onChange={(e) => setDelivery({ ...delivery, number: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Bairro</Label>
                      <Input value={delivery.neighborhood} onChange={(e) => setDelivery({ ...delivery, neighborhood: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Cidade</Label>
                      <Input value={delivery.city} onChange={(e) => setDelivery({ ...delivery, city: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Taxa de entrega</Label>
                      <CurrencyInput value={deliveryFee} onChange={setDeliveryFee} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label>Ponto de referência</Label>
                      <Input value={delivery.reference_point} onChange={(e) => setDelivery({ ...delivery, reference_point: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label>Observações do pedido</Label>
                  <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>

                <DialogFooter>
                  <Button className="w-full h-11" disabled={!cart.length || createOrder.isPending} onClick={submit}>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar · {brl(cartTotal(cart) + (type === 'delivery' ? deliveryFee : 0))}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Tabs defaultValue="active">
            <TabsList>
              {groups.map((g) => <TabsTrigger key={g.key} value={g.key}>{g.label}</TabsTrigger>)}
            </TabsList>
            {groups.map((g) => {
              const list = orders.filter(g.filter);
              return (
                <TabsContent key={g.key} value={g.key} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map(renderOrder)}
                  {list.length === 0 && (
                    <p className="text-sm text-muted-foreground py-10 text-center col-span-full">Nenhum pedido.</p>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </PermissionGuard>
    </AppLayout>
  );
};

export default Pedidos;
