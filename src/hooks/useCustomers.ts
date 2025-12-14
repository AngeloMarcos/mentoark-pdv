import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError, sanitizeSearchTerm } from "@/lib/error-handler";

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  phone: string | null;
  document: string | null;
  email: string | null;
  notes: string | null;
  created_at: string | null;
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
        // Sanitize search input to prevent SQL wildcard manipulation
        const sanitized = sanitizeSearchTerm(searchTerm);
        query = query.or(`name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%,document.ilike.%${sanitized}%`);
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

      if (!input.name?.trim()) {
        throw new Error("Nome é obrigatório");
      }

      const { data, error } = await supabase
        .from("customers")
        .insert({
          name: input.name.trim(),
          phone: input.phone?.trim() || null,
          document: input.document?.trim() || null,
          email: input.email?.trim() || null,
          notes: input.notes?.trim() || null,
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
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerInput }) => {
      if (!data.name?.trim()) {
        throw new Error("Nome é obrigatório");
      }

      const { data: updated, error } = await supabase
        .from("customers")
        .update({
          name: data.name.trim(),
          phone: data.phone?.trim() || null,
          document: data.document?.trim() || null,
          email: data.email?.trim() || null,
          notes: data.notes?.trim() || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente atualizado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Cliente excluído com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}