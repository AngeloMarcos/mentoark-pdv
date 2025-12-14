import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface DailySales {
  date: string;
  label: string;
  total: number;
  count: number;
}

export function useSalesLast7Days() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["sales-chart", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const days: DailySales[] = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();

        const { data, error } = await supabase
          .from("sales")
          .select("net_total")
          .eq("tenant_id", currentTenant.id)
          .gte("datetime", start)
          .lte("datetime", end);

        if (error) throw error;

        const total = data?.reduce((sum, sale) => sum + Number(sale.net_total), 0) || 0;
        const count = data?.length || 0;

        days.push({
          date: format(date, "yyyy-MM-dd"),
          label: format(date, "EEE", { locale: ptBR }),
          total,
          count,
        });
      }

      return days;
    },
    enabled: !!currentTenant,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useRecentSales(limit = 5) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["recent-sales", currentTenant?.id, limit],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("sales")
        .select("id, datetime, net_total, payment_method")
        .eq("tenant_id", currentTenant.id)
        .order("datetime", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant,
  });
}
