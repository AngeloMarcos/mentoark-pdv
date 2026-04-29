import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Save, Loader2, Image as ImageIcon } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useUpdateTenant } from "@/hooks/useTenants";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { SEGMENT_OPTIONS } from "@/components/onboarding/SegmentFeatures";
import { maskCNPJCPF, maskPhone, maskCEP } from "@/lib/br-masks";
import { toast } from "sonner";

interface AddressData {
  zip_code?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

export function CompanyDataTab() {
  const { currentTenant, refetchTenants } = useTenant();
  const { settings } = useCompanySettings();
  const updateTenant = useUpdateTenant();
  const updateSettings = useUpdateCompanySettings();

  const [form, setForm] = useState({
    name: "",
    document: "",
    phone: "",
    segment: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [address, setAddress] = useState<AddressData>({});

  useEffect(() => {
    if (currentTenant) {
      setForm({
        name: currentTenant.name || "",
        document: currentTenant.document || "",
        phone: currentTenant.phone || "",
        segment: currentTenant.segment || "",
      });
    }
  }, [currentTenant]);

  useEffect(() => {
    setLogoUrl((settings.logo_url as string) || "");
    setAddress((settings.address as AddressData) || {});
  }, [settings]);

  const handleSave = async () => {
    if (!currentTenant) return;
    try {
      await updateTenant.mutateAsync({ id: currentTenant.id, data: form });
      await updateSettings.mutateAsync({
        settings: { logo_url: logoUrl, address },
      });
      refetchTenants();
      toast.success("Dados da empresa salvos!");
    } catch {
      // handled by mutation
    }
  };

  const isSaving = updateTenant.isPending || updateSettings.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" /> Dados Cadastrais
          </CardTitle>
          <CardDescription>Identidade da empresa exibida em cupons e relatórios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Empresa</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ / CPF</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm({ ...form, document: maskCNPJCPF(e.target.value) })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                placeholder="(00) 00000-0000"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Segmento</Label>
            <Select value={form.segment} onValueChange={(v) => setForm({ ...form, segment: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {SEGMENT_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" /> Logotipo
          </CardTitle>
          <CardDescription>URL pública da logo (será exibida em cupons impressos).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL da Logo</Label>
            <Input
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          {logoUrl && (
            <div className="p-3 rounded-lg border bg-muted/40 inline-block">
              <img src={logoUrl} alt="Logo" className="h-16 object-contain" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endereço</CardTitle>
          <CardDescription>Endereço fiscal e operacional da empresa.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input
                value={address.zip_code || ""}
                onChange={(e) => setAddress({ ...address, zip_code: maskCEP(e.target.value) })}
                placeholder="00000-000"
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Rua / Logradouro</Label>
              <Input
                value={address.street || ""}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Número</Label>
              <Input
                value={address.number || ""}
                onChange={(e) => setAddress({ ...address, number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Complemento</Label>
              <Input
                value={address.complement || ""}
                onChange={(e) => setAddress({ ...address, complement: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input
                value={address.neighborhood || ""}
                onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Cidade</Label>
              <Input
                value={address.city || ""}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input
                maxLength={2}
                value={address.state || ""}
                onChange={(e) => setAddress({ ...address, state: e.target.value.toUpperCase() })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Dados da Empresa
        </Button>
      </div>
    </div>
  );
}
