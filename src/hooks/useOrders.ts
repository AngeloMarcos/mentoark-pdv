import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { getUserFriendlyError } from '@/lib/error-handler';

export type OrderType = 'mesa' | 'balcao' | 'delivery';
export type OrderStatus =
  | 'received'
  | 'preparing'
  | 'ready'
  | 'dispatched'
  | 'delivered'
  | 'closed'
  | 'cancelled';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Recebido',
  preparing: 'Em preparo',
  ready: 'Pronto',
  dispatched: 'Saiu para entrega',
  delivered: 'Entregue',
  closed: 'Concluído',
  cancelled: 'Cancelado',
};

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  mesa: 'Mesa',
  balcao: 'Balcão',
  delivery: 'Delivery',
};

export interface OrderItemOption {
  id: string;
  option_name: string;
  value_name: string;
  price_delta: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  station_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  options_total: number;
  total: number;
  status: OrderItemStatus;
  notes: string | null;
  started_at: string | null;
  ready_at: string | null;
  created_at: string;
  options?: OrderItemOption[];
}

export interface DeliveryInfo {
  id: string;
  order_id: string;
  recipient_name: string | null;
  phone: string | null;
  zip_code: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  reference_point: string | null;
  courier_name: string | null;
  estimated_minutes: number | null;
}

export interface Order {
  id: string;
  tenant_id: string;
  order_number: number;
  order_type: OrderType;
  status: OrderStatus;
  tab_id: string | null;
  table_id: string | null;
  customer_id: string | null;
  subtotal: number;
  service_fee: number;
  delivery_fee: number;
  discount: number;
  total: number;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  items?: OrderItem[];
  delivery?: DeliveryInfo | null;
  table?: { id: string; number: string; name: string | null } | null;
  customer?: { id: string; name: string; phone: string | null } | null;
}

const ORDER_SELECT = `*,
  items:order_items(*, options:order_item_options(*)),
  delivery:delivery_info(*),
  table:tables(id, number, name),
  customer:customers(id, name, phone)`;

export interface CreateOrderInput {
  order_type: OrderType;
  tab_id?: string | null;
  table_id?: string | null;
  customer_id?: string | null;
  notes?: string | null;
  service_fee_pct?: number;
  delivery_fee?: number;
  discount?: number;
  items: {
    menu_item_id: string;
    quantity: number;
    notes?: string | null;
    options?: { option_name: string; value_name: string; price_delta: number }[];
  }[];
  delivery?: Partial<DeliveryInfo> & { estimated_minutes?: number | null };
}

/** Subscribes to realtime changes on orders for the current tenant. */
export function useOrdersRealtime() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();

  useEffect(() => {
    if (!currentTenant?.id) return;
    const channel = supabase
      .channel(`orders-${currentTenant.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `tenant_id=eq.${currentTenant.id}` },
        () => qc.invalidateQueries({ queryKey: ['orders'] })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items', filter: `tenant_id=eq.${currentTenant.id}` },
        () => qc.invalidateQueries({ queryKey: ['orders'] })
      )
      .subscribe((status) => {
        // Após queda de rede/aba suspensa o canal pode morrer: revalida ao reconectar
        if (status === 'SUBSCRIBED') qc.invalidateQueries({ queryKey: ['orders'] });
      });

    const resync = () => {
      if (document.visibilityState !== 'visible') return;
      qc.invalidateQueries({ queryKey: ['orders'] });
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);

    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, qc]);
}

export function useOrders(filters?: { statuses?: OrderStatus[]; types?: OrderType[]; tabId?: string }) {
  const { currentTenant } = useTenant();
  const key = JSON.stringify(filters ?? {});

  return useQuery({
    queryKey: ['orders', currentTenant?.id, key],
    queryFn: async () => {
      if (!currentTenant?.id) return [];
      let query = supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.statuses?.length) query = query.in('status', filters.statuses);
      if (filters?.types?.length) query = query.in('order_type', filters.types);
      if (filters?.tabId) query = query.eq('tab_id', filters.tabId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        delivery: Array.isArray(o.delivery) ? o.delivery[0] ?? null : o.delivery ?? null,
      })) as Order[];
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 30000,
  });
}

export function useKitchenOrders() {
  return useOrders({ statuses: ['received', 'preparing', 'ready'] });
}

export function useCreateOrder() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      if (!currentTenant?.id) throw new Error('Nenhuma empresa selecionada');
      if (!input.items.length) throw new Error('Adicione ao menos um item');

      const { data, error } = await supabase.rpc('create_restaurant_order', {
        p_payload: {
          tenant_id: currentTenant.id,
          order_type: input.order_type,
          tab_id: input.tab_id ?? null,
          table_id: input.table_id ?? null,
          customer_id: input.customer_id ?? null,
          notes: input.notes ?? null,
          service_fee_pct: input.service_fee_pct ?? 0,
          delivery_fee: input.delivery_fee ?? 0,
          discount: input.discount ?? 0,
          items: input.items,
          delivery: input.delivery ?? null,
        } as any,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Pedido enviado para a produção');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useSetOrderStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { error } = await supabase.rpc('set_order_status', { p_order_id: orderId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useSetOrderItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: OrderItemStatus }) => {
      const { error } = await supabase.rpc('set_order_item_status', { p_item_id: itemId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useMergeTabs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceTabId, targetTabId }: { sourceTabId: string; targetTabId: string }) => {
      const { error } = await supabase.rpc('merge_tabs', {
        p_source_tab: sourceTabId,
        p_target_tab: targetTabId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tabs'] });
      qc.invalidateQueries({ queryKey: ['tab-items'] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Comandas unificadas');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}

export function useTransferTab() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tabId, tableId }: { tabId: string; tableId: string | null }) => {
      const { error } = await supabase.rpc('transfer_tab', { p_tab_id: tabId, p_table_id: tableId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tabs'] });
      qc.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Comanda transferida');
    },
    onError: (e: Error) => toast.error(getUserFriendlyError(e)),
  });
}
