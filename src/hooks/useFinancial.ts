import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

export interface FinancialEntry {
  id: string;
  tenant_id: string;
  entry_date: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  payment_method: string | null;
  sale_id: string | null;
  created_at: string;
}

export interface CreateFinancialEntryInput {
  entry_date: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  payment_method?: string | null;
}

export function useFinancialEntries(startDate?: Date, endDate?: Date) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["financial_entries", currentTenant?.id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: async () => {
      if (!currentTenant) return [];

      let query = supabase
        .from("financial_entries")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("entry_date", startDate.toISOString().split("T")[0]);
      }
      if (endDate) {
        query = query.lte("entry_date", endDate.toISOString().split("T")[0]);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as FinancialEntry[];
    },
    enabled: !!currentTenant,
  });
}

export function useTodayFinancialSummary() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["financial_entries", "today", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return { income: 0, expense: 0, balance: 0 };

      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("entry_date", today);

      if (error) throw error;

      const entries = data as FinancialEntry[];
      const income = entries
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const expense = entries
        .filter((e) => e.type === "expense")
        .reduce((sum, e) => sum + Number(e.amount), 0);

      return {
        income,
        expense,
        balance: income - expense,
      };
    },
    enabled: !!currentTenant,
    refetchInterval: 30000,
  });
}

export function useFinancialSummary(startDate: Date, endDate: Date) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["financial_entries", "summary", currentTenant?.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      if (!currentTenant) return null;

      const { data, error } = await supabase
        .from("financial_entries")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .gte("entry_date", startDate.toISOString().split("T")[0])
        .lte("entry_date", endDate.toISOString().split("T")[0])
        .order("entry_date", { ascending: false });

      if (error) throw error;

      const entries = data as FinancialEntry[];
      const income = entries
        .filter((e) => e.type === "income")
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const expense = entries
        .filter((e) => e.type === "expense")
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const byPaymentMethod = entries.reduce(
        (acc, e) => {
          const method = e.payment_method || "outros";
          if (!acc[method]) acc[method] = { income: 0, expense: 0 };
          if (e.type === "income") acc[method].income += Number(e.amount);
          else acc[method].expense += Number(e.amount);
          return acc;
        },
        {} as Record<string, { income: number; expense: number }>
      );

      return {
        entries,
        income,
        expense,
        balance: income - expense,
        byPaymentMethod,
      };
    },
    enabled: !!currentTenant,
  });
}

export function useCreateFinancialEntry() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: CreateFinancialEntryInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      const { data, error } = await supabase
        .from("financial_entries")
        .insert({
          tenant_id: currentTenant.id,
          entry_date: input.entry_date,
          type: input.type,
          description: input.description,
          amount: input.amount,
          payment_method: input.payment_method || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Lançamento criado com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao criar lançamento: ${error.message}`);
    },
  });
}

export function useDeleteFinancialEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_entries"] });
      toast.success("Lançamento excluído com sucesso!");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir lançamento: ${error.message}`);
    },
  });
}
