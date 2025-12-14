import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export interface Tenant {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  segment: string | null;
  role: "admin" | "operator";
}

interface TenantContextType {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
  tenants: Tenant[];
  isLoading: boolean;
  refetchTenants: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = "pdv_current_tenant_id";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);

  const { data: tenants = [], isLoading, refetch: refetchTenants } = useQuery({
    queryKey: ["tenants", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("tenant_users")
        .select(`
          role,
          tenants:tenant_id (
            id,
            name,
            document,
            phone,
            segment
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      return data.map((item) => ({
        id: (item.tenants as any).id,
        name: (item.tenants as any).name,
        document: (item.tenants as any).document,
        phone: (item.tenants as any).phone,
        segment: (item.tenants as any).segment,
        role: item.role as "admin" | "operator",
      }));
    },
    enabled: !!user,
  });

  // Load saved tenant on mount
  useEffect(() => {
    if (tenants.length > 0 && !currentTenant) {
      const savedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
      const savedTenant = tenants.find((t) => t.id === savedTenantId);
      if (savedTenant) {
        setCurrentTenantState(savedTenant);
      }
    }
  }, [tenants, currentTenant]);

  const setCurrentTenant = (tenant: Tenant | null) => {
    setCurrentTenantState(tenant);
    if (tenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
    } else {
      localStorage.removeItem(TENANT_STORAGE_KEY);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        setCurrentTenant,
        tenants,
        isLoading,
        refetchTenants,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
