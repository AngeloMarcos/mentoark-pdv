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

      // Create tenant - the auto_add_tenant_creator trigger automatically
      // adds the authenticated user as admin in tenant_users
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .insert({
          name: input.name,
          document: input.document || null,
          phone: input.phone || null,
          segment: input.segment || null,
        })
        .select()
        .single();

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