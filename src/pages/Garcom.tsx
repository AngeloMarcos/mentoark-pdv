import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, LayoutGrid, Plus, ClipboardList, Send, LogOut, Receipt, Settings2, ScrollText } from 'lucide-react';
import { CloseTabDialog } from '@/components/restaurant/CloseTabDialog';
import { TabBillPanel } from '@/components/restaurant/TabBillPanel';
import { TabActionsDialog } from '@/components/restaurant/TabActionsDialog';
import { useTables } from '@/hooks/useTables';
import { useOpenTabs, useCreateTab } from '@/hooks/useTabs';
import { useOpenTabTotals } from '@/hooks/useTabBilling';
import { useMenuItems } from '@/hooks/useMenus';
import { useCreateOrder, useOrders, useOrdersRealtime, ORDER_STATUS_LABELS } from '@/hooks/useOrders';
import { OrderComposer, cartTotal, type CartLine } from '@/components/restaurant/OrderComposer';
import { cn } from '@/lib/utils';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Garcom = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { currentTenant } = useTenant();
  useOrdersRealtime();

  const { data: tables = [] } = useTables();
  const { data: tabs = [] } = useOpenTabs();
  const { data: menuItems = [] } = useMenuItems();
  const { data: orders = [] } = useOrders({ statuses: ['received', 'preparing', 'ready'] });
  const { data: tabTotals = {} } = useOpenTabTotals();
  const createTab = useCreateTab();
  const createOrder = useCreateOrder();

  const [view, setView] = useState<'tables' | 'tabs' | 'orders'>('tables');
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sheetTab, setSheetTab] = useState<'pedir' | 'conta'>('pedir');
  const [closingTabId, setClosingTabId] = useState<string | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [newTab, setNewTab] = useState<{ open: boolean; tableId?: string }>({ open: false });
  const [customerName, setCustomerName] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [user, authLoading, navigate]);

  const tabByTable = useMemo(() => {
    const map = new Map<string, (typeof tabs)[number]>();
    tabs.forEach((t) => t.table_id && map.set(t.table_id, t));
    return map;
  }, [tabs]);

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  const activeLabel = activeTab
    ? activeTab.table
      ? `Mesa ${activeTab.table.number}`
      : activeTab.customer_name || 'Comanda avulsa'
    : '';

  const openTab = (id: string) => {
    setActiveTabId(id);
    setSheetTab('pedir');
  };

  const submitOrder = async () => {
    if (!activeTab || cart.length === 0) return;
    await createOrder.mutateAsync({
      order_type: activeTab.table_id ? 'mesa' : 'balcao',
      tab_id: activeTab.id,
      table_id: activeTab.table_id,
      items: cart.map((l) => ({
        menu_item_id: l.menu_item_id,
        quantity: l.quantity,
        notes: l.notes ?? null,
        options: l.options,
      })),
    });
    setCart([]);
    setSheetTab('conta');
  };


  if (!currentTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-3">
          <p className="text-muted-foreground">Selecione uma empresa para usar o modo garçom.</p>
          <Button onClick={() => navigate('/select-tenant')}>Selecionar empresa</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-20 h-14 px-4 flex items-center gap-3 border-b border-border bg-card/80 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">Modo Garçom</p>
          <p className="text-[11px] text-muted-foreground truncate">{currentTenant.name}</p>
        </div>
        <Button variant="ghost" size="icon" className="ml-auto" onClick={() => signOut().then(() => navigate('/auth'))}>
          <LogOut className="w-4 h-4" />
        </Button>
      </header>

      <main className="flex-1 p-3 pb-24 space-y-3">
        {view === 'tables' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map((table) => {
              const tab = tabByTable.get(table.id);
              const open = !!tab;
              return (
                <button
                  key={table.id}
                  onClick={() => (open ? setActiveTabId(tab!.id) : setNewTab({ open: true, tableId: table.id }))}
                  className={cn(
                    'rounded-2xl border p-4 text-left min-h-24 transition-all active:scale-[0.97]',
                    open ? 'border-primary bg-primary/10' : 'border-border bg-card'
                  )}
                >
                  <p className="text-lg font-bold">Mesa {table.number}</p>
                  {table.name && <p className="text-xs text-muted-foreground truncate">{table.name}</p>}
                  <Badge variant={open ? 'default' : 'secondary'} className="mt-2">
                    {open ? 'Ocupada' : 'Livre'}
                  </Badge>
                </button>
              );
            })}
            {tables.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-10">
                Nenhuma mesa cadastrada. Cadastre em Mesas.
              </p>
            )}
          </div>
        )}

        {view === 'orders' && (
          <div className="space-y-2">
            {orders.map((o) => (
              <Card key={o.id} className="p-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    #{o.order_number} {o.table ? `· Mesa ${o.table.number}` : ''}
                  </p>
                  <Badge variant={o.status === 'ready' ? 'default' : 'secondary'}>
                    {ORDER_STATUS_LABELS[o.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {(o.items ?? []).map((i) => `${Number(i.quantity)}x ${i.item_name}`).join(', ')}
                </p>
                <p className="text-sm font-semibold mt-1">{brl(Number(o.total))}</p>
              </Card>
            ))}
            {orders.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum pedido em andamento.</p>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 h-16 border-t border-border bg-card/95 backdrop-blur flex">
        <button
          className={cn('flex-1 flex flex-col items-center justify-center gap-1 text-xs', view === 'tables' && 'text-primary')}
          onClick={() => setView('tables')}
        >
          <LayoutGrid className="w-5 h-5" /> Mesas
        </button>
        <button
          className={cn('flex-1 flex flex-col items-center justify-center gap-1 text-xs', view === 'orders' && 'text-primary')}
          onClick={() => setView('orders')}
        >
          <ClipboardList className="w-5 h-5" /> Pedidos
        </button>
      </nav>

      {/* Nova comanda */}
      <Dialog open={newTab.open} onOpenChange={(o) => setNewTab({ open: o })}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Abrir comanda</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome do cliente (opcional)</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-11" />
          </div>
          <DialogFooter>
            <Button
              className="w-full h-11"
              onClick={async () => {
                const tab = await createTab.mutateAsync({
                  table_id: newTab.tableId,
                  customer_name: customerName || undefined,
                });
                setCustomerName('');
                setNewTab({ open: false });
                setActiveTabId((tab as any)?.id ?? null);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Abrir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lançar pedido */}
      <Sheet open={!!activeTab} onOpenChange={(o) => { if (!o) { setActiveTabId(null); setCart([]); } }}>
        <SheetContent side="bottom" className="h-[92vh] p-0 flex flex-col">
          <SheetHeader className="p-4 pb-2">
            <SheetTitle>
              {activeTab?.table ? `Mesa ${activeTab.table.number}` : 'Comanda'}
              {activeTab?.customer_name ? ` · ${activeTab.customer_name}` : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-auto px-4">
            <OrderComposer items={menuItems} cart={cart} onChange={setCart} compact />
          </div>
          <div className="p-4 border-t border-border space-y-2">
            <Button className="w-full h-12" disabled={cart.length === 0 || createOrder.isPending} onClick={submitOrder}>
              <Send className="w-4 h-4 mr-2" /> Enviar para produção · {brl(cartTotal(cart))}
            </Button>
            <Button variant="outline" className="w-full h-11" onClick={() => setClosingTabId(activeTab?.id ?? null)}>
              <Receipt className="w-4 h-4 mr-2" /> Fechar conta
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {closingTabId && (
        <CloseTabDialog
          open={!!closingTabId}
          onOpenChange={(o) => !o && setClosingTabId(null)}
          tabId={closingTabId}
          onClosed={() => { setClosingTabId(null); setActiveTabId(null); setCart([]); }}
        />
      )}
    </div>
  );
};

export default Garcom;
