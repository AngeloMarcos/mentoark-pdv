import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, ChefHat, CheckCircle2, Truck, AlarmClock } from 'lucide-react';
import { useKitchenOrders, useOrdersRealtime, useSetOrderItemStatus, useSetOrderStatus, ORDER_TYPE_LABELS, type Order } from '@/hooks/useOrders';
import { useStations } from '@/hooks/useMenus';
import { cn } from '@/lib/utils';

const minutesSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

const COLUMNS = [
  { key: 'received', label: 'Novos', icon: Clock },
  { key: 'preparing', label: 'Em preparo', icon: ChefHat },
  { key: 'ready', label: 'Prontos', icon: CheckCircle2 },
] as const;

const Cozinha = () => {
  useOrdersRealtime();
  const { data: orders = [] } = useKitchenOrders();
  const { data: stations = [] } = useStations();
  const setItemStatus = useSetOrderItemStatus();
  const setOrderStatus = useSetOrderStatus();
  const [station, setStation] = useState<string>('all');

  const filtered = useMemo(() => {
    if (station === 'all') return orders;
    return orders
      .map((o) => ({ ...o, items: (o.items ?? []).filter((i) => i.station_id === station) }))
      .filter((o) => (o.items ?? []).length > 0);
  }, [orders, station]);

  const byStatus = (status: string) => filtered.filter((o) => o.status === status);

  const renderCard = (order: Order) => {
    const age = minutesSince(order.created_at);
    const late = age > 25;
    return (
      <Card key={order.id} className={cn('p-3 space-y-2 border-l-4', late ? 'border-l-destructive' : 'border-l-primary')}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold">#{order.order_number}</p>
            <p className="text-xs text-muted-foreground">
              {ORDER_TYPE_LABELS[order.order_type]}
              {order.table ? ` · Mesa ${order.table.number}` : ''}
            </p>
          </div>
          <Badge variant={late ? 'destructive' : 'outline'} className="gap-1">
            <AlarmClock className="w-3 h-3" /> {age} min
          </Badge>
        </div>

        <div className="space-y-1">
          {(order.items ?? []).map((it) => (
            <div key={it.id} className="rounded-lg bg-muted/40 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {Number(it.quantity)}x {it.item_name}
                  </p>
                  {(it.options ?? []).map((o) => (
                    <p key={o.id} className="text-[11px] text-muted-foreground">
                      {o.option_name}: {o.value_name}
                    </p>
                  ))}
                  {it.notes && <p className="text-[11px] italic text-amber-600 dark:text-amber-400">{it.notes}</p>}
                </div>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {it.status === 'pending' ? 'Aguardando' : it.status === 'preparing' ? 'Preparando' : 'Pronto'}
                </Badge>
              </div>
              <div className="flex gap-1 mt-1">
                {it.status === 'pending' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs"
                    onClick={() => setItemStatus.mutate({ itemId: it.id, status: 'preparing' })}>
                    Iniciar
                  </Button>
                )}
                {it.status !== 'ready' && (
                  <Button size="sm" className="h-7 text-xs"
                    onClick={() => setItemStatus.mutate({ itemId: it.id, status: 'ready' })}>
                    Pronto
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {order.notes && <p className="text-xs italic text-muted-foreground">Obs.: {order.notes}</p>}

        <div className="flex gap-2">
          {order.status === 'received' && (
            <Button size="sm" variant="outline" className="flex-1"
              onClick={() => setOrderStatus.mutate({ orderId: order.id, status: 'preparing' })}>
              Iniciar tudo
            </Button>
          )}
          {order.status === 'ready' && (
            <Button size="sm" className="flex-1"
              onClick={() => setOrderStatus.mutate({ orderId: order.id, status: order.order_type === 'delivery' ? 'dispatched' : 'delivered' })}>
              <Truck className="w-3.5 h-3.5 mr-1" />
              {order.order_type === 'delivery' ? 'Despachar' : 'Entregue'}
            </Button>
          )}
        </div>
      </Card>
    );
  };

  return (
    <AppLayout title="Cozinha">
      <PermissionGuard permission="kitchen">
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto">
            <Button size="sm" variant={station === 'all' ? 'default' : 'outline'} className="rounded-full"
              onClick={() => setStation('all')}>
              Todas as praças
            </Button>
            {stations.map((s) => (
              <Button key={s.id} size="sm" variant={station === s.id ? 'default' : 'outline'} className="rounded-full"
                onClick={() => setStation(s.id)}>
                {s.name}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {COLUMNS.map((col) => {
              const list = byStatus(col.key);
              return (
                <div key={col.key} className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <col.icon className="w-4 h-4 text-primary" />
                    <p className="font-semibold text-sm">{col.label}</p>
                    <Badge variant="secondary">{list.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-24">
                    {list.map(renderCard)}
                    {list.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6 rounded-lg border border-dashed border-border">
                        Nenhum pedido
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </PermissionGuard>
    </AppLayout>
  );
};

export default Cozinha;
