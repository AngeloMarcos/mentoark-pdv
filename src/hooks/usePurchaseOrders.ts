import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "partially_received"
  | "received"
  | "cancelled";

export interface PurchaseOrder {
  id: string;
  tenant_id: string;
  supplier_id: string;
  order_number: string | null;
  status: PurchaseOrderStatus;
  expected_date: string | null;
  received_date: string | null;
  total_cost: number;
  freight: number;
  discount: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  total: number;
}

export interface CreatePurchaseOrderInput {
  supplier_id: string;
  order_number?: string;
  expected_date?: string;
  freight?: number;
  discount?: number;
  notes?: string;
  status?: PurchaseOrderStatus;
  items: Array<{
    product_id: string;
    quantity_ordered: number;
    unit_cost: number;
  }>;
}

export function usePurchaseOrders(status?: PurchaseOrderStatus) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["purchase_orders", currentTenant?.id, status],
    queryFn: async () => {
      if (!currentTenant) return [];
      let query = supabase
        .from("purchase_orders")
        .select("*, suppliers(name)")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentTenant,
  });
}

export function usePurchaseOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ["purchase_order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name, document, phone, email), purchase_order_items(*, products(name, unit))")
        .eq("id", orderId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!orderId,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      if (!currentTenant || !user) throw new Error("Não autenticado");

      const total =
        input.items.reduce((s, i) => s + i.quantity_ordered * i.unit_cost, 0) +
        (input.freight ?? 0) -
        (input.discount ?? 0);

      const { data: order, error } = await supabase
        .from("purchase_orders")
        .insert({
          tenant_id: currentTenant.id,
          supplier_id: input.supplier_id,
          order_number: input.order_number ?? null,
          expected_date: input.expected_date ?? null,
          freight: input.freight ?? 0,
          discount: input.discount ?? 0,
          notes: input.notes ?? null,
          status: input.status ?? "draft",
          total_cost: total,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;

      const items = input.items.map((i) => ({
        order_id: order.id,
        product_id: i.product_id,
        quantity_ordered: i.quantity_ordered,
        unit_cost: i.unit_cost,
        total: i.quantity_ordered * i.unit_cost,
      }));

      const { error: itemsErr } = await supabase
        .from("purchase_order_items")
        .insert(items);
      if (itemsErr) {
        await supabase.from("purchase_orders").delete().eq("id", order.id);
        throw itemsErr;
      }
      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Pedido criado!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useUpdatePurchaseOrderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PurchaseOrderStatus }) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .update({ status })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_order"] });
      toast.success("Status atualizado!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useReceivePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      items,
      dueDate,
    }: {
      orderId: string;
      items: Array<{ item_id: string; quantity_received: number }>;
      dueDate?: string;
    }) => {
      const { data, error } = await supabase.rpc("receive_purchase_order_items", {
        p_order_id: orderId,
        p_items: items as any,
        p_due_date: dueDate ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_order"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["financial_dashboard"] });
      toast.success("Recebimento registrado, estoque atualizado e Conta a Pagar gerada!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Pedido excluído");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}
