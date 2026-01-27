import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface ProductLot {
  id: string;
  tenant_id: string;
  product_id: string;
  lot_number: string;
  manufacture_date: string | null;
  expiry_date: string | null;
  quantity: number;
  cost_price: number | null;
  status: "active" | "expired" | "blocked";
  supplier_info: string | null;
  notes: string | null;
  created_at: string;
  product?: { name: string; unit: string };
}

export interface CreateLotInput {
  product_id: string;
  lot_number: string;
  manufacture_date?: string | null;
  expiry_date?: string | null;
  quantity: number;
  cost_price?: number | null;
  supplier_info?: string | null;
  notes?: string | null;
}

export interface ExpiringProduct {
  lot_id: string;
  product_id: string;
  product_name: string;
  lot_number: string;
  expiry_date: string;
  quantity: number;
  days_until_expiry: number;
  status: "expired" | "expiring" | "ok";
}

export function useLots(productId?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["product_lots", currentTenant?.id, productId],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from("product_lots")
        .select(`
          *,
          products:product_id (name, unit)
        `)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (productId) {
        query = query.eq("product_id", productId);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data.map((item) => ({
        ...item,
        product: item.products as { name: string; unit: string } | undefined,
      })) as ProductLot[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateLot() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateLotInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Create the lot
      const { data: lot, error: lotError } = await supabase
        .from("product_lots")
        .insert({
          tenant_id: currentTenant.id,
          product_id: input.product_id,
          lot_number: input.lot_number,
          manufacture_date: input.manufacture_date || null,
          expiry_date: input.expiry_date || null,
          quantity: input.quantity,
          cost_price: input.cost_price || null,
          supplier_info: input.supplier_info || null,
          notes: input.notes || null,
          status: "active",
        })
        .select()
        .single();

      if (lotError) throw lotError;

      // Update weighted average cost if cost_price is provided
      if (input.cost_price && input.quantity > 0) {
        await supabase.rpc("update_weighted_avg_cost", {
          p_product_id: input.product_id,
          p_incoming_qty: input.quantity,
          p_incoming_cost: input.cost_price,
        });
      }

      // Increment stock
      if (input.quantity > 0) {
        await supabase.rpc("increment_stock", {
          p_product_id: input.product_id,
          p_quantity: input.quantity,
        });

        // Create stock movement
        await supabase.from("stock_movements").insert({
          tenant_id: currentTenant.id,
          product_id: input.product_id,
          movement_type: "purchase",
          quantity: input.quantity,
          description: `Entrada de lote ${input.lot_number}`,
        });
      }

      return lot;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_lots"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock", "summary"] });
      toast.success("Lote criado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateLot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<CreateLotInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("product_lots")
        .update({
          lot_number: input.lot_number,
          manufacture_date: input.manufacture_date,
          expiry_date: input.expiry_date,
          cost_price: input.cost_price,
          supplier_info: input.supplier_info,
          notes: input.notes,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_lots"] });
      toast.success("Lote atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateLotStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: "active" | "expired" | "blocked";
    }) => {
      const { data, error } = await supabase
        .from("product_lots")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_lots"] });
      queryClient.invalidateQueries({ queryKey: ["expiring_products"] });
      toast.success("Status do lote atualizado!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useExpiringProducts(daysAhead: number = 30) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["expiring_products", currentTenant?.id, daysAhead],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase.rpc("get_expiring_products", {
        p_tenant_id: currentTenant.id,
        p_days_ahead: daysAhead,
      });

      if (error) throw error;
      return data as ExpiringProduct[];
    },
    enabled: !!currentTenant,
  });
}

export function getExpiryStatusColor(daysUntilExpiry: number | null): string {
  if (daysUntilExpiry === null) return "text-muted-foreground";
  if (daysUntilExpiry < 0) return "text-destructive";
  if (daysUntilExpiry <= 15) return "text-destructive";
  if (daysUntilExpiry <= 30) return "text-yellow-500";
  return "text-green-500";
}

export function getExpiryBadgeVariant(
  daysUntilExpiry: number | null
): "destructive" | "secondary" | "outline" {
  if (daysUntilExpiry === null) return "outline";
  if (daysUntilExpiry < 0) return "destructive";
  if (daysUntilExpiry <= 15) return "destructive";
  if (daysUntilExpiry <= 30) return "secondary";
  return "outline";
}
