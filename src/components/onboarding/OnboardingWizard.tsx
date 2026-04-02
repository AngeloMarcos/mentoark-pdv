import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Loader2, Zap } from "lucide-react";
import { StepWelcome } from "./steps/StepWelcome";
import { StepBusinessInfo } from "./steps/StepBusinessInfo";
import { StepSegment } from "./steps/StepSegment";
import { StepFeatures } from "./steps/StepFeatures";
import { getDefaultFeatures } from "./SegmentFeatures";
import { useUpdateCompanySettings } from "@/hooks/useCompanySettings";
import { useTenant } from "@/contexts/TenantContext";
import { toast } from "sonner";

const TOTAL_STEPS = 4;

export function OnboardingWizard() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const updateSettings = useUpdateCompanySettings();
  const { currentTenant, refetchTenants } = useTenant();

  const [business, setBusiness] = useState({
    name: currentTenant?.name || "",
    document: currentTenant?.document || "",
    phone: currentTenant?.phone || "",
    address: "",
  });
  const [segment, setSegment] = useState("");
  const [features, setFeatures] = useState<Record<string, boolean>>({});

  const handleSegmentSelect = useCallback((seg: string) => {
    setSegment(seg);
    setFeatures(getDefaultFeatures(seg));
  }, []);

  const handleFeatureToggle = useCallback((key: string, value: boolean) => {
    setFeatures((prev) => ({ ...prev, [key]: value }));
  }, []);

  const canAdvance = () => {
    switch (step) {
      case 2:
        return business.name.trim().length >= 2;
      case 3:
        return !!segment;
      default:
        return true;
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      await updateSettings.mutateAsync({
        name: business.name.trim(),
        document: business.document || null,
        phone: business.phone || null,
        segment,
        settings: {
          onboarding_completed: true,
          features,
          address: business.address || null,
        },
      });
      refetchTenants();
      toast.success(`Seu PDV está pronto! Bem-vindo, ${business.name} 🚀`);
    } catch {
      setSaving(false);
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground text-sm">
              Nexus Retail Cloud
            </span>
            <span className="text-xs text-muted-foreground ml-auto">
              Etapa {step} de {TOTAL_STEPS}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-6">
        {step === 1 && <StepWelcome onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepBusinessInfo data={business} onChange={setBusiness} />
        )}
        {step === 3 && (
          <StepSegment selected={segment} onSelect={handleSegmentSelect} />
        )}
        {step === 4 && (
          <StepFeatures
            segment={segment}
            features={features}
            onToggle={handleFeatureToggle}
          />
        )}
      </div>

      {/* Footer */}
      {step > 1 && (
        <div className="border-t border-border bg-card/50 backdrop-blur-sm sticky bottom-0">
          <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>

            {step < TOTAL_STEPS ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
                Próximo →
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Concluir ✓"
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
