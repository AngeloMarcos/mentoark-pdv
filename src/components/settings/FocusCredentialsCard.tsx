import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/contexts/TenantContext";
import { fiscalApi } from "@/services/fiscal/fiscalApi";
import { getUserFriendlyError } from "@/lib/error-handler";

/**
 * Tokens da Focus NFe da empresa. São gravados pelo serviço fiscal em uma
 * tabela que o navegador não lê: aqui só aparecem mascarados (••••1234).
 * Deixar um campo em branco mantém o token atual.
 */
export function FocusCredentialsCard() {
  const { currentTenant } = useTenant();
  const queryClient = useQueryClient();
  const [homolog, setHomolog] = useState("");
  const [prod, setProd] = useState("");

  const status = useQuery({
    queryKey: ["fiscal-credentials", currentTenant?.id],
    queryFn: () => fiscalApi.getCredentials(currentTenant!.id),
    enabled: !!currentTenant,
    retry: 1,
  });

  const save = useMutation({
    mutationFn: () =>
      fiscalApi.saveCredentials(currentTenant!.id, {
        ...(homolog.trim() ? { token_homologacao: homolog.trim() } : {}),
        ...(prod.trim() ? { token_producao: prod.trim() } : {}),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["fiscal-credentials", currentTenant?.id], data);
      setHomolog("");
      setProd("");
      toast.success("Tokens da Focus NFe salvos com segurança");
    },
    onError: (e) => toast.error(getUserFriendlyError(e)),
  });

  const nothingToSave = !homolog.trim() && !prod.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> Credenciais Focus NFe
        </CardTitle>
        <CardDescription>
          Tokens da empresa no painel da Focus NFe (Empresas → tokens). O certificado A1 e o CSC são
          cadastrados lá, na implantação. Os tokens ficam guardados só no servidor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando credenciais…
          </div>
        ) : status.isError ? (
          <p className="text-sm text-destructive">
            Não foi possível falar com o serviço fiscal: {getUserFriendlyError(status.error)}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Badge variant={status.data?.homologacao ? "secondary" : "outline"}>
              Homologação: {status.data?.homologacao || "não configurado"}
            </Badge>
            <Badge variant={status.data?.producao ? "default" : "outline"}>
              Produção: {status.data?.producao || "não configurado"}
            </Badge>
            {status.data?.configured && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> armazenado no servidor
              </span>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Token de homologação</Label>
            <Input
              type="password"
              autoComplete="off"
              value={homolog}
              onChange={(e) => setHomolog(e.target.value)}
              placeholder={status.data?.homologacao ? "manter o atual" : "cole o token de homologação"}
            />
          </div>
          <div className="space-y-2">
            <Label>Token de produção</Label>
            <Input
              type="password"
              autoComplete="off"
              value={prod}
              onChange={(e) => setProd(e.target.value)}
              placeholder={status.data?.producao ? "manter o atual" : "cole o token de produção"}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => save.mutate()} disabled={nothingToSave || save.isPending}>
            {save.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar tokens
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
