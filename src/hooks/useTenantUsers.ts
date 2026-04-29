import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";
import { AppRole } from "@/lib/permissions";

export interface TenantUser {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
  email?: string;
}

export interface TenantMember {
  user_id: string;
  email: string | null;
  role: AppRole;
  created_at: string;
  last_seen: string | null;
}

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: AppRole;
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// List members (with email + last_seen) — admins only via RPC
export function useTenantMembers() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["tenant-members", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase.rpc("get_tenant_members", {
        p_tenant_id: currentTenant.id,
      });
      if (error) throw error;
      return (data ?? []) as TenantMember[];
    },
    enabled: !!currentTenant,
  });
}

export function useTenantUsers() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["tenant-users", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("tenant_users")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as TenantUser[];
    },
    enabled: !!currentTenant,
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      if (!currentTenant) throw new Error("Nenhum tenant selecionado");

      const { error } = await supabase
        .from("tenant_users")
        .update({ role })
        .eq("tenant_id", currentTenant.id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users", currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenant-members", currentTenant?.id] });
      toast.success("Perfil atualizado!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useRemoveTenantUser() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (userId: string) => {
      if (!currentTenant) throw new Error("Nenhum tenant selecionado");

      const { error } = await supabase
        .from("tenant_users")
        .delete()
        .eq("tenant_id", currentTenant.id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-users", currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenant-members", currentTenant?.id] });
      toast.success("Acesso revogado!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useTenantInvitations() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["tenant-invitations", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("tenant_invitations")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TenantInvitation[];
    },
    enabled: !!currentTenant,
  });
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: AppRole }) => {
      if (!currentTenant) throw new Error("Nenhum tenant selecionado");
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("tenant_invitations")
        .insert({
          tenant_id: currentTenant.id,
          email: email.toLowerCase().trim(),
          role,
          invited_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as TenantInvitation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations", currentTenant?.id] });
      toast.success("Convite criado! Compartilhe o link com o usuário.");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useCancelInvitation() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { error } = await supabase
        .from("tenant_invitations")
        .delete()
        .eq("id", invitationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-invitations", currentTenant?.id] });
      toast.success("Convite cancelado!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Convite aceito! Você agora tem acesso à empresa.");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useInvitationInfo(token: string | undefined) {
  return useQuery({
    queryKey: ["invitation-info", token],
    queryFn: async () => {
      if (!token) return null;
      const { data, error } = await supabase.rpc("get_invitation_info", { p_token: token });
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: !!token,
  });
}
