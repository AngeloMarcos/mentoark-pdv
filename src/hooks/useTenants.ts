import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

      // Create tenant
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

      // Link user to tenant as admin
      const { error: linkError } = await supabase.from("tenant_users").insert({
        tenant_id: tenant.id,
        user_id: user.id,
        role: "admin",
      });

      if (linkError) throw linkError;

      return tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Empresa criada com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar empresa: ${error.message}`);
    },
  });
}
