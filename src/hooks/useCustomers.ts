import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  document: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerInput {
  name: string;
  phone?: string | null;
  document?: string | null;
  email?: string | null;
  notes?: string | null;
}

export function useCustomers(searchTerm?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["customers", currentTenant?.id, searchTerm],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("name");

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Customer[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: CustomerInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      const { data, error } = await supabase
        .from("customers")
        .insert({
          ...input,
          tenant_id: currentTenant.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar cliente: ${error.message}`);
    },
  });
}
