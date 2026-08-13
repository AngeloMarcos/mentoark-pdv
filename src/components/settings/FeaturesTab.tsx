import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2, Save, SlidersHorizontal } from "lucide-react";
import { useCompanySettings, useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { SEGMENT_FEATURES, type FeatureConfig } from "@/components/onboarding/SegmentFeatures";
import { toast } from "sonner";

// Módulos que dependem de um feature flag pra aparecer no menu lateral
// (ver ALL_NAV_ITEMS em src/components/layout/AppLayout.tsx). Até esta
// tela existir, não havia como reativar um módulo desligado sem refazer
// o onboarding — o que deixava "Mesas & Comandas" etc. invisíveis pra
// sempre caso o segmento errado fosse escolhido ou o toggle ficasse off.
export function FeaturesTab() {
  const { settings, segment, isLoading } = useCompanySettings();
  const updateSettings = useUpdateCompanySettings();

  const [features, setFeatures] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFeatures((settings.features as Record<string, boolean>) || {});
  }, [settings]);

  const featureList = SEGMENT_FEATURES[segment || ""] || SEGMENT_FEATURES["outro"];

  const grouped = useMemo(() => {
    const map: Record<string, FeatureConfig[]> = {};
    featureList.forEach((f) => {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    });
    return map;
  }, [featureList]);

  const toggle = (key: string, value: boolean) =>
    setFeatures((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    await updateSettings.mutateAsync({ settings: { features } });
    toast.success("Funcionalidades atualizadas!");
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" /> Funcionalidades
          </CardTitle>
          <CardDescription>
            Ative ou desative módulos do sistema. Um módulo desligado some do menu
            lateral para todos os usuários da empresa — inclusive Mesas &amp; Comandas,
            Cozinha e Delivery.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {items.map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{feature.label}</p>
                      {feature.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {feature.description}
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={!!features[feature.key]}
                      onCheckedChange={(checked) => toggle(feature.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar funcionalidades
        </Button>
      </div>
    </div>
  );
}
