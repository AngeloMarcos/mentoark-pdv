import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useIsSuperAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-super-admin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("system_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useSuperMetrics() {
  return useQuery({
    queryKey: ["super-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_get_metrics" as any);
      if (error) throw error;
      return data as {
        total_tenants: number;
        total_users: number;
        total_sales: number;
        sales_last_30d: number;
        revenue_last_30d: number;
        tenants_active_30d: number;
      };
    },
  });
}

export function useSuperTenants() {
  return useQuery({
    queryKey: ["super-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_list_tenants" as any);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

export function useCreateTenantWithAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      document?: string;
      phone?: string;
      segment?: string;
      admin_email: string;
    }) => {
      const { data, error } = await supabase.rpc("super_create_tenant_with_admin" as any, {
        p_name: input.name,
        p_document: input.document ?? null,
        p_phone: input.phone ?? null,
        p_segment: input.segment ?? null,
        p_admin_email: input.admin_email,
      });
      if (error) throw error;
      return data as { tenant_id: string; invitation_token: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["super-tenants"] });
      qc.invalidateQueries({ queryKey: ["super-metrics"] });
      const url = `${window.location.origin}/invite/${data.invitation_token}`;
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Empresa criada! Link de convite copiado para a área de transferência.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar empresa"),
  });
}
