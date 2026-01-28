import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface TenantSettings {
  currency: string;
  timezone: string;
  fiscal_enabled: boolean;
  logo_url: string | null;
  address: string | null;
  email: string | null;
  receipt_footer: string | null;
  low_stock_alert_threshold: number;
  allow_negative_stock: boolean;
}

const DEFAULT_SETTINGS: TenantSettings = {
  currency: "BRL",
  timezone: "America/Sao_Paulo",
  fiscal_enabled: false,
  logo_url: null,
  address: null,
  email: null,
  receipt_footer: null,
  low_stock_alert_threshold: 10,
  allow_negative_stock: false,
};

export function useTenantSettings() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["tenant-settings", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return DEFAULT_SETTINGS;

      const { data, error } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", currentTenant.id)
        .single();

      if (error) throw error;
      
      // Merge with defaults to ensure all fields exist
      const settings = data?.settings as unknown as Partial<TenantSettings> | null;
      return { ...DEFAULT_SETTINGS, ...(settings || {}) };
    },
    enabled: !!currentTenant,
  });
}

export function useUpdateTenantSettings() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (settings: Partial<TenantSettings>) => {
      if (!currentTenant) throw new Error("Nenhum tenant selecionado");

      // Get current settings first
      const { data: current } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", currentTenant.id)
        .single();

      const currentSettings = current?.settings as unknown as Partial<TenantSettings> | null;
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...(currentSettings || {}),
        ...settings,
      };

      const { error } = await supabase
        .from("tenants")
        .update({ settings: mergedSettings })
        .eq("id", currentTenant.id);

      if (error) throw error;
      return mergedSettings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings", currentTenant?.id] });
      toast.success("Configurações salvas!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useTenantSubscription() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["tenant-subscription", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return null;

      const { data, error } = await supabase
        .from("tenants")
        .select("subscription_status, subscription_expires_at")
        .eq("id", currentTenant.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant,
  });
}
