import { useState } from "react";
import { useTenantUsers, useUpdateUserRole, useRemoveTenantUser, TenantUser } from "@/hooks/useTenantUsers";
import { useTenant } from "@/contexts/TenantContext";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Shield, User, Trash2, Loader2 } from "lucide-react";

export function TeamMemberList() {
  const { data: users = [], isLoading } = useTenantUsers();
  const updateRole = useUpdateUserRole();
  const removeUser = useRemoveTenantUser();
  const { currentTenant } = useTenant();
  const { user: currentUser } = useAuth();
  const [userToRemove, setUserToRemove] = useState<TenantUser | null>(null);

  const isAdmin = currentTenant?.role === "admin";

  const handleRoleChange = (userId: string, newRole: "admin" | "operator") => {
    updateRole.mutate({ userId, role: newRole });
  };

  const handleRemove = () => {
    if (userToRemove) {
      removeUser.mutate(userToRemove.user_id);
      setUserToRemove(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4 text-center">
        Nenhum membro encontrado.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {users.map((member) => {
          const isCurrentUser = member.user_id === currentUser?.id;
          const canManage = isAdmin && !isCurrentUser;

          return (
            <div
              key={member.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                {member.role === "admin" ? (
                  <Shield className="h-5 w-5 text-primary" />
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {member.user_id.substring(0, 8)}...
                  {isCurrentUser && (
                    <span className="text-xs text-muted-foreground ml-2">(você)</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  Desde {new Date(member.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                {member.role === "admin" ? "Administrador" : "Operador"}
              </Badge>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {member.role === "operator" ? (
                      <DropdownMenuItem onClick={() => handleRoleChange(member.user_id, "admin")}>
                        <Shield className="mr-2 h-4 w-4" />
                        Promover a Admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => handleRoleChange(member.user_id, "operator")}>
                        <User className="mr-2 h-4 w-4" />
                        Rebaixar a Operador
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setUserToRemove(member)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o acesso deste usuário à empresa. Ele poderá ser convidado novamente depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
