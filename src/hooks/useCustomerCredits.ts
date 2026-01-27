import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface CustomerCredit {
  id: string;
  tenant_id: string;
  customer_id: string;
  amount: number;
  used_amount: number;
  origin_type: "return" | "promotion" | "purchase" | "manual";
  origin_id: string | null;
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface CreateCreditInput {
  customer_id: string;
  amount: number;
  origin_type: CustomerCredit["origin_type"];
  origin_id?: string;
  description?: string;
  expires_at?: string;
}

// Listar créditos de um cliente
export function useCustomerCredits(customerId?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["customer_credits", customerId],
    queryFn: async () => {
      if (!currentTenant || !customerId) return [];

      const { data, error } = await supabase
        .from("customer_credits")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CustomerCredit[];
    },
    enabled: !!currentTenant && !!customerId,
  });
}

// Calcular crédito disponível
export function useAvailableCredit(customerId?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["customer_credits", "available", customerId],
    queryFn: async () => {
      if (!currentTenant || !customerId) return 0;

      const { data, error } = await supabase.rpc("get_available_credit", {
        p_customer_id: customerId,
      });

      if (error) throw error;
      return Number(data) || 0;
    },
    enabled: !!currentTenant && !!customerId,
  });
}

// Criar novo crédito
export function useCreateCredit() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateCreditInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      if (input.amount <= 0) throw new Error("Valor deve ser maior que zero");

      const { data, error } = await supabase
        .from("customer_credits")
        .insert({
          tenant_id: currentTenant.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data as CustomerCredit;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customer_credits", variables.customer_id] });
      toast.success("Crédito adicionado!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Utilizar crédito em uma venda
export function useUseCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ creditId, amount }: { creditId: string; amount: number }) => {
      // Busca o crédito atual
      const { data: credit, error: fetchError } = await supabase
        .from("customer_credits")
        .select("*")
        .eq("id", creditId)
        .single();

      if (fetchError) throw fetchError;

      const available = Number(credit.amount) - Number(credit.used_amount);
      if (amount > available) {
        throw new Error("Valor excede o crédito disponível");
      }

      // Atualiza o crédito
      const { data, error } = await supabase
        .from("customer_credits")
        .update({ used_amount: Number(credit.used_amount) + amount })
        .eq("id", creditId)
        .select()
        .single();

      if (error) throw error;
      return data as CustomerCredit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customer_credits", data.customer_id] });
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export const CREDIT_ORIGIN_LABELS: Record<CustomerCredit["origin_type"], string> = {
  return: "Devolução",
  promotion: "Promoção",
  purchase: "Compra",
  manual: "Manual",
};
