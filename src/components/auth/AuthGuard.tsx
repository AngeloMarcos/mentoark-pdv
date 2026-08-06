import { ReactNode, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useIsSuperAdmin } from "@/hooks/useSuperAdmin";

interface AuthGuardProps {
  children: ReactNode;
  /** Exige uma empresa selecionada (padrão: true) */
  requireTenant?: boolean;
  /** Exige papel de super administrador */
  requireSuperAdmin?: boolean;
}

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

export function AuthGuard({
  children,
  requireTenant = true,
  requireSuperAdmin = false,
}: AuthGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { currentTenant, isLoading: tenantLoading } = useTenant();
  const { data: isSuperAdmin, isLoading: superLoading } = useIsSuperAdmin();

  const needsTenant = requireTenant && !currentTenant;

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate("/auth", {
        replace: true,
        state: { from: location.pathname + location.search },
      });
      return;
    }

    if (tenantLoading) return;

    if (needsTenant) {
      navigate("/select-tenant", { replace: true });
      return;
    }

    if (requireSuperAdmin && !superLoading && !isSuperAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [
    authLoading,
    user,
    tenantLoading,
    needsTenant,
    requireSuperAdmin,
    superLoading,
    isSuperAdmin,
    navigate,
    location.pathname,
    location.search,
  ]);

  if (authLoading || !user) return <FullScreenLoader />;
  if (tenantLoading || needsTenant) return <FullScreenLoader />;
  if (requireSuperAdmin && (superLoading || !isSuperAdmin)) return <FullScreenLoader />;

  return <>{children}</>;
}
