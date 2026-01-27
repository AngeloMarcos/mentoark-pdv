import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface InventoryCount {
  id: string;
  tenant_id: string;
  name: string;
  status: "draft" | "in_progress" | "completed" | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  completed_by: string | null;
  total_products: number;
  total_difference_value: number;
  notes: string | null;
  created_at: string;
}

export interface InventoryCountItem {
  id: string;
  count_id: string;
  product_id: string;
  expected_quantity: number;
  counted_quantity: number | null;
  difference: number | null;
  difference_value: number | null;
  adjustment_reason: string | null;
  counted_by: string | null;
  counted_at: string | null;
  product?: {
    name: string;
    unit: string;
    cost_price: number | null;
    barcode: string | null;
    internal_code: string | null;
  };
}

export interface CreateInventoryInput {
  name: string;
  notes?: string | null;
}

export function useInventoryCounts() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["inventory_counts", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("inventory_counts")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as InventoryCount[];
    },
    enabled: !!currentTenant,
  });
}

export function useInventoryCount(id: string | undefined) {
  return useQuery({
    queryKey: ["inventory_count", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("inventory_counts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data as InventoryCount | null;
    },
    enabled: !!id,
  });
}

export function useInventoryCountItems(countId: string | undefined) {
  return useQuery({
    queryKey: ["inventory_count_items", countId],
    queryFn: async () => {
      if (!countId) return [];

      const { data, error } = await supabase
        .from("inventory_count_items")
        .select(`
          *,
          products:product_id (name, unit, cost_price, barcode, internal_code)
        `)
        .eq("count_id", countId)
        .order("id");

      if (error) throw error;

      return data.map((item) => ({
        ...item,
        product: item.products as InventoryCountItem["product"],
      })) as InventoryCountItem[];
    },
    enabled: !!countId,
  });
}

export function useCreateInventoryCount() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateInventoryInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("inventory_counts")
        .insert({
          tenant_id: currentTenant.id,
          name: input.name,
          notes: input.notes || null,
          created_by: user.id,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;
      return data as InventoryCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_counts"] });
      toast.success("Inventário criado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useStartInventoryCount() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (countId: string) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Get all active products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, stock_current, cost_price")
        .eq("tenant_id", currentTenant.id)
        .eq("active", true);

      if (productsError) throw productsError;

      // Create count items for all products
      const items = products.map((product) => ({
        count_id: countId,
        product_id: product.id,
        expected_quantity: Number(product.stock_current) || 0,
      }));

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from("inventory_count_items")
          .insert(items);

        if (itemsError) throw itemsError;
      }

      // Update count status
      const { data, error } = await supabase
        .from("inventory_counts")
        .update({
          status: "in_progress",
          started_at: new Date().toISOString(),
          total_products: products.length,
        })
        .eq("id", countId)
        .select()
        .single();

      if (error) throw error;
      return data as InventoryCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_counts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_count_items"] });
      toast.success("Contagem iniciada!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateCountItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      itemId,
      countedQuantity,
      adjustmentReason,
    }: {
      itemId: string;
      countedQuantity: number;
      adjustmentReason?: string;
    }) => {
      // Get expected quantity to calculate difference
      const { data: item, error: fetchError } = await supabase
        .from("inventory_count_items")
        .select("expected_quantity, products:product_id (cost_price)")
        .eq("id", itemId)
        .single();

      if (fetchError) throw fetchError;

      const expectedQty = Number(item.expected_quantity) || 0;
      const difference = countedQuantity - expectedQty;
      const costPrice = Number((item.products as { cost_price: number | null })?.cost_price) || 0;
      const differenceValue = difference * costPrice;

      const { data, error } = await supabase
        .from("inventory_count_items")
        .update({
          counted_quantity: countedQuantity,
          difference,
          difference_value: differenceValue,
          adjustment_reason: adjustmentReason || null,
          counted_by: user?.id,
          counted_at: new Date().toISOString(),
        })
        .eq("id", itemId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_count_items"] });
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useCompleteInventoryCount() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (countId: string) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");
      if (!user) throw new Error("Usuário não autenticado");

      // Get all items with differences
      const { data: items, error: itemsError } = await supabase
        .from("inventory_count_items")
        .select(`
          *,
          products:product_id (name)
        `)
        .eq("count_id", countId)
        .not("difference", "eq", 0)
        .not("counted_quantity", "is", null);

      if (itemsError) throw itemsError;

      // Apply stock adjustments
      for (const item of items || []) {
        const diff = Number(item.difference) || 0;
        if (diff === 0) continue;

        // Create stock movement
        await supabase.from("stock_movements").insert({
          tenant_id: currentTenant.id,
          product_id: item.product_id,
          movement_type: diff > 0 ? "adjustment_plus" : "adjustment_minus",
          quantity: diff,
          description: `Ajuste de inventário: ${item.adjustment_reason || "Sem motivo informado"}`,
        });

        // Update stock
        if (diff > 0) {
          await supabase.rpc("increment_stock", {
            p_product_id: item.product_id,
            p_quantity: Math.abs(diff),
          });
        } else {
          await supabase.rpc("decrement_stock", {
            p_product_id: item.product_id,
            p_quantity: Math.abs(diff),
          });
        }
      }

      // Calculate total difference value
      const totalDifferenceValue = (items || []).reduce(
        (sum, item) => sum + (Number(item.difference_value) || 0),
        0
      );

      // Update count status
      const { data, error } = await supabase
        .from("inventory_counts")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          total_difference_value: totalDifferenceValue,
        })
        .eq("id", countId)
        .select()
        .single();

      if (error) throw error;
      return data as InventoryCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_counts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_count_items"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "summary"] });
      toast.success("Inventário finalizado e ajustes aplicados!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useCancelInventoryCount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (countId: string) => {
      const { data, error } = await supabase
        .from("inventory_counts")
        .update({ status: "cancelled" })
        .eq("id", countId)
        .select()
        .single();

      if (error) throw error;
      return data as InventoryCount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory_counts"] });
      toast.success("Inventário cancelado.");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function getInventoryStatusLabel(status: InventoryCount["status"]): string {
  const labels: Record<InventoryCount["status"], string> = {
    draft: "Rascunho",
    in_progress: "Em Andamento",
    completed: "Finalizado",
    cancelled: "Cancelado",
  };
  return labels[status];
}

export function getInventoryStatusColor(
  status: InventoryCount["status"]
): "default" | "secondary" | "destructive" | "outline" {
  const colors: Record<InventoryCount["status"], "default" | "secondary" | "destructive" | "outline"> = {
    draft: "outline",
    in_progress: "secondary",
    completed: "default",
    cancelled: "destructive",
  };
  return colors[status];
}
