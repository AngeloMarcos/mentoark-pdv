import { createContext, useContext, ReactNode } from "react";
import { useCompanySettings } from "@/hooks/useCompanySettings";

interface CompanyContextType {
  hasFeature: (key: string) => boolean;
  features: Record<string, boolean>;
  segment: string | null;
  isOnboardingCompleted: boolean;
  isLoading: boolean;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { hasFeature, features, segment, isOnboardingCompleted, isLoading } =
    useCompanySettings();

  return (
    <CompanyContext.Provider
      value={{ hasFeature, features, segment, isOnboardingCompleted, isLoading }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error("useCompany must be used within a CompanyProvider");
  }
  return context;
}
