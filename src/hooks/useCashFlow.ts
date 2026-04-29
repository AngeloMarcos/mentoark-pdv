import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";

export interface CashFlowRow {
  id: string;
  date: string;
  description: string;
  type: "income" | "expense";
  amount: number;
  payment_method: string | null;
  balance: number;
}

export function useCashFlow(start: Date, end: Date) {
  const { currentTenant } = useTenant();
  return useQuery({
    queryKey: ["cash_flow", currentTenant?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      if (!currentTenant) return [];
      const { data, error } = await supabase
        .from("financial_entries")
        .select("id, entry_date, type, description, amount, payment_method, created_at")
        .eq("tenant_id", currentTenant.id)
        .gte("entry_date", start.toISOString().split("T")[0])
        .lte("entry_date", end.toISOString().split("T")[0])
        .order("entry_date", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;

      let running = 0;
      return (data ?? []).map((e: any): CashFlowRow => {
        const amt = Number(e.amount);
        running += e.type === "income" ? amt : -amt;
        return {
          id: e.id,
          date: e.entry_date,
          description: e.description,
          type: e.type,
          amount: amt,
          payment_method: e.payment_method,
          balance: running,
        };
      });
    },
    enabled: !!currentTenant,
  });
}
