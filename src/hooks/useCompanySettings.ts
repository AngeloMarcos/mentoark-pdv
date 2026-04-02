import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { Json } from "@/integrations/supabase/types";

interface TenantSettings {
  onboarding_completed?: boolean;
  features?: Record<string, boolean>;
  [key: string]: unknown;
}

export function useCompanySettings() {
  const { currentTenant } = useTenant();

  const { data: tenantData, isLoading } = useQuery({
    queryKey: ["tenant-settings", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select("settings, segment")
        .eq("id", currentTenant.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant,
  });

  const settings = (tenantData?.settings as TenantSettings) || {};
  const features = settings.features || {};
  const isOnboardingCompleted = !!settings.onboarding_completed;
  const segment = tenantData?.segment || null;

  const hasFeature = (key: string): boolean => {
    return !!features[key];
  };

  return {
    settings,
    features,
    segment,
    isLoading,
    isOnboardingCompleted,
    hasFeature,
  };
}

export function useUpdateCompanySettings() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (data: {
      name?: string;
      document?: string | null;
      phone?: string | null;
      segment?: string | null;
      settings?: TenantSettings;
    }) => {
      if (!currentTenant) throw new Error("Sem empresa selecionada");

      // Merge settings with existing
      let finalSettings = data.settings;
      if (finalSettings) {
        const { data: existing } = await supabase
          .from("tenants")
          .select("settings")
          .eq("id", currentTenant.id)
          .single();

        const existingSettings = (existing?.settings as TenantSettings) || {};
        finalSettings = { ...existingSettings, ...finalSettings };
      }

      const updatePayload: Record<string, unknown> = {};
      if (data.name !== undefined) updatePayload.name = data.name;
      if (data.document !== undefined) updatePayload.document = data.document;
      if (data.phone !== undefined) updatePayload.phone = data.phone;
      if (data.segment !== undefined) updatePayload.segment = data.segment;
      if (finalSettings !== undefined) updatePayload.settings = finalSettings as unknown as Json;

      const { error } = await supabase
        .from("tenants")
        .update(updatePayload)
        .eq("id", currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings", currentTenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
    },
    onError: (error) => {
      toast.error("Erro ao salvar configurações: " + error.message);
    },
  });
}
