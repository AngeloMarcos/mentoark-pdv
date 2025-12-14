import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTenant } from "@/contexts/TenantContext";
import { useUpdateTenant } from "@/hooks/useTenants";
import { Building2, Users, Palette, Save } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

const SEGMENTS = [
  { value: "pharmacy", label: "Farmácia" },
  { value: "market", label: "Mercado/Mercearia" },
  { value: "bar_restaurant", label: "Bar/Restaurante" },
  { value: "retail", label: "Varejo Geral" },
  { value: "other", label: "Outro" },
];

const Settings = () => {
  const { currentTenant, refetchTenants } = useTenant();
  const updateTenant = useUpdateTenant();
  const { theme, setTheme } = useTheme();

  const [tenantForm, setTenantForm] = useState({
    name: "",
    document: "",
    phone: "",
    segment: "",
  });

  useEffect(() => {
    if (currentTenant) {
      setTenantForm({
        name: currentTenant.name || "",
        document: currentTenant.document || "",
        phone: currentTenant.phone || "",
        segment: currentTenant.segment || "",
      });
    }
  }, [currentTenant]);

  const handleSaveTenant = async () => {
    if (!currentTenant) return;
    
    try {
      await updateTenant.mutateAsync({
        id: currentTenant.id,
        data: tenantForm,
      });
      refetchTenants();
      toast.success("Informações salvas com sucesso!");
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <AppLayout title="Configurações">
      <div className="max-w-2xl space-y-6 animate-fade-in">
        {/* Tenant Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Informações da Empresa
            </CardTitle>
            <CardDescription>
              Atualize as informações do seu negócio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa</Label>
              <Input
                id="name"
                value={tenantForm.name}
                onChange={(e) => setTenantForm({ ...tenantForm, name: e.target.value })}
                placeholder="Nome do seu negócio"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="document">CNPJ/CPF</Label>
                <Input
                  id="document"
                  value={tenantForm.document}
                  onChange={(e) => setTenantForm({ ...tenantForm, document: e.target.value })}
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={tenantForm.phone}
                  onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Select
                value={tenantForm.segment}
                onValueChange={(value) => setTenantForm({ ...tenantForm, segment: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o segmento" />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENTS.map((segment) => (
                    <SelectItem key={segment.value} value={segment.value}>
                      {segment.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleSaveTenant} 
              disabled={updateTenant.isPending}
              className="w-full sm:w-auto"
            >
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>

        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Aparência
            </CardTitle>
            <CardDescription>
              Personalize a aparência do sistema
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Tema Escuro</Label>
                <p className="text-sm text-muted-foreground">
                  Ativar modo escuro para melhor visualização em ambientes com pouca luz
                </p>
              </div>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
              />
            </div>
          </CardContent>
        </Card>

        {/* Team Info (Read-only for now) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Equipe
            </CardTitle>
            <CardDescription>
              Informações sobre os usuários do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                {currentTenant?.name?.charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <p className="font-medium">{currentTenant?.name}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {currentTenant?.role === "admin" ? "Administrador" : "Operador"}
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              O gerenciamento de equipe estará disponível em breve.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
