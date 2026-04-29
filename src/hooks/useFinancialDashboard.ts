import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface FinancialDashboard {
  income: number;
  expense: number;
  balance: number;
  to_receive: number;
  to_pay: number;
}

export function useFinancialDashboard(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["financial_dashboard", currentTenant?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      if (!currentTenant) return null;
      const { data, error } = await supabase.rpc("get_financial_dashboard", {
        p_tenant_id: currentTenant.id,
        p_start: start.toISOString().split("T")[0],
        p_end: end.toISOString().split("T")[0],
      });
      if (error) throw error;
      return data as unknown as FinancialDashboard;
    },
    enabled: !!currentTenant,
  });
}

export interface MonthlyBar {
  month: string;
  income: number;
  expense: number;
}

/** Receitas vs Despesas dos últimos 6 meses */
export function useMonthlyComparison() {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["financial_monthly", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 5);
      start.setDate(1);

      const { data, error } = await supabase
        .from("financial_entries")
        .select("entry_date, type, amount")
        .eq("tenant_id", currentTenant.id)
        .gte("entry_date", start.toISOString().split("T")[0])
        .lte("entry_date", end.toISOString().split("T")[0]);
      if (error) throw error;

      const map = new Map<string, MonthlyBar>();
      for (let i = 0; i < 6; i++) {
        const d = new Date(start);
        d.setMonth(start.getMonth() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", { month: "short" });
        map.set(key, { month: label, income: 0, expense: 0 });
      }
      (data ?? []).forEach((e: any) => {
        const d = new Date(e.entry_date + "T00:00:00");
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const row = map.get(key);
        if (!row) return;
        if (e.type === "income") row.income += Number(e.amount);
        else row.expense += Number(e.amount);
      });
      return Array.from(map.values());
    },
    enabled: !!currentTenant,
  });
}
