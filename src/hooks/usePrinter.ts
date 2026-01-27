import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface PrinterConfig {
  id: string;
  tenant_id: string;
  name: string;
  printer_type: "thermal" | "label" | "fiscal";
  connection_type: "usb" | "network" | "bluetooth";
  ip_address: string | null;
  port: number | null;
  paper_width: number;
  is_default: boolean;
  active: boolean;
  created_at: string;
}

export interface PrinterInput {
  name: string;
  printer_type: "thermal" | "label" | "fiscal";
  connection_type: "usb" | "network" | "bluetooth";
  ip_address?: string | null;
  port?: number | null;
  paper_width?: number;
  is_default?: boolean;
  active?: boolean;
}

export function usePrinters() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["printers", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("printer_configs")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("is_default", { ascending: false });

      if (error) throw error;
      return data as PrinterConfig[];
    },
    enabled: !!currentTenant,
  });
}

export function useDefaultPrinter(type?: "thermal" | "label" | "fiscal") {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["printers", "default", currentTenant?.id, type],
    queryFn: async () => {
      if (!currentTenant) return null;

      let query = supabase
        .from("printer_configs")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("active", true)
        .eq("is_default", true);

      if (type) {
        query = query.eq("printer_type", type);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as PrinterConfig | null;
    },
    enabled: !!currentTenant,
  });
}

export function useCreatePrinter() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: PrinterInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Se for padrão, remove o padrão anterior do mesmo tipo
      if (input.is_default) {
        await supabase
          .from("printer_configs")
          .update({ is_default: false })
          .eq("tenant_id", currentTenant.id)
          .eq("printer_type", input.printer_type);
      }

      const { data, error } = await supabase
        .from("printer_configs")
        .insert({
          tenant_id: currentTenant.id,
          ...input,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
      toast.success("Impressora configurada!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useUpdatePrinter() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async ({ id, ...input }: PrinterInput & { id: string }) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      // Se for padrão, remove o padrão anterior do mesmo tipo
      if (input.is_default) {
        await supabase
          .from("printer_configs")
          .update({ is_default: false })
          .eq("tenant_id", currentTenant.id)
          .eq("printer_type", input.printer_type)
          .neq("id", id);
      }

      const { data, error } = await supabase
        .from("printer_configs")
        .update(input)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
      toast.success("Impressora atualizada!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

export function useDeletePrinter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("printer_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
      toast.success("Impressora removida!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}
