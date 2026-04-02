import { ReactNode } from "react";
import { useCompany } from "@/contexts/CompanyContext";
import { useTenant } from "@/contexts/TenantContext";
import { OnboardingWizard } from "./OnboardingWizard";
import { Loader2 } from "lucide-react";

interface OnboardingGuardProps {
  children: ReactNode;
}

export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { currentTenant } = useTenant();
  const { isOnboardingCompleted, isLoading } = useCompany();

  // No tenant selected, let other guards handle redirect
  if (!currentTenant) return <>{children}</>;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isOnboardingCompleted) {
    return <OnboardingWizard />;
  }

  return <>{children}</>;
}
