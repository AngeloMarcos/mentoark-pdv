import { useState, useEffect, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTenant } from "@/contexts/TenantContext";
import { useCompany } from "@/contexts/CompanyContext";
import { useUpdateTenant } from "@/hooks/useTenants";
import { useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { usePaymentMethods, useSeedDefaultPaymentMethods, useTogglePaymentMethod, useUpdatePaymentMethod, PAYMENT_TYPE_LABELS } from "@/hooks/usePaymentMethods";
import { TeamMemberList } from "@/components/team/TeamMemberList";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { PendingInvitations } from "@/components/team/PendingInvitations";
import { LoyaltySettingsCard } from "@/components/loyalty/LoyaltySettingsCard";
import { SEGMENT_OPTIONS, SEGMENT_FEATURES, type FeatureConfig } from "@/components/onboarding/SegmentFeatures";
import { StepSegment } from "@/components/onboarding/steps/StepSegment";
import { Building2, Users, Palette, Save, CreditCard, Banknote, QrCode, Loader2, UserPlus, Sparkles, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";

const Settings = () => {
  const { currentTenant, refetchTenants } = useTenant();
  const { segment, features, isOnboardingCompleted } = useCompany();
  const updateTenant = useUpdateTenant();
  const updateCompanySettings = useUpdateCompanySettings();
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

  // Segment reconfiguration
  const [showSegmentDialog, setShowSegmentDialog] = useState(false);
  const [newSegment, setNewSegment] = useState("");

  // Features management
  const [showFeaturesDialog, setShowFeaturesDialog] = useState(false);
  const [editFeatures, setEditFeatures] = useState<Record<string, boolean>>({});

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

  // Segment reconfiguration
  const handleOpenSegmentDialog = () => {
    setNewSegment(segment || "");
    setShowSegmentDialog(true);
  };

  const handleSaveSegment = async () => {
    if (!newSegment) return;
    // Get default features for new segment
    const segFeatures = SEGMENT_FEATURES[newSegment] || SEGMENT_FEATURES["outro"];
    const defaultFeatures: Record<string, boolean> = {};
    segFeatures.forEach((f) => { defaultFeatures[f.key] = f.default; });

    await updateCompanySettings.mutateAsync({
      segment: newSegment,
      settings: { onboarding_completed: true, features: defaultFeatures },
    });
    refetchTenants();
    setShowSegmentDialog(false);
    toast.success("Segmento atualizado! Funcionalidades reconfiguradas.");
  };

  // Features management
  const handleOpenFeaturesDialog = () => {
    setEditFeatures({ ...features });
    setShowFeaturesDialog(true);
  };

  const handleSaveFeatures = async () => {
    await updateCompanySettings.mutateAsync({
      settings: { onboarding_completed: true, features: editFeatures },
    });
    setShowFeaturesDialog(false);
    toast.success("Funcionalidades atualizadas!");
  };

  const currentSegmentLabel = SEGMENT_OPTIONS.find((s) => s.value === segment)?.label || segment || "Não definido";

  const featureList = useMemo(() => {
    return SEGMENT_FEATURES[segment || "outro"] || SEGMENT_FEATURES["outro"];
  }, [segment]);

  const groupedFeatures = useMemo(() => {
    const map: Record<string, FeatureConfig[]> = {};
    featureList.forEach((f) => {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    });
    return map;
  }, [featureList]);

  const activeFeatureCount = Object.values(features).filter(Boolean).length;

  return (
    <AppLayout title="Configurações">
      <div className="max-w-2xl space-y-6 animate-fade-in">

        {/* Business Profile */}
        {isOnboardingCompleted && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Perfil do Negócio
              </CardTitle>
              <CardDescription>
                Segmento e funcionalidades ativas do seu PDV
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="text-sm text-muted-foreground">Segmento</p>
                  <p className="font-semibold text-foreground">{currentSegmentLabel}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenSegmentDialog}>
                  Reconfigurar
                </Button>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div>
                  <p className="text-sm text-muted-foreground">Funcionalidades ativas</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(features)
                      .filter(([, v]) => v)
                      .slice(0, 5)
                      .map(([key]) => {
                        const feat = featureList.find((f) => f.key === key);
                        return (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {feat?.label || key}
                          </Badge>
                        );
                      })}
                    {activeFeatureCount > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{activeFeatureCount - 5}
                      </Badge>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleOpenFeaturesDialog}>
                  <Settings2 className="w-4 h-4 mr-1" />
                  Gerenciar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Loyalty Program */}
        <LoyaltySettingsCard />

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

      {/* Segment Reconfiguration Dialog */}
      <Dialog open={showSegmentDialog} onOpenChange={setShowSegmentDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Reconfigurar Segmento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Ao mudar o segmento, as funcionalidades serão reconfiguradas com os padrões do novo segmento.
            </p>
            <StepSegment selected={newSegment} onSelect={setNewSegment} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowSegmentDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveSegment}
                disabled={!newSegment || updateCompanySettings.isPending}
              >
                {updateCompanySettings.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Salvar Segmento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Features Management Dialog */}
      <Dialog open={showFeaturesDialog} onOpenChange={setShowFeaturesDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Funcionalidades</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 pt-2">
            {Object.entries(groupedFeatures).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
                  {category}
                </h3>
                <div className="space-y-2">
                  {items.map((feature) => (
                    <div
                      key={feature.key}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium text-foreground">
                          {feature.label}
                        </p>
                        {feature.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {feature.description}
                          </p>
                        )}
                      </div>
                      <Switch
                        checked={!!editFeatures[feature.key]}
                        onCheckedChange={(checked) =>
                          setEditFeatures((prev) => ({ ...prev, [feature.key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setShowFeaturesDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveFeatures}
                disabled={updateCompanySettings.isPending}
              >
                {updateCompanySettings.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Settings;