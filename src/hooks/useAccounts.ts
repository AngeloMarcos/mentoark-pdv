import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export type AccountType = "pagar" | "receber";
export type AccountStatus = "aberta" | "paga" | "vencida" | "cancelada";

export interface Account {
  id: string;
  tenant_id: string;
  type: AccountType;
  description: string;
  amount: number;
  due_date: string;
  status: AccountStatus;
  category_id: string | null;
  party_name: string | null;
  customer_id: string | null;
  notes: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  created_by: string;
  created_at: string;
}

export interface CreateAccountInput {
  type: AccountType;
  description: string;
  amount: number;
  due_date: string;
  category_id?: string | null;
  party_name?: string | null;
  customer_id?: string | null;
  notes?: string | null;
}

/** Devolve "vencida" se a data passou e ainda está aberta. */
export function computeStatus(a: Account): AccountStatus {
  if (a.status === "paga" || a.status === "cancelada") return a.status;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(a.due_date + "T00:00:00");
  return due < today ? "vencida" : "aberta";
}

export function useAccounts(type?: AccountType) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["accounts", currentTenant?.id, type ?? "all"],
    queryFn: async () => {
      if (!currentTenant) return [];
      let q = supabase
        .from("accounts")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("due_date", { ascending: true });
      if (type) q = q.eq("type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data as Account[]).map((a) => ({ ...a, status: computeStatus(a) }));
    },
    enabled: !!currentTenant,
  });
}

export function useUpcomingAccounts(days = 7) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["accounts", "upcoming", currentTenant?.id, days],
    queryFn: async () => {
      if (!currentTenant) return [];
      const today = new Date();
      const end = new Date();
      end.setDate(today.getDate() + days);
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .in("status", ["aberta", "vencida"])
        .lte("due_date", end.toISOString().split("T")[0])
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data as Account[]).map((a) => ({ ...a, status: computeStatus(a) }));
    },
    enabled: !!currentTenant,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  const { currentTenant } = useTenant();
  return useMutation({
    mutationFn: async (input: CreateAccountInput) => {
      if (!currentTenant) throw new Error("Sem empresa");
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");
      const { data, error } = await supabase
        .from("accounts")
        .insert({
          tenant_id: currentTenant.id,
          created_by: userData.user.id,
          type: input.type,
          description: input.description,
          amount: input.amount,
          due_date: input.due_date,
          category_id: input.category_id ?? null,
          party_name: input.party_name ?? null,
          customer_id: input.customer_id ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["financial_dashboard"] });
      toast.success("Conta criada!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function usePayAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      paid_at: string;
      paid_amount: number;
      payment_method: string;
    }) => {
      const { error } = await supabase.rpc("pay_account", {
        p_account_id: input.id,
        p_paid_at: input.paid_at,
        p_paid_amount: input.paid_amount,
        p_payment_method: input.payment_method,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["financial_entries"] });
      qc.invalidateQueries({ queryKey: ["financial_dashboard"] });
      toast.success("Conta marcada como paga!");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useUpdateAccountStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AccountStatus }) => {
      const { error } = await supabase.from("accounts").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["financial_dashboard"] });
      toast.success("Status atualizado.");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["financial_dashboard"] });
      toast.success("Conta excluída.");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });
}
