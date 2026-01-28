import { useState } from "react";
import { useCreateInvitation } from "@/hooks/useTenantUsers";
import { useTenant } from "@/contexts/TenantContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Email inválido");

interface InviteMemberDialogProps {
  trigger?: React.ReactNode;
}

export function InviteMemberDialog({ trigger }: InviteMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "operator">("operator");
  const [emailError, setEmailError] = useState<string | null>(null);
  const { currentTenant } = useTenant();
  const createInvitation = useCreateInvitation();

  const isAdmin = currentTenant?.role === "admin";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    // Validate email
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setEmailError(result.error.errors[0].message);
      return;
    }

    try {
      await createInvitation.mutateAsync({ email, role });
      setOpen(false);
      setEmail("");
      setRole("operator");
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Convidar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Convidar Membro</DialogTitle>
            <DialogDescription>
              Envie um convite para um novo membro da equipe. Ele receberá acesso após criar uma conta ou fazer login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="colaborador@empresa.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                className={emailError ? "border-destructive" : ""}
              />
              {emailError && (
                <p className="text-sm text-destructive">{emailError}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Função</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "operator")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operator">Operador</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {role === "admin"
                  ? "Administradores podem gerenciar membros e configurações."
                  : "Operadores podem usar o PDV e gerenciar vendas."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createInvitation.isPending}>
              {createInvitation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enviar Convite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
