import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Search, Plus, Minus, Trash2, UtensilsCrossed } from 'lucide-react';
import type { MenuItem } from '@/hooks/useMenus';
import { cn } from '@/lib/utils';

export interface CartOption {
  option_name: string;
  value_name: string;
  price_delta: number;
}

export interface CartLine {
  key: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  options: CartOption[];
  notes?: string;
}

export function lineTotal(line: CartLine) {
  const optionsTotal = line.options.reduce((a, o) => a + Number(o.price_delta), 0);
  return (Number(line.unit_price) + optionsTotal) * line.quantity;
}

export function cartTotal(cart: CartLine[]) {
  return cart.reduce((a, l) => a + lineTotal(l), 0);
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  items: (MenuItem & { section?: { id: string; name: string } })[];
  cart: CartLine[];
  onChange: (cart: CartLine[]) => void;
  compact?: boolean;
}

export function OrderComposer({ items, cart, onChange, compact }: Props) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<string>('all');
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [chosen, setChosen] = useState<CartOption[]>([]);

  const sections = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => i.section && map.set(i.section.id, i.section.name));
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (section === 'all' || i.section?.id === section) &&
        (!term || i.name.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term))
    );
  }, [items, search, section]);

  const openItem = (item: MenuItem) => {
    setSelected(item);
    setQuantity(1);
    setNotes('');
    setChosen([]);
  };

  const toggleOption = (optionName: string, value: { name: string; price_delta: number }, single: boolean) => {
    setChosen((prev) => {
      const exists = prev.some((o) => o.option_name === optionName && o.value_name === value.name);
      if (exists) return prev.filter((o) => !(o.option_name === optionName && o.value_name === value.name));
      const base = single ? prev.filter((o) => o.option_name !== optionName) : prev;
      return [...base, { option_name: optionName, value_name: value.name, price_delta: Number(value.price_delta) }];
    });
  };

  const confirmAdd = () => {
    if (!selected) return;
    const missing = (selected.options ?? []).find(
      (o) => o.required && !chosen.some((c) => c.option_name === o.name)
    );
    if (missing) return;

    const line: CartLine = {
      key: `${selected.id}-${Date.now()}`,
      menu_item_id: selected.id,
      name: selected.name,
      quantity,
      unit_price: Number(selected.price),
      options: chosen,
      notes: notes.trim() || undefined,
    };
    onChange([...cart, line]);
    setSelected(null);
  };

  const changeQty = (key: string, delta: number) => {
    onChange(
      cart
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  return (
    <div className={cn('grid gap-4', compact ? 'grid-cols-1' : 'lg:grid-cols-[1fr_360px]')}>
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar no cardápio..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={section === 'all' ? 'default' : 'outline'}
            className="shrink-0 rounded-full"
            onClick={() => setSection('all')}
          >
            Tudo
          </Button>
          {sections.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={section === s.id ? 'default' : 'outline'}
              className="shrink-0 rounded-full"
              onClick={() => setSection(s.id)}
            >
              {s.name}
            </Button>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={!item.available}
              onClick={() => openItem(item)}
              className={cn(
                'text-left rounded-xl border border-border bg-card p-3 transition-all active:scale-[0.98]',
                item.available ? 'hover:border-primary/60' : 'opacity-50'
              )}
            >
              <div className="flex gap-3">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center">
                    <UtensilsCrossed className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                  <p className="text-sm font-semibold text-primary mt-1">{brl(Number(item.price))}</p>
                </div>
              </div>
              {!item.available && (
                <Badge variant="secondary" className="mt-2">
                  Esgotado
                </Badge>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full py-8 text-center">
              Nenhum item encontrado no cardápio.
            </p>
          )}
        </div>
      </div>

      <Card className="p-3 h-fit lg:sticky lg:top-4">
        <p className="font-semibold text-sm mb-2">Pedido ({cart.length})</p>
        <div className="space-y-2 max-h-[45vh] overflow-auto">
          {cart.map((l) => (
            <div key={l.key} className="rounded-lg border border-border p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{l.name}</p>
                  {l.options.map((o, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">
                      {o.option_name}: {o.value_name}
                    </p>
                  ))}
                  {l.notes && <p className="text-[11px] italic text-muted-foreground">{l.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQty(l.key, -l.quantity)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(l.key, -1)}>
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-7 text-center text-sm">{l.quantity}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => changeQty(l.key, 1)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
                <span className="text-sm font-semibold">{brl(lineTotal(l))}</span>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhum item ainda.</p>}
        </div>
        <div className="flex justify-between border-t border-border mt-3 pt-2 font-semibold">
          <span>Total</span>
          <span>{brl(cartTotal(cart))}</span>
        </div>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 max-h-[60vh] overflow-auto">
              {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}

              {(selected.options ?? []).map((opt) => {
                const single = opt.max_select <= 1;
                return (
                  <div key={opt.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{opt.name}</p>
                      {opt.required && <Badge variant="outline">Obrigatório</Badge>}
                    </div>
                    {(opt.values ?? []).map((v) => {
                      const checked = chosen.some((c) => c.option_name === opt.name && c.value_name === v.name);
                      return (
                        <label
                          key={v.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox checked={checked} onCheckedChange={() => toggleOption(opt.name, v, single)} />
                            <span className="text-sm">{v.name}</span>
                          </div>
                          {Number(v.price_delta) !== 0 && (
                            <span className="text-xs text-primary">+ {brl(Number(v.price_delta))}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                );
              })}

              <div className="space-y-1">
                <p className="text-sm font-medium">Observações</p>
                <Textarea
                  placeholder="Ex.: sem cebola, ponto da carne bem passado"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-10 text-center font-semibold">{quantity}</span>
                <Button size="icon" variant="outline" onClick={() => setQuantity((q) => q + 1)}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button className="w-full h-11" onClick={confirmAdd}>
              Adicionar •{' '}
              {selected
                ? brl((Number(selected.price) + chosen.reduce((a, o) => a + o.price_delta, 0)) * quantity)
                : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
