import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoyaltySettings, useUpdateLoyaltySettings, LoyaltySettings } from "@/hooks/useLoyalty";
import { Gift, Save, Loader2, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function LoyaltySettingsCard() {
  const { data: settings, isLoading } = useLoyaltySettings();
  const updateMutation = useUpdateLoyaltySettings();

  const [formData, setFormData] = useState<LoyaltySettings>({
    loyalty_enabled: false,
    loyalty_points_per_currency: 10,
    loyalty_currency_per_points: 100,
    loyalty_min_redeem_points: 100,
    loyalty_points_expiration_days: 365,
  });

  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const handleChange = (field: keyof LoyaltySettings, value: boolean | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(formData, {
      onSuccess: () => setHasChanges(false),
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" />
          Programa de Fidelidade
        </CardTitle>
        <CardDescription>
          Configure as regras de acúmulo e resgate de pontos para seus clientes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Toggle ativar/desativar */}
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
          <div className="space-y-0.5">
            <Label className="text-base">Ativar Programa de Fidelidade</Label>
            <p className="text-sm text-muted-foreground">
              Clientes ganham pontos automaticamente em cada compra
            </p>
          </div>
          <Switch
            checked={formData.loyalty_enabled}
            onCheckedChange={(checked) => handleChange("loyalty_enabled", checked)}
          />
        </div>

        {formData.loyalty_enabled && (
          <>
            {/* Regra de acúmulo */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="points_per_currency">Pontos por R$ 1,00</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Quantos pontos o cliente ganha a cada R$ 1 gasto</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="points_per_currency"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.loyalty_points_per_currency}
                  onChange={(e) =>
                    handleChange("loyalty_points_per_currency", parseInt(e.target.value) || 1)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ex: Cliente gasta R$ 100 = ganha {formData.loyalty_points_per_currency * 100} pontos
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="currency_per_points">Pontos para R$ 1,00</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Quantos pontos são necessários para R$ 1 de desconto</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="currency_per_points"
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.loyalty_currency_per_points}
                  onChange={(e) =>
                    handleChange("loyalty_currency_per_points", parseInt(e.target.value) || 100)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Ex: {formData.loyalty_currency_per_points} pontos = R$ 1,00 de desconto
                </p>
              </div>
            </div>

            {/* Outras configurações */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="min_redeem">Mínimo para Resgate</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Quantidade mínima de pontos para poder resgatar</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="min_redeem"
                  type="number"
                  min={1}
                  value={formData.loyalty_min_redeem_points}
                  onChange={(e) =>
                    handleChange("loyalty_min_redeem_points", parseInt(e.target.value) || 100)
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="expiration_days">Validade dos Pontos (dias)</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Pontos expiram após X dias. Use 0 para não expirar.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="expiration_days"
                  type="number"
                  min={0}
                  value={formData.loyalty_points_expiration_days}
                  onChange={(e) =>
                    handleChange("loyalty_points_expiration_days", parseInt(e.target.value) || 365)
                  }
                />
              </div>
            </div>

            {/* Preview de cálculo */}
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-sm font-medium mb-2">📊 Resumo do Programa</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • Compra de R$ 100 = <strong>{formData.loyalty_points_per_currency * 100} pontos</strong>
                </li>
                <li>
                  • {formData.loyalty_currency_per_points} pontos = <strong>R$ 1,00 desconto</strong>
                </li>
                <li>
                  • Resgate mínimo: <strong>{formData.loyalty_min_redeem_points} pontos</strong> (R${" "}
                  {(formData.loyalty_min_redeem_points / formData.loyalty_currency_per_points).toFixed(2)})
                </li>
                <li>
                  • Pontos expiram em <strong>{formData.loyalty_points_expiration_days} dias</strong>
                </li>
              </ul>
            </div>
          </>
        )}

        {/* Botão salvar */}
        {hasChanges && (
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="w-full"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
