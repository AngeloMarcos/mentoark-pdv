import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export function useProductKit(parentProductId?: string) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["product_kits", currentTenant?.id, parentProductId],
    queryFn: async () => {
      if (!currentTenant || !parentProductId) return [];
      const { data, error } = await supabase
        .from("product_kits")
        .select("*, child:child_product_id(id, name, sale_price, unit)")
        .eq("tenant_id", currentTenant.id)
        .eq("parent_product_id", parentProductId);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentTenant && !!parentProductId,
  });
}

export function useAddKitItem() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: { parent_product_id: string; child_product_id: string; quantity: number }) => {
      if (!currentTenant) throw new Error("Sem empresa");
      const { error } = await supabase.from("product_kits").insert({
        tenant_id: currentTenant.id,
        ...input,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_kits"] });
      toast.success("Item adicionado ao kit");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}

export function useRemoveKitItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_kits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_kits"] });
      toast.success("Item removido");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}
