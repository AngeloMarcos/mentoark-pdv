import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface Employee {
  id: string;
  tenant_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export function useEmployees(activeOnly = true) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["employees", currentTenant?.id, activeOnly],
    queryFn: async () => {
      if (!currentTenant) return [];
      let query = supabase
        .from("employees")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("name");

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: { name: string; role?: string; phone?: string }) => {
      if (!currentTenant) throw new Error("Sem empresa selecionada");
      const { data, error } = await supabase
        .from("employees")
        .insert({
          tenant_id: currentTenant.id,
          name: input.name,
          role: input.role || "atendente",
          phone: input.phone || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário cadastrado!");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar: " + error.message);
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; role: string; phone: string; active: boolean }> }) => {
      const { error } = await supabase
        .from("employees")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success("Funcionário removido!");
    },
    onError: (error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });
}
