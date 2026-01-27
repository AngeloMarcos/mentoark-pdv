import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface PaymentMethod {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  type: "money" | "card_credit" | "card_debit" | "pix" | "voucher" | "credit" | "check";
  requires_change: boolean;
  allows_installments: boolean;
  max_installments: number;
  fee_percentage: number;
  active: boolean;
  display_order: number;
  created_at: string;
}

export interface CreatePaymentMethodInput {
  code: string;
  name: string;
  type: PaymentMethod["type"];
  requires_change?: boolean;
  allows_installments?: boolean;
  max_installments?: number;
  fee_percentage?: number;
  display_order?: number;
}

export interface SalePayment {
  payment_method_id?: string;
  payment_method_code: string;
  amount: number;
  change_amount?: number;
  installments?: number;
  authorization_code?: string;
}

// Listar formas de pagamento ativas
export function usePaymentMethods(activeOnly = true) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["payment_methods", currentTenant?.id, activeOnly],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from("payment_methods")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("display_order");

      if (activeOnly) {
        query = query.eq("active", true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as PaymentMethod[];
    },
    enabled: !!currentTenant,
  });
}

// Seed formas de pagamento padrão
export function useSeedDefaultPaymentMethods() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async () => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      const { error } = await supabase.rpc("seed_default_payment_methods", {
        p_tenant_id: currentTenant.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Formas de pagamento criadas!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Criar nova forma de pagamento
export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: CreatePaymentMethodInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      const { data, error } = await supabase
        .from("payment_methods")
        .insert({
          tenant_id: currentTenant.id,
          ...input,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma forma de pagamento com este código");
        }
        throw error;
      }
      return data as PaymentMethod;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Forma de pagamento criada!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Atualizar forma de pagamento
export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreatePaymentMethodInput> }) => {
      const { data: updated, error } = await supabase
        .from("payment_methods")
        .update(data)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return updated as PaymentMethod;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Forma de pagamento atualizada!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Toggle ativo/inativo
export function useTogglePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await supabase
        .from("payment_methods")
        .update({ active })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as PaymentMethod;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success(variables.active ? "Forma de pagamento ativada!" : "Forma de pagamento desativada!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Ícones por tipo de pagamento
export const PAYMENT_TYPE_ICONS: Record<PaymentMethod["type"], string> = {
  money: "Banknote",
  card_credit: "CreditCard",
  card_debit: "CreditCard",
  pix: "QrCode",
  voucher: "Ticket",
  credit: "FileText",
  check: "FileCheck",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentMethod["type"], string> = {
  money: "Dinheiro",
  card_credit: "Cartão de Crédito",
  card_debit: "Cartão de Débito",
  pix: "PIX",
  voucher: "Vale/Voucher",
  credit: "Crediário",
  check: "Cheque",
};
