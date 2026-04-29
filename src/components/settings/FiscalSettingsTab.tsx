import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Save, Loader2, AlertTriangle } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { maskCpfCnpj } from "@/lib/br-masks";
import { UF_LIST } from "@/lib/fiscal-utils";
import { toast } from "sonner";

interface FiscalSettings {
  cnpj?: string;
  emitter_cnpj?: string;
  ie?: string;
  state_registration?: string;
  municipal_registration?: string;
  cnae?: string;
  regime_tributario?: string;
  tax_regime?: string;
  crt?: string;
  serie_nfce?: string;
  nfce_series?: string;
  proximo_numero?: number;
  nfce_number?: number;
  token_csc?: string;
  id_csc?: string;
  ambiente?: "homologacao" | "producao";
  environment?: "homologacao" | "producao";
  uf?: string;
  municipio_ibge?: string;
  emite_nfce?: boolean;
  emite_sat?: boolean;
}

const TAX_REGIMES = [
  { value: "simples_nacional", label: "Simples Nacional" },
  { value: "simples_excesso", label: "Simples Nacional - Excesso" },
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
    // Normalize keys (mirror legacy + new)
    const normalized: FiscalSettings = {
      ...fiscal,
      cnpj: fiscal.cnpj || fiscal.emitter_cnpj,
      emitter_cnpj: fiscal.cnpj || fiscal.emitter_cnpj,
      ie: fiscal.ie || fiscal.state_registration,
      state_registration: fiscal.ie || fiscal.state_registration,
      serie_nfce: fiscal.serie_nfce || fiscal.nfce_series || "001",
      nfce_series: fiscal.serie_nfce || fiscal.nfce_series || "001",
      proximo_numero: fiscal.proximo_numero ?? fiscal.nfce_number ?? 1,
      nfce_number: fiscal.proximo_numero ?? fiscal.nfce_number ?? 1,
      ambiente: fiscal.ambiente || fiscal.environment || "homologacao",
      environment: fiscal.ambiente || fiscal.environment || "homologacao",
      regime_tributario: fiscal.regime_tributario || fiscal.tax_regime,
      tax_regime: fiscal.regime_tributario || fiscal.tax_regime,
    };
    await updateSettings.mutateAsync({ settings: { fiscal: normalized } });
    toast.success("Configurações fiscais salvas!");
  };

  const isProd = (fiscal.ambiente || fiscal.environment) === "producao";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" /> Emissão Fiscal
          </CardTitle>
          <CardDescription>Dados utilizados pela emissão de NFC-e e SAT.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>CNPJ Emissor</Label>
              <Input
                value={fiscal.cnpj || fiscal.emitter_cnpj || ""}
                onChange={(e) => update({ cnpj: maskCpfCnpj(e.target.value) })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Inscrição Estadual</Label>
              <Input
                value={fiscal.ie || fiscal.state_registration || ""}
                onChange={(e) => update({ ie: e.target.value })}
                placeholder="000.000.000.000"
              />
            </div>
            <div className="space-y-2">
              <Label>Regime Tributário</Label>
              <Select
                value={fiscal.regime_tributario || fiscal.tax_regime || ""}
                onValueChange={(v) => update({ regime_tributario: v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TAX_REGIMES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>CRT</Label>
              <Select value={fiscal.crt || "1"} onValueChange={(v) => update({ crt: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 - Simples Nacional</SelectItem>
                  <SelectItem value="2">2 - Simples - Excesso de Sublimite</SelectItem>
                  <SelectItem value="3">3 - Regime Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Série NFC-e</Label>
              <Input
                value={fiscal.serie_nfce || fiscal.nfce_series || ""}
                onChange={(e) => update({ serie_nfce: e.target.value })}
                placeholder="001"
              />
            </div>
            <div className="space-y-2">
              <Label>Próximo Número</Label>
              <Input
                type="number"
                value={fiscal.proximo_numero ?? fiscal.nfce_number ?? ""}
                onChange={(e) => update({ proximo_numero: parseInt(e.target.value) || undefined })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label>Ambiente</Label>
              <Select
                value={fiscal.ambiente || fiscal.environment || "homologacao"}
                onValueChange={(v) => update({ ambiente: v as FiscalSettings["ambiente"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação (testes)</SelectItem>
                  <SelectItem value="producao">Produção (real)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Token CSC</Label>
              <Input
                type="password"
                value={fiscal.token_csc || ""}
                onChange={(e) => update({ token_csc: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>ID CSC</Label>
              <Input
                value={fiscal.id_csc || ""}
                onChange={(e) => update({ id_csc: e.target.value })}
                placeholder="000001"
              />
            </div>
            <div className="space-y-2">
              <Label>UF Emitente</Label>
              <Select value={fiscal.uf || "SP"} onValueChange={(v) => update({ uf: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UF_LIST.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Código IBGE Município</Label>
              <Input
                value={fiscal.municipio_ibge || ""}
                onChange={(e) => update({ municipio_ibge: e.target.value.replace(/\D/g, "").slice(0, 7) })}
                placeholder="3550308"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Emitir NFC-e</Label>
                <p className="text-xs text-muted-foreground">Gera documento fiscal a cada venda do PDV</p>
              </div>
              <Switch
                checked={!!fiscal.emite_nfce}
                onCheckedChange={(v) => update({ emite_nfce: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Emitir SAT</Label>
                <p className="text-xs text-muted-foreground">Habilitar para estados com obrigatoriedade SAT</p>
              </div>
              <Switch
                checked={!!fiscal.emite_sat}
                onCheckedChange={(v) => update({ emite_sat: v })}
              />
            </div>
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
