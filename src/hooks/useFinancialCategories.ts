import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface FinancialCategory {
  id: string;
  tenant_id: string;
  name: string;
  type: "receita" | "despesa";
  color: string;
  created_at: string;
}

export function useFinancialCategories() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["financial_categories", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from("financial_categories")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("type")
        .order("name");
      if (error) throw error;
      return data as FinancialCategory[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateFinancialCategory() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: { name: string; type: "receita" | "despesa"; color: string }) => {
      if (!currentTenant) throw new Error("Sem empresa selecionada");
      const { data, error } = await supabase
        .from("financial_categories")
        .insert({ ...input, tenant_id: currentTenant.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_categories"] });
      toast.success("Categoria criada!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useUpdateFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; color?: string; type?: "receita" | "despesa" }) => {
      const { error } = await supabase.from("financial_categories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_categories"] });
      toast.success("Categoria atualizada!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteFinancialCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financial_categories"] });
      toast.success("Categoria excluída.");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}
