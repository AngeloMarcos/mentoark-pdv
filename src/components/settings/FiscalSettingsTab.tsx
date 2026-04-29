import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Loader2, AlertTriangle } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { maskCpfCnpj } from "@/lib/br-masks";
import { toast } from "sonner";

interface FiscalSettings {
  emitter_cnpj?: string;
  nfce_series?: string;
  nfce_number?: number;
  environment?: "homologacao" | "producao";
  tax_regime?: string;
  state_registration?: string;
  municipal_registration?: string;
  cnae?: string;
}

const TAX_REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "simples_excesso", label: "Simples Nacional - Excesso de Sublimite" },
  { value: "lucro_presumido", label: "Lucro Presumido" },
  { value: "lucro_real", label: "Lucro Real" },
  { value: "mei", label: "MEI" },
];

export function FiscalSettingsTab() {
  const { settings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [fiscal, setFiscal] = useState<FiscalSettings>({});

  useEffect(() => {
    setFiscal((settings.fiscal as FiscalSettings) || {});
  }, [settings]);

  const update = (patch: Partial<FiscalSettings>) => setFiscal({ ...fiscal, ...patch });

  const handleSave = async () => {
    await updateSettings.mutateAsync({ settings: { fiscal } });
    toast.success("Configurações fiscais salvas!");
  };

  const isProd = fiscal.environment === "producao";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Emissão Fiscal
          </CardTitle>
          <CardDescription>
            Dados utilizados pela emissão de nota fiscal eletrônica (NFC-e/NF-e).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ Emissor</Label>
              <Input
                value={fiscal.emitter_cnpj || ""}
                onChange={(e) => update({ emitter_cnpj: maskCpfCnpj(e.target.value) })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual</Label>
              <Input
                value={fiscal.state_registration || ""}
                onChange={(e) => update({ state_registration: e.target.value })}
                placeholder="000.000.000.000"
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Municipal</Label>
              <Input
                value={fiscal.municipal_registration || ""}
                onChange={(e) => update({ municipal_registration: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CNAE Principal</Label>
              <Input
                value={fiscal.cnae || ""}
                onChange={(e) => update({ cnae: e.target.value })}
                placeholder="0000-0/00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Série da NF</Label>
              <Input
                value={fiscal.nfce_series || ""}
                onChange={(e) => update({ nfce_series: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Próximo Número</Label>
              <Input
                type="number"
                value={fiscal.nfce_number ?? ""}
                onChange={(e) => update({ nfce_number: parseInt(e.target.value) || undefined })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={fiscal.environment || "homologacao"}
                onValueChange={(v) => update({ environment: v as FiscalSettings["environment"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                  <SelectItem value="producao">Produção (real)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Regime Tributário</Label>
            <Select
              value={fiscal.tax_regime || ""}
              onValueChange={(v) => update({ tax_regime: v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o regime" /></SelectTrigger>
              <SelectContent>
                {TAX_REGIMES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Badge variant={isProd ? "destructive" : "secondary"}>
              {isProd ? "Ambiente: Produção" : "Ambiente: Homologação"}
            </Badge>
            {isProd && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Notas terão valor fiscal real
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar Configurações Fiscais
        </Button>
      </div>
    </div>
  );
}
