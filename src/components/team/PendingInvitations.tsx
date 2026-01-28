import { useTenantInvitations, useCancelInvitation, TenantInvitation } from "@/hooks/useTenantUsers";
import { useTenant } from "@/contexts/TenantContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, X, Clock, Copy, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PendingInvitations() {
  const { data: invitations = [], isLoading } = useTenantInvitations();
  const cancelInvitation = useCancelInvitation();
  const { currentTenant } = useTenant();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAdmin = currentTenant?.role === "admin";

  const handleCopyLink = async (invitation: TenantInvitation) => {
    const link = `${window.location.origin}/invite/${invitation.token}`;
    await navigator.clipboard.writeText(link);
    setCopiedId(invitation.id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isAdmin) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-4 text-center">
        Nenhum convite pendente.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {invitations.map((invitation) => {
        const isExpired = isPast(new Date(invitation.expires_at));
        const expiresIn = formatDistanceToNow(new Date(invitation.expires_at), {
          locale: ptBR,
          addSuffix: true,
        });

        return (
          <div
            key={invitation.id}
            className={`flex items-center gap-3 p-3 rounded-lg border ${
              isExpired ? "bg-muted/50 opacity-60" : "bg-card"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
              <Mail className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{invitation.email}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                {isExpired ? "Expirado" : `Expira ${expiresIn}`}
              </div>
            </div>
            <Badge variant={invitation.role === "admin" ? "default" : "secondary"}>
              {invitation.role === "admin" ? "Admin" : "Operador"}
            </Badge>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCopyLink(invitation)}
                title="Copiar link"
              >
                {copiedId === invitation.id ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => cancelInvitation.mutate(invitation.id)}
                disabled={cancelInvitation.isPending}
                title="Cancelar convite"
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
