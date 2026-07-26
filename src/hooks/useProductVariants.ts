import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface ProductVariant {
  id: string;
  tenant_id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  attributes: Record<string, string>;
  sale_price: number | null;
  cost_price: number | null;
  stock_current: number;
  active: boolean;
}

export function useProductVariants(productId?: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["product_variants", currentTenant?.id, productId],
    queryFn: async () => {
      if (!currentTenant) return [];
      let q = supabase.from("product_variants").select("*").eq("tenant_id", currentTenant.id);
      if (productId) q = q.eq("product_id", productId);
      const { data, error } = await q.order("sku");
      if (error) throw error;
      return (data as any[]) as ProductVariant[];
    },
    enabled: !!currentTenant,
  });
}

export function useUpsertVariant() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: Partial<ProductVariant> & { product_id: string; sku: string }) => {
      if (!currentTenant) throw new Error("Sem empresa");
      const payload: any = { tenant_id: currentTenant.id, ...input };
      const { data, error } = await supabase.from("product_variants").upsert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_variants"] });
      toast.success("Variação salva");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_variants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_variants"] });
      toast.success("Variação removida");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}
