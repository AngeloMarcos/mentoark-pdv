import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/lib/error-handler";

export interface CashRegister {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  active: boolean;
  created_at: string;
}

export interface CashSession {
  id: string;
  tenant_id: string;
  register_id: string;
  user_id: string;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  difference_reason: string | null;
  status: "open" | "closed";
  notes: string | null;
  created_at: string;
  register?: CashRegister;
}

export interface CashMovement {
  id: string;
  tenant_id: string;
  session_id: string;
  movement_type: "opening" | "sale" | "supply" | "withdrawal" | "closing";
  payment_method: string | null;
  amount: number;
  description: string | null;
  sale_id: string | null;
  user_id: string;
  created_at: string;
}

export interface OpenCashInput {
  register_id: string;
  opening_balance: number;
  notes?: string;
}

export interface CloseCashInput {
  session_id: string;
  closing_balance: number;
  difference_reason?: string;
  notes?: string;
  discrepancy_by_method?: Record<string, { expected: number; counted: number; difference: number }>;
}

export interface CashMovementInput {
  session_id: string;
  movement_type: "supply" | "withdrawal";
  amount: number;
  description: string;
  payment_method?: string;
}

// Buscar caixas/PDVs configurados
export function useCashRegisters() {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["cash_registers", currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("cash_registers")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data as CashRegister[];
    },
    enabled: !!currentTenant,
  });
}

// Buscar sessão ativa do usuário
export function useActiveSession() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useQuery({
    queryKey: ["cash_sessions", "active", currentTenant?.id, user?.id],
    queryFn: async () => {
      if (!currentTenant || !user) return null;

      const { data, error } = await supabase
        .from("cash_sessions")
        .select(`
          *,
          register:register_id (*)
        `)
        .eq("tenant_id", currentTenant.id)
        .eq("user_id", user.id)
        .eq("status", "open")
        .maybeSingle();

      if (error) throw error;
      return data as (CashSession & { register: CashRegister }) | null;
    },
    enabled: !!currentTenant && !!user,
    refetchInterval: 30000, // Atualiza a cada 30s
  });
}

// Buscar sessões (histórico)
export function useCashSessions(limit = 50) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["cash_sessions", currentTenant?.id, limit],
    queryFn: async () => {
      if (!currentTenant) return [];

      const { data, error } = await supabase
        .from("cash_sessions")
        .select(`
          *,
          register:register_id (*)
        `)
        .eq("tenant_id", currentTenant.id)
        .order("opened_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as (CashSession & { register: CashRegister })[];
    },
    enabled: !!currentTenant,
  });
}

// Buscar movimentações de uma sessão
export function useCashMovements(sessionId?: string) {
  const { currentTenant } = useTenant();

  return useQuery({
    queryKey: ["cash_movements", sessionId],
    queryFn: async () => {
      if (!currentTenant || !sessionId) return [];

      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as CashMovement[];
    },
    enabled: !!currentTenant && !!sessionId,
  });
}

// Resumo da sessão por forma de pagamento
export function useSessionSummary(sessionId?: string) {
  const { data: movements = [] } = useCashMovements(sessionId);

  const summary = movements.reduce((acc, mov) => {
    if (mov.movement_type === "sale" && mov.payment_method) {
      acc.byPaymentMethod[mov.payment_method] = 
        (acc.byPaymentMethod[mov.payment_method] || 0) + mov.amount;
    }

    if (mov.movement_type === "supply") {
      acc.totalSupply += mov.amount;
    }

    if (mov.movement_type === "withdrawal") {
      acc.totalWithdrawal += mov.amount;
    }

    if (mov.movement_type === "sale") {
      acc.totalSales += mov.amount;
      acc.salesCount += 1;
    }

    return acc;
  }, {
    byPaymentMethod: {} as Record<string, number>,
    totalSupply: 0,
    totalWithdrawal: 0,
    totalSales: 0,
    salesCount: 0,
  });

  return summary;
}

// Abrir caixa
export function useOpenCash() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: OpenCashInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");
      if (!user) throw new Error("Usuário não autenticado");

      // Verifica se já tem sessão aberta (por usuário OU por caixa)
      const { data: existing } = await supabase
        .from("cash_sessions")
        .select("id, user_id, register_id")
        .eq("tenant_id", currentTenant.id)
        .eq("status", "open")
        .or(`user_id.eq.${user.id},register_id.eq.${input.register_id}`)
        .maybeSingle();

      if (existing) {
        throw new Error(
          existing.register_id === input.register_id
            ? "Este caixa já está aberto por outro operador"
            : "Você já possui um caixa aberto"
        );
      }

      // Cria a sessão
      const { data: session, error: sessionError } = await supabase
        .from("cash_sessions")
        .insert({
          tenant_id: currentTenant.id,
          register_id: input.register_id,
          user_id: user.id,
          opening_balance: input.opening_balance,
          notes: input.notes,
          status: "open",
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Registra movimento de abertura
      const { error: movError } = await supabase
        .from("cash_movements")
        .insert({
          tenant_id: currentTenant.id,
          session_id: session.id,
          movement_type: "opening",
          amount: input.opening_balance,
          description: "Abertura de caixa",
          user_id: user.id,
        });

      if (movError) {
        // Rollback: deleta a sessão
        await supabase.from("cash_sessions").delete().eq("id", session.id);
        throw movError;
      }

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash_sessions"] });
      toast.success("Caixa aberto com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Fechar caixa
export function useCloseCash() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CloseCashInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");
      if (!user) throw new Error("Usuário não autenticado");

      // Busca a sessão
      const { data: session, error: fetchError } = await supabase
        .from("cash_sessions")
        .select("*")
        .eq("id", input.session_id)
        .single();

      if (fetchError) throw fetchError;
      if (session.status === "closed") throw new Error("Este caixa já foi fechado");

      // Calcula saldo esperado
      const { data: expectedData } = await supabase
        .rpc("calculate_expected_balance", { p_session_id: input.session_id });

      const expectedBalance = expectedData || session.opening_balance;
      const difference = input.closing_balance - expectedBalance;

      // Valida motivo se houver diferença
      if (Math.abs(difference) >= 0.01 && !input.difference_reason) {
        throw new Error("Informe o motivo da diferença de caixa");
      }

      // Registra movimento de fechamento
      const { error: movError } = await supabase
        .from("cash_movements")
        .insert({
          tenant_id: currentTenant.id,
          session_id: input.session_id,
          movement_type: "closing",
          amount: input.closing_balance,
          description: `Fechamento de caixa${difference !== 0 ? ` (diferença: R$ ${difference.toFixed(2)})` : ""}`,
          user_id: user.id,
        });

      if (movError) throw movError;

      // Atualiza a sessão
      const { data: updated, error: updateError } = await supabase
        .from("cash_sessions")
        .update({
          closed_at: new Date().toISOString(),
          closing_balance: input.closing_balance,
          expected_balance: expectedBalance,
          difference,
          difference_reason: input.difference_reason,
          notes: input.notes,
          status: "closed",
          discrepancy_by_method: input.discrepancy_by_method ?? null,
        })
        .eq("id", input.session_id)
        .select()
        .single();

      if (updateError) throw updateError;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_movements"] });
      toast.success("Caixa fechado com sucesso!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Sangria ou Suprimento
export function useCreateCashMovement() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: CashMovementInput) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");
      if (!user) throw new Error("Usuário não autenticado");

      if (input.amount <= 0) throw new Error("Valor deve ser maior que zero");
      if (!input.description) throw new Error("Informe uma descrição");

      const { data, error } = await supabase
        .from("cash_movements")
        .insert({
          tenant_id: currentTenant.id,
          session_id: input.session_id,
          movement_type: input.movement_type,
          amount: input.amount,
          description: input.description,
          payment_method: input.payment_method,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cash_movements"] });
      const typeLabel = variables.movement_type === "supply" ? "Suprimento" : "Sangria";
      toast.success(`${typeLabel} registrado com sucesso!`);
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}

// Criar caixa/PDV
export function useCreateCashRegister() {
  const queryClient = useQueryClient();
  const { currentTenant } = useTenant();

  return useMutation({
    mutationFn: async (input: { name: string; code: string }) => {
      if (!currentTenant) throw new Error("Nenhuma empresa selecionada");

      const { data, error } = await supabase
        .from("cash_registers")
        .insert({
          tenant_id: currentTenant.id,
          name: input.name,
          code: input.code,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um caixa com este código");
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cash_registers"] });
      toast.success("Caixa configurado!");
    },
    onError: (error) => {
      toast.error(getUserFriendlyError(error));
    },
  });
}
