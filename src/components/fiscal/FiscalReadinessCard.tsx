import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, CircleAlert, CircleDashed, ClipboardCheck, ExternalLink, Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useIbptVersion } from "@/hooks/useIbpt";
import { fiscalApi } from "@/services/fiscal/fiscalApi";
import { fiscalReadiness, isReady, type ReadinessInput, type ReadinessStatus } from "@/lib/fiscal-readiness";

const ICON: Record<ReadinessStatus, JSX.Element> = {
  ok: <CheckCircle2 className="w-5 h-5 text-success shrink-0" aria-label="Pronto" />,
  pendente: <CircleDashed className="w-5 h-5 text-destructive shrink-0" aria-label="Pendente" />,
  atencao: <CircleAlert className="w-5 h-5 text-warning shrink-0" aria-label="Atenção" />,
  manual: <Info className="w-5 h-5 text-muted-foreground shrink-0" aria-label="Conferir manualmente" />,
};

// NCM com 8 dígitos, com ou sem pontos (2202.10.00)
const NCM_OK = "^[0-9]{4}[.]?[0-9]{2}[.]?[0-9]{2}$";

/** Checklist do que falta para emitir NFC-e de verdade. */
export function FiscalReadinessCard({ onOpenTab }: { onOpenTab: (tab: string) => void }) {
  const { currentTenant } = useTenant();
  const { settings } = useCompanySettings();
  const fiscal = (settings.fiscal || {}) as ReadinessInput["fiscal"];
  const { data: ibpt } = useIbptVersion();

  const { data: products } = useQuery({
    queryKey: ["fiscal-readiness", "products", currentTenant?.id],
    enabled: !!currentTenant,
    queryFn: async () => {
      const base = () =>
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", currentTenant!.id)
          .eq("active", true)
          .is("deleted_at", null);
      const [all, valid] = await Promise.all([base(), base().filter("ncm", "match", NCM_OK)]);
      if (all.error) throw all.error;
      if (valid.error) throw valid.error;
      return { active: all.count ?? 0, withValidNcm: valid.count ?? 0 };
    },
  });

  const isFocus = fiscal.provider === "focus_nfe";
  const { data: credentials, isLoading: credLoading } = useQuery({
    queryKey: ["fiscal-readiness", "credentials", currentTenant?.id],
    enabled: !!currentTenant && isFocus,
    retry: false,
    queryFn: () => fiscalApi.getCredentials(currentTenant!.id).catch((e: Error) => e),
  });

  const items = fiscalReadiness({
    fiscal,
    credentials: isFocus ? (credentials ?? null) : null,
    products: products ?? null,
    ibpt: ibpt ? { uf: ibpt.uf, vigencia_fim: ibpt.vigencia_fim, total_rows: ibpt.total_rows } : null,
  });
  const ready = isReady(items);
  const pending = items.filter((i) => i.status === "pendente").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ClipboardCheck className="w-5 h-5" /> Prontidão para emitir NFC-e
          <Badge variant={ready ? "default" : "secondary"} className="ml-auto">
            {ready ? "Pronto" : `${pending} pendência(s)`}
          </Badge>
        </CardTitle>
        <CardDescription>
          O que falta para a nota sair de verdade na SEFAZ. Itens em azul você confere no painel da Focus.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-3">
              {item.id === "tokens" && credLoading ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : ICON[item.status]}
              <div className="flex-1 min-w-0">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
              {item.action?.tab && (
                <Button size="sm" variant="outline" onClick={() => onOpenTab(item.action!.tab!)}>
                  {item.action.label}
                </Button>
              )}
              {item.action?.href?.startsWith("/") && (
                <Button size="sm" variant="outline" asChild>
                  <Link to={item.action.href}>{item.action.label}</Link>
                </Button>
              )}
              {item.action?.href?.startsWith("http") && (
                <Button size="sm" variant="outline" asChild>
                  <a href={item.action.href} target="_blank" rel="noreferrer">
                    {item.action.label} <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
