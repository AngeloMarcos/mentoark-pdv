import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useExportMyData() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("export_my_data" as any);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Seus dados foram exportados.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao exportar dados"),
  });
}

export function useMyDeletionRequest() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["deletion-request", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("account_deletion_requests" as any)
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });
}

export function useRequestAccountDeletion() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (reason: string) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("account_deletion_requests" as any)
        .insert({ user_id: user.id, reason } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deletion-request"] });
      toast.success("Solicitação de exclusão registrada. Responderemos em até 15 dias.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao registrar solicitação"),
  });
}

export function useRecordConsent() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { consent_type: string; version: string; accepted: boolean }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("user_consents" as any)
        .insert({
          user_id: user.id,
          consent_type: input.consent_type,
          version: input.version,
          accepted: input.accepted,
          user_agent: navigator.userAgent,
        } as any);
      if (error) throw error;
    },
  });
}
