import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export type RefundMethod = "store_credit" | "cash" | "pix";
export type ReturnReasonType = "defect" | "regret" | "exchange" | "other";

export interface SaleReturn {
  id: string;
  tenant_id: string;
  sale_id: string;
  created_by: string;
  reason: string;
  reason_type: ReturnReasonType;
  total_amount: number;
  refund_method: RefundMethod;
  notes: string | null;
  created_at: string;
}

export interface SaleReturnItem {
  id: string;
  return_id: string;
  sale_item_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ProcessReturnInput {
  sale_id: string;
  reason: string;
  reason_type: ReturnReasonType;
  refund_method: RefundMethod;
  notes?: string;
  items: Array<{ sale_item_id: string; quantity: number }>;
}

export interface SaleWithItemsForReturn {
  id: string;
  datetime: string;
  customer_id: string | null;
  customer_name: string | null;
  net_total: number;
  payment_method: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    already_returned: number;
    returnable: number;
  }>;
}

export function useReturns() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["sale_returns", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from("sale_returns")
        .select("*, sales(datetime, customer_id, net_total, customers(name))")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentTenant,
  });
}

export function useReturnDetail(returnId: string | null) {
  return useQuery({
    queryKey: ["sale_return", returnId],
    queryFn: async () => {
      if (!returnId) return null;
      const { data, error } = await supabase
        .from("sale_returns")
        .select("*, sale_return_items(*, products(name)), sales(datetime, customers(name))")
        .eq("id", returnId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!returnId,
  });
}

export function useSaleForReturn(saleId: string | null) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["sale_for_return", saleId],
    queryFn: async (): Promise<SaleWithItemsForReturn | null> => {
      if (!saleId || !currentTenant) return null;

      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .select("id, datetime, customer_id, net_total, payment_method, customers(name)")
        .eq("id", saleId)
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();
      if (saleErr) throw saleErr;
      if (!sale) return null;

      const { data: items, error: itemsErr } = await supabase
        .from("sale_items")
        .select("id, product_id, quantity, unit_price, total, products(name)")
        .eq("sale_id", saleId);
      if (itemsErr) throw itemsErr;

      const itemIds = (items || []).map((i: any) => i.id);
      let returnedMap: Record<string, number> = {};
      if (itemIds.length > 0) {
        const { data: returned, error: rErr } = await supabase
          .from("sale_return_items")
          .select("sale_item_id, quantity")
          .in("sale_item_id", itemIds);
        if (rErr) throw rErr;
        returnedMap = (returned || []).reduce((acc: any, r: any) => {
          acc[r.sale_item_id] = (acc[r.sale_item_id] || 0) + Number(r.quantity);
          return acc;
        }, {});
      }

      return {
        id: sale.id,
        datetime: sale.datetime,
        customer_id: sale.customer_id,
        customer_name: (sale.customers as any)?.name ?? null,
        net_total: Number(sale.net_total),
        payment_method: sale.payment_method,
        items: (items || []).map((i: any) => {
          const already = returnedMap[i.id] || 0;
          return {
            id: i.id,
            product_id: i.product_id,
            product_name: i.products?.name ?? "Produto",
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
            total: Number(i.total),
            already_returned: already,
            returnable: Math.max(0, Number(i.quantity) - already),
          };
        }),
      };
    },
    enabled: !!saleId && !!currentTenant,
  });
}

export function useRecentSalesForReturn(search: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["recent_sales_for_return", currentTenant?.id, search],
    queryFn: async () => {
      if (!currentTenant) return [];
      let query = supabase
        .from("sales")
        .select("id, datetime, net_total, payment_method, customers(name)")
        .eq("tenant_id", currentTenant.id)
        .order("datetime", { ascending: false })
        .limit(30);

      if (search.trim().length >= 4) {
        // Try match by id prefix
        query = query.ilike("id", `${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentTenant,
  });
}

export function useProcessReturn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProcessReturnInput) => {
      const { data, error } = await supabase.rpc("process_sale_return", {
        p_sale_id: input.sale_id,
        p_reason: input.reason,
        p_reason_type: input.reason_type,
        p_refund_method: input.refund_method,
        p_notes: input.notes ?? null,
        p_items: input.items as any,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sale_returns"] });
      queryClient.invalidateQueries({ queryKey: ["sale_for_return"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customer_credits"] });
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      queryClient.invalidateQueries({ queryKey: ["cash_session"] });
      toast.success("Devolução registrada com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}
