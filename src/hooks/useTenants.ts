import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface CreateTenantInput {
  name: string;
  document?: string | null;
  phone?: string | null;
  segment?: string | null;
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateTenantInput) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { data: tenant, error: tenantError } = await supabase
        .rpc("create_tenant_for_user", {
          p_name: input.name,
          p_document: input.document || null,
          p_phone: input.phone || null,
          p_segment: input.segment || null,
        });

      if (tenantError) throw tenantError;

      return tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Empresa criada com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateTenantInput }) => {
      const { data: updated, error } = await supabase
        .from("tenants")
        .update({
          name: data.name,
          document: data.document || null,
          phone: data.phone || null,
          segment: data.segment || null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Empresa atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}