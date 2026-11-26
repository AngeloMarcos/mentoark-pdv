import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShoppingCart, Save, Loader2, Scale } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";
import { formatBRL } from "@/lib/utils";
import { normalizeScaleConfig, parseScaleBarcode, type ScaleBarcodeConfig } from "@/lib/weighing";

interface PdvSettings {
  auto_open_cash?: boolean;
  auto_print_receipt?: boolean;
  session_timeout_minutes?: number;
  ask_customer_on_sale?: boolean;
  block_negative_stock?: boolean;
  default_payment_method?: string;
  scale_barcode?: Partial<ScaleBarcodeConfig>;
}

export function PdvSettingsTab() {
  const { settings } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [pdv, setPdv] = useState<PdvSettings>({});

  useEffect(() => {
    setPdv((settings.pdv as PdvSettings) || {});
  }, [settings]);

  const update = (patch: Partial<PdvSettings>) => setPdv({ ...pdv, ...patch });

  const handleSave = async () => {
    await updateSettings.mutateAsync({ settings: { pdv } });
    toast.success("Configurações do PDV salvas!");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" /> Operação do PDV
          </CardTitle>
          <CardDescription>Comportamento padrão do ponto de venda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Toggle
            label="Abertura automática do caixa"
            description="Ao iniciar o PDV, abre o caixa automaticamente com saldo zero se não houver sessão aberta."
            checked={!!pdv.auto_open_cash}
            onChange={(v) => update({ auto_open_cash: v })}
          />
          <Toggle
            label="Impressão automática de cupom"
            description="Imprime o cupom não-fiscal logo após finalizar a venda."
            checked={!!pdv.auto_print_receipt}
            onChange={(v) => update({ auto_print_receipt: v })}
          />
          <Toggle
            label="Solicitar cliente em toda venda"
            description="Exige selecionar/pular o cliente antes de finalizar."
            checked={!!pdv.ask_customer_on_sale}
            onChange={(v) => update({ ask_customer_on_sale: v })}
          />
          <Toggle
            label="Bloquear venda com estoque negativo"
            description="Impede venda quando o estoque do produto fica abaixo de zero."
            checked={!!pdv.block_negative_stock}
            onChange={(v) => update({ block_negative_stock: v })}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <Label>Tempo de sessão inativa (minutos)</Label>
              <Input
                type="number"
                min={1}
                value={pdv.session_timeout_minutes ?? ""}
                onChange={(e) =>
                  update({ session_timeout_minutes: parseInt(e.target.value) || undefined })
                }
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">
                Após esse tempo sem atividade, o PDV pede login novamente.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Forma de pagamento padrão</Label>
              <Input
                value={pdv.default_payment_method || ""}
                onChange={(e) => update({ default_payment_method: e.target.value })}
                placeholder="Ex: dinheiro, pix, cartao_credito"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <ScaleBarcodeCard
        value={normalizeScaleConfig(pdv.scale_barcode)}
        onChange={(scale_barcode) => update({ scale_barcode })}
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar PDV
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5 flex-1">
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Formato da etiqueta impressa pela balança (EAN-13 começando com 2). */
function ScaleBarcodeCard({
  value,
  onChange,
}: {
  value: ScaleBarcodeConfig;
  onChange: (v: ScaleBarcodeConfig) => void;
}) {
  const [sample, setSample] = useState("");
  const set = (patch: Partial<ScaleBarcodeConfig>) => onChange({ ...value, ...patch });
  const fill = 13 - 1 - value.prefix.length - value.code_length - value.value_length;
  const layout =
    value.prefix +
    "C".repeat(value.code_length) +
    "0".repeat(Math.max(0, fill)) +
    (value.value_type === "price" ? "P" : "G").repeat(value.value_length) +
    "D";
  const parsed = sample.trim() ? parseScaleBarcode(sample, { ...value, enabled: true }) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Scale className="w-5 h-5" /> Etiqueta da balança
        </CardTitle>
        <CardDescription>
          Para açougue, padaria e hortifrúti: o PDV lê o código impresso pela balança e lança o produto
          com o peso. O código do produto na etiqueta deve ser o <strong>código interno</strong> do cadastro.
          Produtos com unidade KG, L ou M pedem o peso ao serem escolhidos na lista.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <Toggle
          label="Ler etiquetas da balança"
          description="Use o mesmo formato configurado na sua balança (veja o manual ou uma etiqueta impressa)."
          checked={value.enabled}
          onChange={(enabled) => set({ enabled })}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label>Prefixo</Label>
            <Input
              inputMode="numeric"
              maxLength={2}
              value={value.prefix}
              onChange={(e) => set({ prefix: e.target.value.replace(/\D/g, "") || "2" })}
            />
          </div>
          <div className="space-y-2">
            <Label>Dígitos do código</Label>
            <Select value={String(value.code_length)} onValueChange={(v) => set({ code_length: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>A etiqueta traz</Label>
            <Select value={value.value_type} onValueChange={(v) => set({ value_type: v as ScaleBarcodeConfig["value_type"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="price">Preço total</SelectItem>
                <SelectItem value="weight">Peso (gramas)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Dígitos do valor</Label>
            <Select value={String(value.value_length)} onValueChange={(v) => set({ value_length: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Formato: <code className="font-mono tracking-widest">{layout}</code> — C = código do produto,{" "}
          {value.value_type === "price" ? "P = preço em centavos" : "G = peso em gramas"}, D = dígito verificador.
          {fill < 0 && <span className="text-destructive"> Os campos passam de 13 dígitos; reduza os tamanhos.</span>}
        </p>

        <div className="space-y-2">
          <Label htmlFor="scale-sample">Testar com uma etiqueta</Label>
          <Input
            id="scale-sample"
            inputMode="numeric"
            placeholder="Leia ou digite o código de uma etiqueta impressa"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
          />
          {sample.trim() && (
            <p className={parsed ? "text-sm text-success" : "text-sm text-destructive"}>
              {parsed
                ? `Produto código ${parsed.productCode} — ${
                    parsed.price !== undefined
                      ? `preço ${formatBRL(parsed.price)}`
                      : `peso ${parsed.weight!.toLocaleString("pt-BR", { minimumFractionDigits: 3 })} kg`
                  }`
                : "Esta etiqueta não confere com o formato acima (tamanho, prefixo ou dígito verificador)."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
