import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Users, Minus, Plus, Receipt, Trash2 } from 'lucide-react';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';
import { useTabBill, useCloseRestaurantTab, type CloseTabPayment } from '@/hooks/useTabBilling';
import { CustomerSelector } from '@/components/pdv/CustomerSelector';
import type { Customer } from '@/hooks/useCustomers';
import { cn } from '@/lib/utils';

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tabId: string;
  tabLabel?: string;
  peopleCount?: number | null;
  onClosed?: () => void;
}

export function CloseTabDialog({ open, onOpenChange, tabId, tabLabel, peopleCount, onClosed }: Props) {
  const { data: bill } = useTabBill(open ? tabId : undefined);
  const { data: methods = [] } = usePaymentMethods();
  const closeTab = useCloseRestaurantTab();

  const [serviceFee, setServiceFee] = useState(true);
  const [servicePct, setServicePct] = useState(10);
  const [couvert, setCouvert] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [people, setPeople] = useState(peopleCount && peopleCount > 0 ? peopleCount : 1);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [payments, setPayments] = useState<CloseTabPayment[]>([]);

  const subtotal = bill?.subtotal ?? 0;
  const service = serviceFee ? Math.round(subtotal * servicePct) / 100 : 0;
  const total = Math.max(0, Number((subtotal + service + couvert - discount).toFixed(2)));
  const paid = payments.reduce((a, p) => a + p.amount - (p.change_amount ?? 0), 0);
  const remaining = Number((total - paid).toFixed(2));

  useEffect(() => {
    if (open) {
      setPayments([]);
      setDiscount(0);
      setCouvert(0);
      setPeople(peopleCount && peopleCount > 0 ? peopleCount : 1);
    }
  }, [open, peopleCount]);

  const perPerson = people > 0 ? total / people : total;

  const addPayment = (code: string, methodId?: string) => {
    const amount = remaining > 0 ? remaining : 0;
    if (amount <= 0) return;
    setPayments((p) => [...p, { payment_method_code: code, payment_method_id: methodId ?? null, amount }]);
  };

  const updateAmount = (index: number, amount: number) => {
    setPayments((p) => p.map((x, i) => (i === index ? { ...x, amount } : x)));
  };

  const confirm = async () => {
    if (remaining > 0.009) return;
    await closeTab.mutateAsync({
      tab_id: tabId,
      payments,
      discount,
      service_fee_pct: serviceFee ? servicePct : 0,
      couvert_total: couvert,
      customer_id: customer?.id ?? null,
    });
    onOpenChange(false);
    onClosed?.();
  };

  const grouped = useMemo(() => bill?.lines ?? [], [bill]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" /> Fechar conta {tabLabel ? `· ${tabLabel}` : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Extrato */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Extrato</p>
            <div className="space-y-1 max-h-64 overflow-auto pr-1">
              {grouped.map((l) => (
                <div key={`${l.origin}-${l.id}`} className="flex justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    {l.quantity}x {l.name}
                    {l.order_number ? <Badge variant="outline" className="ml-1 text-[10px]">#{l.order_number}</Badge> : null}
                    {l.notes && <span className="block text-[11px] italic text-muted-foreground">{l.notes}</span>}
                  </span>
                  <span className="shrink-0">{brl(l.total)}</span>
                </div>
              ))}
              {grouped.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">Nenhum consumo lançado nesta comanda.</p>
              )}
            </div>

            <Separator />

            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch checked={serviceFee} onCheckedChange={setServiceFee} />
                  <span>Taxa de serviço</span>
                  <Input
                    className="w-14 h-7"
                    value={servicePct}
                    onChange={(e) => setServicePct(Number(e.target.value) || 0)}
                    disabled={!serviceFee}
                  />
                  <span>%</span>
                </div>
                <span>{brl(service)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Couvert</span>
                <div className="w-32"><CurrencyInput value={couvert} onChange={setCouvert} /></div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span>Desconto</span>
                <div className="w-32"><CurrencyInput value={discount} onChange={setDiscount} /></div>
              </div>
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span><span className="text-primary">{brl(total)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Dividir por</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPeople((p) => Math.max(1, p - 1))}>
                  <Minus className="w-3 h-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{people}</span>
                <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setPeople((p) => p + 1)}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <span className="text-sm font-semibold">{brl(perPerson)} / pessoa</span>
            </div>
          </div>

          {/* Pagamento */}
          <div className="space-y-3">
            <p className="text-sm font-semibold">Pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((m) => (
                <Button key={m.id} variant="outline" className="h-11 justify-start"
                  onClick={() => addPayment(m.code, m.id)}>
                  {m.name}
                </Button>
              ))}
              {methods.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-2">
                  Nenhuma forma de pagamento cadastrada em Configurações.
                </p>
              )}
            </div>

            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-2">
                  <span className="text-sm flex-1 truncate">
                    {methods.find((m) => m.code === p.payment_method_code)?.name ?? p.payment_method_code}
                  </span>
                  <div className="w-32">
                    <CurrencyInput value={p.amount} onChange={(v) => updateAmount(i, v)} />
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive h-8 w-8"
                    onClick={() => setPayments((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className={cn('flex justify-between text-sm font-medium', remaining > 0 ? 'text-destructive' : 'text-emerald-600')}>
              <span>{remaining > 0 ? 'Falta pagar' : 'Troco / excedente'}</span>
              <span>{brl(Math.abs(remaining))}</span>
            </div>

            <div className="space-y-1">
              <Label>Cliente (necessário para fiado e fidelidade)</Label>
              <CustomerSelector customer={customer} onSelect={setCustomer} />
            </div>

            <Button
              className="w-full h-12"
              disabled={total <= 0 || remaining > 0.009 || closeTab.isPending}
              onClick={confirm}
            >
              {closeTab.isPending ? 'Finalizando...' : `Confirmar pagamento · ${brl(total)}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
