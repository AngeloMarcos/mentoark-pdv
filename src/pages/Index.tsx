import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { FullPageSkeleton } from "@/components/ui/skeletons";

const Index = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { currentTenant, isLoading: tenantLoading } = useTenant();

  useEffect(() => {
    if (authLoading || tenantLoading) return;

    if (!user) {
      navigate("/auth", { replace: true });
    } else if (!currentTenant) {
      navigate("/select-tenant", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [user, currentTenant, authLoading, tenantLoading, navigate]);

  return <FullPageSkeleton />;
};

export default Index;
