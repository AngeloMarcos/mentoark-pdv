import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Save, Loader2 } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";

interface PdvSettings {
  auto_open_cash?: boolean;
  auto_print_receipt?: boolean;
  session_timeout_minutes?: number;
  ask_customer_on_sale?: boolean;
  block_negative_stock?: boolean;
  default_payment_method?: string;
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
            <ShoppingBag className="w-5 h-5" /> Operação do PDV
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
