import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { AppRole, Permission, roleHasPermission } from "@/lib/permissions";

export function useCurrentRole(): { role: AppRole | null; isLoading: boolean } {
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ["current-role", currentTenant?.id, user?.id],
    queryFn: async () => {
      if (!user || !currentTenant) return null;
      const { data, error } = await supabase
        .from("tenant_users")
        .select("role")
        .eq("tenant_id", currentTenant.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.role as AppRole) ?? null;
    },
    enabled: !!user && !!currentTenant,
    staleTime: 60_000,
  });

  return { role: data ?? null, isLoading };
}

export function usePermission(permission: Permission): boolean {
  const { role } = useCurrentRole();
  return roleHasPermission(role, permission);
}
