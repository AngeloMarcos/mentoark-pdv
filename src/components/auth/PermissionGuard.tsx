import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Permission } from "@/lib/permissions";
import { useCurrentRole } from "@/hooks/usePermission";
import { roleHasPermission } from "@/lib/permissions";
import { AppLayoutSkeleton } from "@/components/ui/skeletons";

interface Props {
  permission: Permission;
  children: ReactNode;
}

export function PermissionGuard({ permission, children }: Props) {
  const { role, isLoading } = useCurrentRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && role !== null && !roleHasPermission(role, permission)) {
      toast.error("Você não tem permissão para acessar essa área");
      navigate("/dashboard", { replace: true });
    }
  }, [role, isLoading, permission, navigate]);

  if (isLoading) return <AppLayoutSkeleton />;
  if (!role || !roleHasPermission(role, permission)) return null;
  return <>{children}</>;
}
