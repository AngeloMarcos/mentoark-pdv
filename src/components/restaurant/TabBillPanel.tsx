import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer, Receipt, Trash2, Loader2 } from 'lucide-react';
import { useTabBill } from '@/hooks/useTabBilling';
import { useRemoveTabItem } from '@/hooks/useTabs';
import { useSetOrderItemStatus } from '@/hooks/useOrders';
import { printPreBill } from '@/lib/pre-bill';
import { useTenant } from '@/contexts/TenantContext';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  tabId: string;
  tabLabel: string;
  peopleCount?: number | null;
  servicePct?: number;
  onCloseBill?: () => void;
  allowRemove?: boolean;
}

export function TabBillPanel({
  tabId,
  tabLabel,
  peopleCount,
  servicePct = 10,
  onCloseBill,
  allowRemove = true,
}: Props) {
  const { currentTenant } = useTenant();
  const { data: bill, isLoading } = useTabBill(tabId);
  const removeItem = useRemoveTabItem();
  const setItemStatus = useSetOrderItemStatus();

  const lines = bill?.lines ?? [];
  const subtotal = bill?.subtotal ?? 0;
  const service = Math.round(subtotal * servicePct) / 100;
  const total = subtotal + service;
  const people = peopleCount && peopleCount > 0 ? peopleCount : 1;

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>();
    lines.forEach((l) => {
      const cur = map.get(l.name) ?? { name: l.name, quantity: 0, total: 0 };
      cur.quantity += l.quantity;
      cur.total += l.total;
      map.set(l.name, cur);
    });
    return Array.from(map.values());
  }, [lines]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {lines.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum item lançado nesta comanda.</p>
      )}

      <div className="space-y-1">
        {lines.map((l) => (
          <div key={`${l.origin}-${l.id}`} className="flex items-start justify-between gap-2 py-1.5 border-b border-border/50">
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">
                {l.quantity}x {l.name}
                {l.order_number ? (
                  <Badge variant="outline" className="ml-1.5 text-[10px]">#{l.order_number}</Badge>
                ) : null}
              </p>
              {l.notes && <p className="text-[11px] italic text-muted-foreground">{l.notes}</p>}
              <p className="text-[11px] text-muted-foreground">{brl(l.unit_price)} un.</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-sm font-semibold tabular-nums">{brl(l.total)}</span>
              {allowRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  title="Cancelar item"
                  onClick={() => {
                    if (!confirm(`Cancelar "${l.name}"?`)) return;
                    if (l.origin === 'tab_item') removeItem.mutate({ itemId: l.id, tabId });
                    else setItemStatus.mutate({ itemId: l.id, status: 'cancelled' });
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="tabular-nums">{brl(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Serviço ({servicePct}%)</span>
          <span className="tabular-nums">{brl(service)}</span>
        </div>
        <div className="flex justify-between text-base font-bold">
          <span>Total</span>
          <span className="tabular-nums">{brl(total)}</span>
        </div>
        {people > 1 && (
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Dividido por {people} pessoas</span>
            <span className="tabular-nums">{brl(total / people)} cada</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <Button
          variant="outline"
          className="h-11"
          disabled={lines.length === 0}
          onClick={() =>
            printPreBill({
              tenantName: currentTenant?.name ?? 'Estabelecimento',
              tabLabel,
              lines: grouped,
              subtotal,
              servicePct,
              service,
              total,
              people,
            })
          }
        >
          <Printer className="w-4 h-4 mr-2" /> Pré-conta
        </Button>
        <Button className="h-11" disabled={lines.length === 0} onClick={onCloseBill}>
          <Receipt className="w-4 h-4 mr-2" /> Fechar conta
        </Button>
      </div>
    </div>
  );
}
