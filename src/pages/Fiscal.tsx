import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { FiscalDocumentsTab } from "@/components/fiscal/FiscalDocumentsTab";
import { FiscalSettingsTab } from "@/components/settings/FiscalSettingsTab";
import { useGenerateFiscalDocument } from "@/hooks/useFiscalDocuments";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Fiscal() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "documentos";
  const { currentTenant } = useTenant();
  const generate = useGenerateFiscalDocument();
  const [generating, setGenerating] = useState(false);

  const handleGenerateTest = async () => {
    if (!currentTenant) return;
    setGenerating(true);
    try {
      // Pick latest sale to use as base
      const { data: sales } = await supabase
        .from("sales")
        .select("id")
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (!sales || sales.length === 0) {
        toast.error("Realize uma venda no PDV antes de gerar uma NF de teste.");
        return;
      }
      await generate.mutateAsync({ saleId: sales[0].id });
      toast.success("Documento fiscal de teste gerado!");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <PermissionGuard permission="fiscal">
      <AppLayout title="Fiscal">
        <div className="space-y-4 animate-fade-in">
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>
                Módulo em <strong>ambiente de homologação</strong>: documentos gerados são <strong>simulados</strong> e não têm validade fiscal.
              </span>
            </CardContent>
          </Card>

          <Tabs value={tab} onValueChange={(v) => setSearchParams({ tab: v })}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <TabsList>
                <TabsTrigger value="documentos">
                  <FileText className="w-4 h-4 mr-2" /> Documentos Fiscais
                </TabsTrigger>
                <TabsTrigger value="config">Configuração</TabsTrigger>
              </TabsList>

              {tab === "documentos" && (
                <Button onClick={handleGenerateTest} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Gerar NF de teste
                </Button>
              )}
            </div>

            <TabsContent value="documentos" className="mt-4">
              <FiscalDocumentsTab />
            </TabsContent>

            <TabsContent value="config" className="mt-4">
              <FiscalSettingsTab />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </PermissionGuard>
  );
}
