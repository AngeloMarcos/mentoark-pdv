import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/lib/error-handler';

export interface BillLine {
  id: string;
  origin: 'tab_item' | 'order_item';
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string | null;
  order_number?: number | null;
}

export interface TabBill {
  lines: BillLine[];
  subtotal: number;
}

/** Consolidated bill for a tab: direct products + restaurant order items. */
export function useTabBill(tabId?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['tab-bill', tabId, currentTenant?.id],
    queryFn: async (): Promise<TabBill> => {
      if (!tabId) return { lines: [], subtotal: 0 };

      const [{ data: tabItems, error: e1 }, { data: orders, error: e2 }] = await Promise.all([
        supabase
          .from('tab_items')
          .select('id, quantity, unit_price, discount, total, notes, product:products(name)')
          .eq('tab_id', tabId),
        supabase
          .from('orders')
          .select('id, order_number, status, items:order_items(id, item_name, quantity, unit_price, options_total, total, status, notes)')
          .eq('tab_id', tabId)
          .neq('status', 'cancelled'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const lines: BillLine[] = [];

      (tabItems ?? []).forEach((i: any) => {
        lines.push({
          id: i.id,
          origin: 'tab_item',
          name: i.product?.name ?? 'Produto',
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          total: Number(i.total),
          notes: i.notes,
        });
      });

      (orders ?? []).forEach((o: any) => {
        (o.items ?? [])
          .filter((it: any) => it.status !== 'cancelled')
          .forEach((it: any) => {
            lines.push({
              id: it.id,
              origin: 'order_item',
              name: it.item_name,
              quantity: Number(it.quantity),
              unit_price: Number(it.unit_price) + Number(it.options_total ?? 0),
              total: Number(it.total),
              notes: it.notes,
              order_number: o.order_number,
            });
          });
      });

      return { lines, subtotal: lines.reduce((a, l) => a + l.total, 0) };
    },
    enabled: !!tabId,
  });
}

export interface CloseTabPayment {
  payment_method_id?: string | null;
  payment_method_code: string;
  amount: number;
  change_amount?: number;
  installments?: number;
}

export interface CloseTabInput {
  tab_id: string;
  payments: CloseTabPayment[];
  discount?: number;
  service_fee_pct?: number;
  couvert_total?: number;
  customer_id?: string | null;
  notes?: string | null;
}

export function useCloseRestaurantTab() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: CloseTabInput) => {
      if (!input.payments.length) throw new Error('Informe ao menos uma forma de pagamento');

      const { data, error } = await supabase.rpc('close_restaurant_tab', {
        p_payload: {
          tab_id: input.tab_id,
          payments: input.payments,
          discount: input.discount ?? 0,
          service_fee_pct: input.service_fee_pct ?? 0,
          couvert_total: input.couvert_total ?? 0,
          customer_id: input.customer_id ?? null,
          notes: input.notes ?? null,
        } as any,
      });
      if (error) throw error;
      return data as { sale_id: string; total: number; service_fee: number; subtotal: number };
    },
    onSuccess: () => {
      ['tabs', 'tables', 'orders', 'sales', 'tab-bill', 'products', 'financial', 'cash-session'].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] })
      );
      toast.success('Conta fechada com sucesso');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

/** Totais consolidados (itens diretos + pedidos) de todas as comandas abertas. */
export function useOpenTabTotals() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['tab-totals', currentTenant?.id],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!currentTenant?.id) return {};

      const { data: tabs, error: eTabs } = await supabase
        .from('tabs')
        .select('id')
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'open');
      if (eTabs) throw eTabs;

      const ids = (tabs ?? []).map((t: any) => t.id);
      if (!ids.length) return {};

      const [{ data: items, error: e1 }, { data: orders, error: e2 }] = await Promise.all([
        supabase.from('tab_items').select('tab_id, total').in('tab_id', ids),
        supabase
          .from('orders')
          .select('tab_id, items:order_items(total, status)')
          .in('tab_id', ids)
          .neq('status', 'cancelled'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;

      const totals: Record<string, number> = {};
      ids.forEach((id) => (totals[id] = 0));
      (items ?? []).forEach((i: any) => {
        totals[i.tab_id] = (totals[i.tab_id] ?? 0) + Number(i.total);
      });
      (orders ?? []).forEach((o: any) => {
        (o.items ?? [])
          .filter((it: any) => it.status !== 'cancelled')
          .forEach((it: any) => {
            totals[o.tab_id] = (totals[o.tab_id] ?? 0) + Number(it.total);
          });
      });
      return totals;
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 30000,
  });
}
