import { Switch } from "@/components/ui/switch";
import { SEGMENT_FEATURES, type FeatureConfig } from "../SegmentFeatures";
import { useMemo } from "react";

interface StepFeaturesProps {
  segment: string;
  features: Record<string, boolean>;
  onToggle: (key: string, value: boolean) => void;
}

export function StepFeatures({ segment, features, onToggle }: StepFeaturesProps) {
  const featureList = SEGMENT_FEATURES[segment] || SEGMENT_FEATURES["outro"];

  const grouped = useMemo(() => {
    const map: Record<string, FeatureConfig[]> = {};
    featureList.forEach((f) => {
      if (!map[f.category]) map[f.category] = [];
      map[f.category].push(f);
    });
    return map;
  }, [featureList]);

  return (
    <div className="max-w-lg mx-auto space-y-6 py-4">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-foreground">
          Personalize seu PDV
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Ative somente o que faz sentido para o seu negócio. Você pode mudar
          isso depois em Configurações.
        </p>
      </div>

      <div className="space-y-6">
        {Object.entries(grouped).map(([category, items]) => (
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
                    checked={!!features[feature.key]}
                    onCheckedChange={(checked) =>
                      onToggle(feature.key, checked)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
