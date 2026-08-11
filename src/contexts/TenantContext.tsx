import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type TenantRole =
  | "admin"
  | "manager"
  | "operator"
  | "cashier"
  | "financial"
  | "stock"
  | "waiter";

export interface Tenant {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  segment: string | null;
  role: TenantRole;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  setCurrentTenant: (tenant: Tenant | null) => void;
  tenants: Tenant[];
  isLoading: boolean;
  error: Error | null;
  refetchTenants: () => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = "pdv_current_tenant_id";
const TENANT_CACHE_KEY = "pdv_current_tenant_cache";

function readCachedTenant(): Tenant | null {
  try {
    const raw = localStorage.getItem(TENANT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.id ? (parsed as Tenant) : null;
  } catch {
    return null;
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [hasResolvedTenant, setHasResolvedTenant] = useState(false);

  const {
    data: tenants = [],
    isLoading: tenantsQueryLoading,
    error: tenantsError,
    refetch: refetchTenants,
  } = useQuery<Tenant[]>({
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

      return (data ?? [])
        .filter((item) => !!item.tenants)
        .map((item) => ({
          id: (item.tenants as any).id,
          name: (item.tenants as any).name,
          document: (item.tenants as any).document,
          phone: (item.tenants as any).phone,
          segment: (item.tenants as any).segment,
          role: item.role as TenantRole,
        }));
    },
    enabled: !!user,
    retry: 2,
  });

  useEffect(() => {
    setCurrentTenantState(null);
    setHasResolvedTenant(false);
  }, [user?.id]);

  // Resolve selected tenant after auth + tenant list are available
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setHasResolvedTenant(true);
      return;
    }

    if (tenantsQueryLoading) return;

    // Falha de rede/token: NÃO limpar a empresa selecionada (isso jogava o
    // usuário na tela de "selecionar/criar empresa" sem motivo).
    if (tenantsError) {
      setCurrentTenantState((previousTenant) => previousTenant ?? readCachedTenant());
      setHasResolvedTenant(true);
      return;
    }

    const savedTenantId = localStorage.getItem(TENANT_STORAGE_KEY);
    const savedTenant = savedTenantId ? tenants.find((tenant) => tenant.id === savedTenantId) ?? null : null;

    setCurrentTenantState((previousTenant) => {
      if (previousTenant) {
        const refreshedTenant = tenants.find((tenant) => tenant.id === previousTenant.id);
        if (refreshedTenant) return refreshedTenant;
      }

      if (savedTenant) return savedTenant;
      if (tenants.length === 1) return tenants[0];
      return null;
    });

    if (savedTenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, savedTenant.id);
      localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(savedTenant));
    } else if (tenants.length === 1) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenants[0].id);
      localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(tenants[0]));
    } else if (savedTenantId && !tenants.some((tenant) => tenant.id === savedTenantId)) {
      localStorage.removeItem(TENANT_STORAGE_KEY);
      localStorage.removeItem(TENANT_CACHE_KEY);
    }

    setHasResolvedTenant(true);
  }, [authLoading, user, tenants, tenantsQueryLoading, tenantsError]);

  const setCurrentTenant = (tenant: Tenant | null) => {
    setCurrentTenantState(tenant);
    if (tenant) {
      localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
      localStorage.setItem(TENANT_CACHE_KEY, JSON.stringify(tenant));
    } else {
      localStorage.removeItem(TENANT_STORAGE_KEY);
      localStorage.removeItem(TENANT_CACHE_KEY);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        setCurrentTenant,
        tenants,
        isLoading: authLoading || (!!user && (!hasResolvedTenant || tenantsQueryLoading)),
        error: (tenantsError as Error | null) ?? null,
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
