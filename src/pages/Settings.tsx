import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ShoppingBag, FileText, Plug, ShieldCheck } from "lucide-react";
import { CompanyDataTab } from "@/components/settings/CompanyDataTab";
import { PdvSettingsTab } from "@/components/settings/PdvSettingsTab";
import { FiscalSettingsTab } from "@/components/settings/FiscalSettingsTab";
import { IntegrationsTab } from "@/components/settings/IntegrationsTab";
import { PrivacyTab } from "@/components/settings/PrivacyTab";

const Settings = () => {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "company";

  const setTab = (v: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", v);
    setParams(next, { replace: true });
  };

  return (
    <PermissionGuard permission="settings">
      <AppLayout title="Configurações">
        <div className="max-w-5xl mx-auto animate-fade-in">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-3 md:grid-cols-5 w-full">
              <TabsTrigger value="company" className="gap-2">
                <Building2 className="w-4 h-4" />
                <span className="hidden sm:inline">Empresa</span>
              </TabsTrigger>
              <TabsTrigger value="pdv" className="gap-2">
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">PDV</span>
              </TabsTrigger>
              <TabsTrigger value="fiscal" className="gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Fiscal</span>
              </TabsTrigger>
              <TabsTrigger value="integrations" className="gap-2">
                <Plug className="w-4 h-4" />
                <span className="hidden sm:inline">Integrações</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Privacidade</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="company" className="mt-6">
              <CompanyDataTab />
            </TabsContent>
            <TabsContent value="pdv" className="mt-6">
              <PdvSettingsTab />
            </TabsContent>
            <TabsContent value="fiscal" className="mt-6">
              <FiscalSettingsTab />
            </TabsContent>
            <TabsContent value="integrations" className="mt-6">
              <IntegrationsTab />
            </TabsContent>
            <TabsContent value="privacy" className="mt-6">
              <PrivacyTab />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    </PermissionGuard>
  );
};

export default Settings;
