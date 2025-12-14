import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { CreateTabInputSchema, AddTabItemInputSchema, validateInput } from '@/lib/validations';

export interface Tab {
  id: string;
  tenant_id: string;
  table_id: string | null;
  customer_name: string | null;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed' | 'cancelled';
  user_id: string | null;
  notes: string | null;
  created_at: string;
  table?: {
    id: string;
    number: string;
    name: string | null;
  } | null;
}

export interface TabItem {
  id: string;
  tab_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  added_at: string;
  added_by: string | null;
  notes: string | null;
  product?: {
    id: string;
    name: string;
    internal_code: string | null;
  };
}

export interface CreateTabInput {
  table_id?: string;
  customer_name?: string;
  notes?: string;
}

export interface AddTabItemInput {
  tab_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount?: number;
  notes?: string;
}

export function useOpenTabs() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['tabs', 'open', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('tabs')
        .select(`
          *,
          table:tables(id, number, name)
        `)
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (error) throw error;
      return data as Tab[];
    },
    enabled: !!currentTenant?.id,
    refetchInterval: 30000,
  });
}

export function useTab(tabId: string | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ['tab', tabId],
    queryFn: async () => {
      if (!tabId || !currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tabs')
        .select(`
          *,
          table:tables(id, number, name)
        `)
        .eq('id', tabId)
        .eq('tenant_id', currentTenant.id)
        .single();

      if (error) throw error;
      return data as Tab;
    },
    enabled: !!tabId && !!currentTenant?.id,
  });
}

export function useTabItems(tabId: string | undefined) {
  return useQuery({
    queryKey: ['tab-items', tabId],
    queryFn: async () => {
      if (!tabId) return [];

      const { data, error } = await supabase
        .from('tab_items')
        .select(`
          *,
          product:products(id, name, internal_code)
        `)
        .eq('tab_id', tabId)
        .order('added_at', { ascending: true });

      if (error) throw error;
      return data as TabItem[];
    },
    enabled: !!tabId,
  });
}

export function useCreateTab() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTabInput) => {
      if (!currentTenant?.id) throw new Error('Nenhum tenant selecionado');

      // Validate input
      validateInput(CreateTabInputSchema, input);

      const { data, error } = await supabase
        .from('tabs')
        .insert({
          tenant_id: currentTenant.id,
          table_id: input.table_id || null,
          customer_name: input.customer_name || null,
          notes: input.notes || null,
          user_id: user?.id || null,
          status: 'open',
        })
        .select()
        .single();

      if (error) throw error;

      // Update table status if linked
      if (input.table_id) {
        await supabase
          .from('tables')
          .update({ status: 'occupied' })
          .eq('id', input.table_id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Comanda aberta com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao abrir comanda: ' + error.message);
    },
  });
}

export function useAddTabItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: AddTabItemInput) => {
      // Validate input
      validateInput(AddTabItemInputSchema, input);

      const total = (input.quantity * input.unit_price) - (input.discount || 0);

      // Validate calculated total
      if (total < 0) throw new Error("Total do item não pode ser negativo");

      const { data, error } = await supabase
        .from('tab_items')
        .insert({
          tab_id: input.tab_id,
          product_id: input.product_id,
          quantity: input.quantity,
          unit_price: input.unit_price,
          discount: input.discount || 0,
          total,
          notes: input.notes || null,
          added_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tab-items', variables.tab_id] });
      toast.success('Item adicionado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao adicionar item: ' + error.message);
    },
  });
}

export function useRemoveTabItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, tabId }: { itemId: string; tabId: string }) => {
      const { error } = await supabase
        .from('tab_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      return tabId;
    },
    onSuccess: (tabId) => {
      queryClient.invalidateQueries({ queryKey: ['tab-items', tabId] });
      toast.success('Item removido');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover item: ' + error.message);
    },
  });
}

export function useCloseTab() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      tabId,
      tableId,
      paymentMethod,
      items,
    }: {
      tabId: string;
      tableId: string | null;
      paymentMethod: string;
      items: TabItem[];
    }) => {
      if (!currentTenant?.id) throw new Error('Nenhum tenant selecionado');
      if (!paymentMethod || paymentMethod.length === 0) throw new Error('Forma de pagamento é obrigatória');
      if (items.length === 0) throw new Error('Comanda deve ter pelo menos um item');

      const grossTotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const discountTotal = items.reduce((sum, item) => sum + item.discount, 0);
      const netTotal = grossTotal - discountTotal;

      // Validate totals
      if (netTotal < 0) throw new Error('Total líquido não pode ser negativo');
      if (discountTotal > grossTotal) throw new Error('Desconto não pode ser maior que o valor bruto');

      // Create sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          tenant_id: currentTenant.id,
          user_id: user?.id || null,
          payment_method: paymentMethod,
          gross_total: grossTotal,
          discount_total: discountTotal,
          net_total: netTotal,
          notes: `Comanda #${tabId.slice(0, 8)}`,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = items.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update stock atomically using RPC for each product
      for (const item of items) {
        // Use atomic decrement_stock function to prevent race conditions
        const { error: stockError } = await supabase.rpc('decrement_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity,
        });

        if (stockError) {
          console.error('Stock update error:', stockError);
          // Continue with sale even if stock update fails
        }

        // Create stock movement
        await supabase.from('stock_movements').insert({
          tenant_id: currentTenant.id,
          product_id: item.product_id,
          movement_type: 'saida',
          quantity: -item.quantity,
          description: `Venda (comanda) #${sale.id.slice(0, 8)}`,
          sale_id: sale.id,
        });
      }

      // Create financial entry
      await supabase.from('financial_entries').insert({
        tenant_id: currentTenant.id,
        type: 'receita',
        description: `Venda (comanda) #${sale.id.slice(0, 8)}`,
        amount: netTotal,
        payment_method: paymentMethod,
        sale_id: sale.id,
      });

      // Close the tab
      await supabase
        .from('tabs')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
        })
        .eq('id', tabId);

      // Free the table if linked
      if (tableId) {
        await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', tableId);
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['financial'] });
      toast.success('Comanda fechada com sucesso');
    },
    onError: (error: Error) => {
      toast.error('Erro ao fechar comanda: ' + error.message);
    },
  });
}

export function useCancelTab() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tabId, tableId }: { tabId: string; tableId: string | null }) => {
      await supabase
        .from('tabs')
        .update({
          status: 'cancelled',
          closed_at: new Date().toISOString(),
        })
        .eq('id', tabId);

      if (tableId) {
        await supabase
          .from('tables')
          .update({ status: 'available' })
          .eq('id', tableId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tabs'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Comanda cancelada');
    },
    onError: (error: Error) => {
      toast.error('Erro ao cancelar comanda: ' + error.message);
    },
  });
}
