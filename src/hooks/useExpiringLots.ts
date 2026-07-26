import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export function useExpiringLots(days = 30) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["expiring_lots", currentTenant?.id, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_expiring_lots", { _days: days });
      if (error) throw error;
      return data as Array<{
        lot_id: string;
        product_id: string;
        product_name: string;
        lot_number: string;
        quantity: number;
        expiry_date: string;
        days_left: number;
      }>;
    },
    enabled: !!currentTenant,
  });
}

export function useWriteOffLot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lot_id, reason }: { lot_id: string; reason?: string }) => {
      const { error } = await supabase.rpc("write_off_expired_lot", {
        _lot_id: lot_id,
        _reason: reason ?? "Vencido",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expiring_lots"] });
      qc.invalidateQueries({ queryKey: ["product_lots"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Lote baixado");
    },
    onError: (e: any) => toast.error(getUserFriendlyError(e)),
  });
}
