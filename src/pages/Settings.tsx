import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTenant } from "@/contexts/TenantContext";
import { useUpdateTenant } from "@/hooks/useTenants";
import { usePaymentMethods, useSeedDefaultPaymentMethods, useTogglePaymentMethod, useUpdatePaymentMethod, PAYMENT_TYPE_LABELS } from "@/hooks/usePaymentMethods";
import { TeamMemberList } from "@/components/team/TeamMemberList";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { PendingInvitations } from "@/components/team/PendingInvitations";
import { Building2, Users, Palette, Save, CreditCard, Banknote, QrCode, Loader2, UserPlus } from "lucide-react";
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
  
  // Payment methods
  const { data: paymentMethods = [], isLoading: loadingPayments } = usePaymentMethods(false);
  const seedDefaults = useSeedDefaultPaymentMethods();
  const togglePayment = useTogglePaymentMethod();
  const updatePayment = useUpdatePaymentMethod();

  const [tenantForm, setTenantForm] = useState({
    name: "",
    document: "",
    phone: "",
    segment: "",
  });

  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editFee, setEditFee] = useState<string>("");
  const [editInstallments, setEditInstallments] = useState<string>("");

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

  const handleSavePayment = async (id: string) => {
    await updatePayment.mutateAsync({
      id,
      data: {
        fee_percentage: parseFloat(editFee) || 0,
        max_installments: parseInt(editInstallments) || 1,
      },
    });
    setEditingPayment(null);
  };

  const getPaymentIcon = (type: string) => {
    switch (type) {
      case "money": return <Banknote className="w-4 h-4" />;
      case "pix": return <QrCode className="w-4 h-4" />;
      default: return <CreditCard className="w-4 h-4" />;
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

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Formas de Pagamento
            </CardTitle>
            <CardDescription>
              Configure as formas de pagamento aceitas no PDV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingPayments ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : paymentMethods.length === 0 ? (
              <div className="text-center p-4">
                <p className="text-muted-foreground mb-4">Nenhuma forma de pagamento configurada</p>
                <Button onClick={() => seedDefaults.mutate()} disabled={seedDefaults.isPending}>
                  {seedDefaults.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Criar Formas Padrão
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentMethods.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      {getPaymentIcon(pm.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{pm.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {PAYMENT_TYPE_LABELS[pm.type]}
                        </Badge>
                      </div>
                      {editingPayment === pm.id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <Input
                            type="number"
                            step="0.1"
                            className="h-8 w-24"
                            placeholder="Taxa %"
                            value={editFee}
                            onChange={(e) => setEditFee(e.target.value)}
                          />
                          {pm.allows_installments && (
                            <Input
                              type="number"
                              className="h-8 w-24"
                              placeholder="Parcelas"
                              value={editInstallments}
                              onChange={(e) => setEditInstallments(e.target.value)}
                            />
                          )}
                          <Button size="sm" onClick={() => handleSavePayment(pm.id)}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingPayment(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {pm.fee_percentage > 0 && `Taxa: ${pm.fee_percentage}%`}
                          {pm.fee_percentage > 0 && pm.allows_installments && " · "}
                          {pm.allows_installments && `Até ${pm.max_installments}x`}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingPayment !== pm.id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPayment(pm.id);
                            setEditFee(pm.fee_percentage.toString());
                            setEditInstallments(pm.max_installments.toString());
                          }}
                        >
                          Editar
                        </Button>
                      )}
                      <Switch
                        checked={pm.active}
                        onCheckedChange={(checked) =>
                          togglePayment.mutate({ id: pm.id, active: checked })
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
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

        {/* Team Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Equipe
                </CardTitle>
                <CardDescription>
                  Gerencie os membros da sua empresa
                </CardDescription>
              </div>
              {currentTenant?.role === "admin" && <InviteMemberDialog />}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="text-sm font-medium mb-3">Membros</h4>
              <TeamMemberList />
            </div>
            {currentTenant?.role === "admin" && (
              <div>
                <h4 className="text-sm font-medium mb-3">Convites Pendentes</h4>
                <PendingInvitations />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;
