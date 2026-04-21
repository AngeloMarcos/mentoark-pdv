import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface Supplier {
  id: string;
  tenant_id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  payment_terms: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SupplierInput {
  name: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  notes?: string | null;
  active?: boolean;
}

export function useSuppliers(includeInactive = false) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["suppliers", currentTenant?.id, includeInactive],
    queryFn: async () => {
      if (!currentTenant) return [];
      let query = supabase
        .from("suppliers")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("name");
      if (!includeInactive) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      return data as Supplier[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: SupplierInput) => {
      if (!currentTenant) throw new Error("Sem empresa selecionada");
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...input, tenant_id: currentTenant.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor criado com sucesso!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: Partial<SupplierInput> }) => {
      const { data, error } = await supabase
        .from("suppliers")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor atualizado!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Fornecedor excluído");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}
