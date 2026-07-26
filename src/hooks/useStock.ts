import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { CreateStockMovementInputSchema, validateInput } from "@/lib/validations";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  movement_type: "sale" | "purchase" | "adjustment_plus" | "adjustment_minus";
  quantity: number;
  description: string | null;
  sale_id: string | null;
  created_at: string;
  product?: {
    name: string;
    unit: string;
  };
}

export interface CreateStockMovementInput {
  product_id: string;
  movement_type: "purchase" | "adjustment_plus" | "adjustment_minus";
  quantity: number;
  description?: string;
}

export function useStockMovements(productId?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["stock_movements", currentTenant?.id, productId],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from("stock_movements")
        .select(`
          *,
          products:product_id (name, unit)
        `)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map((item) => ({
        ...item,
        product: item.products as { name: string; unit: string } | undefined,
      })) as StockMovement[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateStockMovementInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Validate input
      validateInput(CreateStockMovementInputSchema, input);

      // Determine quantity sign based on movement type
      const quantityDelta =
        input.movement_type === "purchase" || input.movement_type === "adjustment_plus"
          ? Math.abs(input.quantity)
          : -Math.abs(input.quantity);

      // Adjustments go through atomic adjust_stock RPC (locks row + logs movement)
      if (input.movement_type === "adjustment_plus" || input.movement_type === "adjustment_minus") {
        const { error: adjErr } = await supabase.rpc("adjust_stock", {
          p_product_id: input.product_id,
          p_delta: quantityDelta,
          p_reason: input.description || (quantityDelta > 0 ? "Ajuste positivo" : "Ajuste negativo"),
        });
        if (adjErr) throw adjErr;
        return { id: null, movement_type: input.movement_type, quantity: quantityDelta } as any;
      }

      // Purchase flow: insert movement + increment stock
      const { data: movement, error: movementError } = await supabase
        .from("stock_movements")
        .insert({
          tenant_id: currentTenant.id,
          product_id: input.product_id,
          movement_type: input.movement_type,
          quantity: quantityDelta,
          description: input.description || null,
        })
        .select()
        .single();

      if (movementError) throw movementError;

      try {
        const { error: stockError } = await supabase.rpc("increment_stock", {
          p_product_id: input.product_id,
          p_quantity: Math.abs(quantityDelta),
        });
        if (stockError) throw stockError;
      } catch (stockError) {
        await supabase.from("stock_movements").delete().eq("id", movement.id);
        throw stockError;
      }

      return movement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Movimentação registrada com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useStockSummary() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["stock", "summary", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return null;

      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, stock_current, min_stock, sale_price, cost_price, unit, active")
        .eq("tenant_id", currentTenant.id)
        .eq("active", true)
        .order("name");

      if (error) throw error;

      const products = data || [];
      const totalValue = products.reduce(
        (sum, p) => sum + Number(p.stock_current) * Number(p.cost_price || p.sale_price),
        0
      );
      const lowStockCount = products.filter(
        (p) => p.min_stock !== null && Number(p.stock_current) < Number(p.min_stock)
      ).length;
      const outOfStockCount = products.filter((p) => Number(p.stock_current) <= 0).length;

      return {
        products,
        totalValue,
        lowStockCount,
        outOfStockCount,
        totalProducts: products.length,
      };
    },
    enabled: !!currentTenant,
  });
}