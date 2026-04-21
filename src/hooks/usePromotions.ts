import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type DiscountType = "percentage" | "fixed";
export type PromotionScope = "all" | "category" | "products";

export interface Promotion {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  discount_type: DiscountType;
  discount_value: number;
  scope: PromotionScope;
  category: string | null;
  product_ids: string[] | null;
  min_quantity: number | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export interface PromotionInput {
  name: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;
  scope: PromotionScope;
  category?: string | null;
  product_ids?: string[] | null;
  min_quantity?: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
  active?: boolean;
}

export function usePromotions() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["promotions", currentTenant?.id],
    enabled: !!currentTenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("tenant_id", currentTenant!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Promotion[];
    },
  });
}

export function useApplicablePromotions(productId: string | null) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["promotions-applicable", currentTenant?.id, productId],
    enabled: !!currentTenant?.id && !!productId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_applicable_promotions", {
        p_tenant_id: currentTenant!.id,
        p_product_id: productId!,
      });
      if (error) throw error;
      return (data || []) as Promotion[];
    },
  });
}

export function useCreatePromotion() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: PromotionInput) => {
      if (!currentTenant?.id || !user?.id) throw new Error("Sessão inválida");
      const { data, error } = await supabase
        .from("promotions")
        .insert({
          tenant_id: currentTenant.id,
          created_by: user.id,
          name: input.name,
          description: input.description ?? null,
          discount_type: input.discount_type,
          discount_value: input.discount_value,
          scope: input.scope,
          category: input.category ?? null,
          product_ids: input.product_ids ?? null,
          min_quantity: input.min_quantity ?? 1,
          starts_at: input.starts_at ?? null,
          ends_at: input.ends_at ?? null,
          active: input.active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promoção criada");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useTogglePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("promotions")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeletePromotion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["promotions"] });
      toast.success("Promoção excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/** Calcula desconto em R$ por unidade dada uma promoção e o preço unitário. */
export function calcPromotionDiscount(
  promo: Pick<Promotion, "discount_type" | "discount_value">,
  unitPrice: number,
  quantity: number,
): number {
  const qty = Math.max(1, quantity);
  if (promo.discount_type === "percentage") {
    return +(unitPrice * qty * (promo.discount_value / 100)).toFixed(2);
  }
  // fixed = R$ off por unidade
  return +(promo.discount_value * qty).toFixed(2);
}
