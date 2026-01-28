import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface TenantUser {
  id: string;
  user_id: string;
  role: "admin" | "operator";
  created_at: string;
  email?: string;
}

export interface TenantInvitation {
  id: string;
  tenant_id: string;
  email: string;
  role: "admin" | "operator";
  invited_by: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// Hook to list tenant users
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

// Hook to update user role
export function useUpdateUserRole() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "operator" }) => {
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
      toast.success("Função atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Hook to remove user from tenant
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
      toast.success("Usuário removido com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Hook to list pending invitations
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

// Hook to create invitation
export function useCreateInvitation() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "admin" | "operator" }) => {
      if (!currentTenant) throw new Error("Nenhum tenant selecionado");

      const { data: { user } } = await supabase.auth.getUser();
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
      toast.success("Convite criado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Hook to cancel invitation
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

// Hook to accept invitation (used on AcceptInvitation page)
export function useAcceptInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) throw error;
      return data as string; // Returns tenant_id
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

// Hook to get invitation info by token
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
