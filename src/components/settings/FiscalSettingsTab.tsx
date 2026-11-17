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
import { ReformaTributariaCard } from "@/components/settings/ReformaTributariaCard";
import { FocusCredentialsCard } from "@/components/settings/FocusCredentialsCard";
import { normalizeTaxConfig } from "@/lib/tax/engine";

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
  /** Legado: o CSC agora é cadastrado na Focus, não no PDV. */
  token_csc?: string;
  id_csc?: string;
  provider?: "simulado" | "focus_nfe";
  cfop_padrao?: string;
  csosn_padrao?: string;
  pis_cofins_cst_padrao?: string;
  ambiente?: "homologacao" | "producao";
  environment?: "homologacao" | "producao";
  uf?: string;
  municipio_ibge?: string;
  emite_nfce?: boolean;
  emite_sat?: boolean;
  /** Reforma tributária: IBS/CBS/IS (ver src/lib/tax/engine.ts) */
  reforma?: unknown;
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
      reforma: normalizeTaxConfig(fiscal.reforma),
      provider: fiscal.provider || "simulado",
    };
    // CSC não fica mais no navegador (ver migração 20261117120000)
    delete normalized.token_csc;
    delete normalized.id_csc;
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
              <Label>Provedor de emissão</Label>
              <Select
                value={fiscal.provider || "simulado"}
                onValueChange={(v) => update({ provider: v as FiscalSettings["provider"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="simulado">Simulado (sem validade fiscal)</SelectItem>
                  <SelectItem value="focus_nfe">Focus NFe (emissão real na SEFAZ)</SelectItem>
                </SelectContent>
              </Select>
              {fiscal.provider === "focus_nfe" && (
                <p className="text-xs text-muted-foreground">
                  Série, numeração e CSC passam a ser controlados no cadastro da empresa na Focus.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>CFOP padrão</Label>
              <Input
                value={fiscal.cfop_padrao || ""}
                onChange={(e) => update({ cfop_padrao: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                placeholder="5102"
              />
            </div>
            <div className="space-y-2">
              <Label>CSOSN padrão (Simples)</Label>
              <Input
                value={fiscal.csosn_padrao || ""}
                onChange={(e) => update({ csosn_padrao: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                placeholder="102"
              />
            </div>
            <div className="space-y-2">
              <Label>CST PIS/COFINS padrão</Label>
              <Input
                value={fiscal.pis_cofins_cst_padrao || ""}
                onChange={(e) => update({ pis_cofins_cst_padrao: e.target.value.replace(/\D/g, "").slice(0, 2) })}
                placeholder="49"
              />
              <p className="text-xs text-muted-foreground">
                Usados quando o produto não tem o dado próprio. Confirme com o contador.
              </p>
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

      {fiscal.provider === "focus_nfe" && <FocusCredentialsCard />}

      <ReformaTributariaCard
        value={normalizeTaxConfig(fiscal.reforma)}
        onChange={(reforma) => update({ reforma })}
      />

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
