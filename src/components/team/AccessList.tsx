import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserPlus, Copy, X, Shield } from "lucide-react";
import { toast } from "sonner";
import {
  useTenantMembers, useTenantInvitations, useCreateInvitation,
  useUpdateUserRole, useRemoveTenantUser, useCancelInvitation,
} from "@/hooks/useTenantUsers";
import { ALL_ROLES, ROLE_LABELS, AppRole } from "@/lib/permissions";
import { getInitials, getAvatarColor } from "@/lib/avatar-utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AccessList() {
  const { data: members = [], isLoading } = useTenantMembers();
  const { data: invitations = [] } = useTenantInvitations();
  const createInv = useCreateInvitation();
  const updateRole = useUpdateUserRole();
  const removeUser = useRemoveTenantUser();
  const cancelInv = useCancelInvitation();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("operator");
  const [confirmRemove, setConfirmRemove] = useState<{ user_id: string; email: string | null } | null>(null);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    const inv = await createInv.mutateAsync({ email: inviteEmail.trim(), role: inviteRole });
    const link = `${window.location.origin}/invite/${inv.token}`;
    await navigator.clipboard.writeText(link).catch(() => {});
    toast.success("Link copiado para a área de transferência!");
    setInviteEmail("");
    setInviteOpen(false);
  };

  const copyInviteLink = async (token: string) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link de convite copiado!");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Gerencie quem pode acessar esta empresa e os perfis de cada usuário.
        </p>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" /> Convidar usuário
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="p-3 border-b bg-muted/40">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Shield className="w-4 h-4" /> Membros ativos
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/20 border-b">
              <tr className="text-left">
                <th className="p-3 font-medium">Usuário</th>
                <th className="p-3 font-medium">Perfil</th>
                <th className="p-3 font-medium">Acesso desde</th>
                <th className="p-3 font-medium">Último acesso</th>
                <th className="p-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!isLoading && members.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum membro encontrado</td></tr>
              )}
              {members.map((m) => (
                <tr key={m.user_id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0"
                        style={{ background: getAvatarColor(m.email || m.user_id) }}
                      >
                        {getInitials(m.email || "?")}
                      </div>
                      <div className="font-medium">{m.email || "—"}</div>
                    </div>
                  </td>
                  <td className="p-3">
                    <Select
                      value={m.role}
                      onValueChange={(v: AppRole) => updateRole.mutate({ userId: m.user_id, role: v })}
                    >
                      <SelectTrigger className="w-[170px] h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {m.last_seen ? new Date(m.last_seen).toLocaleString("pt-BR") : "Nunca"}
                  </td>
                  <td className="p-3 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setConfirmRemove({ user_id: m.user_id, email: m.email })}
                    >
                      <X className="w-4 h-4 mr-1" /> Revogar
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {invitations.length > 0 && (
        <Card className="overflow-hidden">
          <div className="p-3 border-b bg-muted/40">
            <h3 className="font-medium text-sm">Convites pendentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/20 border-b">
                <tr className="text-left">
                  <th className="p-3 font-medium">E-mail</th>
                  <th className="p-3 font-medium">Perfil</th>
                  <th className="p-3 font-medium">Expira em</th>
                  <th className="p-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3">{inv.email}</td>
                    <td className="p-3">
                      <Badge variant="outline">{ROLE_LABELS[inv.role]}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => copyInviteLink(inv.token)}>
                        <Copy className="w-4 h-4 mr-1" /> Link
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelInv.mutate(inv.id)}>
                        <X className="w-4 h-4 mr-1" /> Cancelar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar novo usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>E-mail</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="usuario@exemplo.com"
              />
            </div>
            <div>
              <Label>Perfil de acesso</Label>
              <Select value={inviteRole} onValueChange={(v: AppRole) => setInviteRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30 text-xs text-muted-foreground">
              Após criar o convite, um link será gerado e copiado automaticamente. Compartilhe-o com o usuário para que ele possa acessar o sistema.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail.trim() || createInv.isPending}>
              Criar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmRemove} onOpenChange={(o) => !o && setConfirmRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar acesso?</AlertDialogTitle>
            <AlertDialogDescription>
              O usuário <strong>{confirmRemove?.email}</strong> perderá acesso a esta empresa imediatamente. Esta ação pode ser desfeita criando um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmRemove) await removeUser.mutateAsync(confirmRemove.user_id);
                setConfirmRemove(null);
              }}
            >
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
