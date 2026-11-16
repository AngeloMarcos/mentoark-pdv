import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Plus, Trash2 } from "lucide-react";
import {
  ALIQUOTAS_TESTE_2026,
  IS_RULE_PRESETS,
  type IsRule,
  type TaxConfig,
} from "@/lib/tax/engine";

interface Props {
  value: TaxConfig;
  onChange: (next: TaxConfig) => void;
}

const pct = (v: string) => Math.max(0, parseFloat(v.replace(",", ".")) || 0);

/** Configuração de IBS, CBS e Imposto Seletivo (tenants.settings.fiscal.reforma). */
export function ReformaTributariaCard({ value, onChange }: Props) {
  const set = (patch: Partial<TaxConfig>) => onChange({ ...value, ...patch });

  const setRule = (id: string, patch: Partial<IsRule>) =>
    set({ is_rules: value.is_rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addRule = (preset?: IsRule) =>
    set({
      is_rules: [
        ...value.is_rules,
        preset
          ? { ...preset, id: `${preset.id}-${Date.now()}` }
          : { id: `regra-${Date.now()}`, label: "", match: "ncm_prefix", value: "", aliquota: 0, active: true },
      ],
    });

  const removeRule = (id: string) => set({ is_rules: value.is_rules.filter((r) => r.id !== id) });

  const total = value.cbs + value.ibs_uf + value.ibs_mun;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Landmark className="w-5 h-5" aria-hidden="true" /> Reforma Tributária — IBS, CBS e IS
        </CardTitle>
        <CardDescription>
          EC 132/2023 e LC 214/2025. Em 2026 (ano-teste) as alíquotas são CBS 0,9% e IBS 0,1%, apenas
          destacadas no documento. Confirme com seu contador o enquadramento da empresa.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border p-3 gap-3">
          <div>
            <Label htmlFor="reforma-enabled">Calcular e destacar IBS/CBS</Label>
            <p className="text-xs text-muted-foreground">
              Mostra os tributos no PDV, inclui os grupos IBSCBS/IS no XML da NFC-e e habilita o relatório de tributos.
            </p>
          </div>
          <Switch id="reforma-enabled" checked={value.enabled} onCheckedChange={(v) => set({ enabled: v })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reforma-cbs">CBS (%)</Label>
            <Input id="reforma-cbs" type="number" step="0.0001" min="0" value={value.cbs}
              onChange={(e) => set({ cbs: pct(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reforma-ibs-uf">IBS estadual (%)</Label>
            <Input id="reforma-ibs-uf" type="number" step="0.0001" min="0" value={value.ibs_uf}
              onChange={(e) => set({ ibs_uf: pct(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reforma-ibs-mun">IBS municipal (%)</Label>
            <Input id="reforma-ibs-mun" type="number" step="0.0001" min="0" value={value.ibs_mun}
              onChange={(e) => set({ ibs_mun: pct(e.target.value) })} />
          </div>
          <div className="space-y-2">
            <Label>Forma de cálculo</Label>
            <Select value={value.modo === "por_dentro" ? "por_dentro" : "informativo"}
              onValueChange={(v) => set({ modo: v as TaxConfig["modo"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="informativo">Destaque informativo (2026)</SelectItem>
                <SelectItem value="por_dentro">Tributos incluídos no preço</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted-foreground">
            Carga IBS + CBS: <strong className="text-foreground">{total.toFixed(4).replace(".", ",")}%</strong>
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => set({ ...ALIQUOTAS_TESTE_2026 })}>
            Usar alíquotas-teste de 2026
          </Button>
        </div>

        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="text-sm font-semibold">Imposto Seletivo (IS)</h3>
            <p className="text-xs text-muted-foreground">
              Incide só sobre os produtos que casarem com uma regra ativa (ou que tenham alíquota própria no cadastro).
              O IS entra na base de cálculo do IBS e da CBS.
            </p>
          </div>

          {value.is_rules.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada.</p>
          )}

          {value.is_rules.map((rule) => (
            <div key={rule.id} className="grid grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_0.8fr_auto_auto] gap-2 items-end rounded-lg border p-3">
              <div className="space-y-1 col-span-2 md:col-span-1">
                <Label htmlFor={`is-label-${rule.id}`} className="text-xs">Descrição</Label>
                <Input id={`is-label-${rule.id}`} value={rule.label}
                  onChange={(e) => setRule(rule.id, { label: e.target.value })} placeholder="Ex.: Cigarros" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aplicar por</Label>
                <Select value={rule.match} onValueChange={(v) => setRule(rule.id, { match: v as IsRule["match"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ncm_prefix">Prefixo do NCM</SelectItem>
                    <SelectItem value="category">Categoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`is-value-${rule.id}`} className="text-xs">
                  {rule.match === "ncm_prefix" ? "NCM começa com" : "Categoria"}
                </Label>
                <Input id={`is-value-${rule.id}`} value={rule.value}
                  onChange={(e) => setRule(rule.id, { value: e.target.value })}
                  placeholder={rule.match === "ncm_prefix" ? "2402" : "Bebidas"} />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`is-aliq-${rule.id}`} className="text-xs">Alíquota (%)</Label>
                <Input id={`is-aliq-${rule.id}`} type="number" step="0.01" min="0" value={rule.aliquota}
                  onChange={(e) => setRule(rule.id, { aliquota: pct(e.target.value) })} />
              </div>
              <div className="flex items-center gap-2 h-10">
                <Switch checked={rule.active} onCheckedChange={(v) => setRule(rule.id, { active: v })}
                  aria-label={`Regra ${rule.label || rule.value} ativa`} />
              </div>
              <Button type="button" variant="ghost" size="icon" className="h-12 w-12"
                aria-label={`Remover regra ${rule.label || rule.value}`} onClick={() => removeRule(rule.id)}>
                <Trash2 className="text-destructive" aria-hidden="true" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => addRule()}>
              <Plus aria-hidden="true" /> Nova regra
            </Button>
            {IS_RULE_PRESETS.map((p) => (
              <Button key={p.id} type="button" variant="ghost" size="sm" onClick={() => addRule(p)}>
                + {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
