import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface CustomerPointsMovement {
  id: string;
  tenant_id: string;
  customer_id: string;
  points: number;
  movement_type: "earn" | "redeem" | "expire" | "manual";
  sale_id: string | null;
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface LoyaltySettings {
  loyalty_enabled: boolean;
  loyalty_points_per_currency: number;
  loyalty_currency_per_points: number;
  loyalty_min_redeem_points: number;
  loyalty_points_expiration_days: number;
}

const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  loyalty_enabled: false,
  loyalty_points_per_currency: 10,
  loyalty_currency_per_points: 100,
  loyalty_min_redeem_points: 100,
  loyalty_points_expiration_days: 365,
};

// Hook para buscar saldo de pontos de um cliente
export function useCustomerPoints(customerId: string | null | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["customer-points", customerId],
    queryFn: async () => {
      if (!customerId) return 0;

      const { data, error } = await supabase.rpc("get_customer_points", {
        p_customer_id: customerId,
      });

      if (error) throw error;
      return (data as number) || 0;
    },
    enabled: !!customerId && !!currentTenant,
  });
}

// Hook para buscar histórico de movimentações de pontos
export function usePointsHistory(customerId: string | null | undefined) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["points-history", customerId],
    queryFn: async () => {
      if (!customerId || !currentTenant) return [];

      const { data, error } = await supabase
        .from("customer_points")
        .select("*")
        .eq("customer_id", customerId)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as CustomerPointsMovement[];
    },
    enabled: !!customerId && !!currentTenant,
  });
}

// Hook para resgatar pontos
export function useRedeemPoints() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      points,
      description,
    }: {
      customerId: string;
      points: number;
      description?: string;
    }) => {
      if (!currentTenant) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.rpc("redeem_loyalty_points", {
        p_tenant_id: currentTenant.id,
        p_customer_id: customerId,
        p_points: points,
        p_description: description || "Resgate de pontos",
      });

      if (error) throw error;
      return data as number;
    },
    onSuccess: (discountValue, { customerId }) => {
      queryClient.invalidateQueries({ queryKey: ["customer-points", customerId] });
      queryClient.invalidateQueries({ queryKey: ["points-history", customerId] });
      toast.success(`Pontos resgatados! Desconto de R$ ${discountValue.toFixed(2)}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao resgatar pontos");
    },
  });
}

// Hook para adicionar pontos manualmente
export function useAddManualPoints() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      points,
      description,
    }: {
      customerId: string;
      points: number;
      description: string;
    }) => {
      if (!currentTenant) throw new Error("Tenant não selecionado");

      const { error } = await supabase.from("customer_points").insert({
        tenant_id: currentTenant.id,
        customer_id: customerId,
        points: Math.abs(points),
        movement_type: "manual",
        description,
        expires_at: null, // Pontos manuais não expiram por padrão
      });

      if (error) throw error;
    },
    onSuccess: (_, { customerId, points }) => {
      queryClient.invalidateQueries({ queryKey: ["customer-points", customerId] });
      queryClient.invalidateQueries({ queryKey: ["points-history", customerId] });
      toast.success(`${points > 0 ? "Adicionados" : "Removidos"} ${Math.abs(points)} pontos`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao ajustar pontos");
    },
  });
}

// Hook para buscar configurações de fidelidade do tenant
export function useLoyaltySettings() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["loyalty-settings", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return DEFAULT_LOYALTY_SETTINGS;

      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", currentTenant.id)
        .single();

      if (error) throw error;

      const settings = data?.settings as Record<string, unknown> | null;

      return {
        loyalty_enabled: (settings?.loyalty_enabled as boolean) ?? DEFAULT_LOYALTY_SETTINGS.loyalty_enabled,
        loyalty_points_per_currency:
          (settings?.loyalty_points_per_currency as number) ?? DEFAULT_LOYALTY_SETTINGS.loyalty_points_per_currency,
        loyalty_currency_per_points:
          (settings?.loyalty_currency_per_points as number) ?? DEFAULT_LOYALTY_SETTINGS.loyalty_currency_per_points,
        loyalty_min_redeem_points:
          (settings?.loyalty_min_redeem_points as number) ?? DEFAULT_LOYALTY_SETTINGS.loyalty_min_redeem_points,
        loyalty_points_expiration_days:
          (settings?.loyalty_points_expiration_days as number) ?? DEFAULT_LOYALTY_SETTINGS.loyalty_points_expiration_days,
      } as LoyaltySettings;
    },
    enabled: !!currentTenant,
  });
}

// Hook para atualizar configurações de fidelidade
export function useUpdateLoyaltySettings() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newSettings: Partial<LoyaltySettings>) => {
      if (!currentTenant) throw new Error("Tenant não selecionado");

      // Buscar settings atuais
      const { data: tenantData, error: fetchError } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", currentTenant.id)
        .single();

      if (fetchError) throw fetchError;

      const currentSettings = (tenantData?.settings as Record<string, unknown>) || {};

      // Mesclar settings
      const updatedSettings = {
        ...currentSettings,
        ...newSettings,
      };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: updatedSettings })
        .eq("id", currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyalty-settings", currentTenant?.id] });
      toast.success("Configurações de fidelidade atualizadas");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao atualizar configurações");
    },
  });
}

// Hook para creditar pontos em uma venda (chamado automaticamente)
export function useCreditLoyaltyPoints() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      customerId,
      saleId,
      saleAmount,
    }: {
      customerId: string;
      saleId: string;
      saleAmount: number;
    }) => {
      if (!currentTenant) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.rpc("credit_loyalty_points", {
        p_tenant_id: currentTenant.id,
        p_customer_id: customerId,
        p_sale_id: saleId,
        p_sale_amount: saleAmount,
      });

      if (error) throw error;
      return (data as number) || 0;
    },
    onSuccess: (points, { customerId }) => {
      if (points > 0) {
        queryClient.invalidateQueries({ queryKey: ["customer-points", customerId] });
        queryClient.invalidateQueries({ queryKey: ["points-history", customerId] });
        toast.success(`+${points} pontos de fidelidade!`, {
          icon: "🎁",
        });
      }
    },
  });
}

// Utilitário: calcular valor em R$ de X pontos
export function calculatePointsValue(points: number, currencyPerPoints: number): number {
  return points / currencyPerPoints;
}

// Utilitário: calcular quantos pontos para X reais
export function calculatePointsNeeded(value: number, currencyPerPoints: number): number {
  return Math.ceil(value * currencyPerPoints);
}
