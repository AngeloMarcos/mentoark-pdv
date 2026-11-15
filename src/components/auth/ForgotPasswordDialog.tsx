import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { z } from "zod";
import { Mail, Loader2, CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const emailSchema = z.string().email("Por favor, insira um email válido");

interface ForgotPasswordDialogProps {
  trigger?: React.ReactNode;
  /** Email pré-preenchido (ex.: o que o usuário digitou no login) */
  defaultEmail?: string;
}

export function ForgotPasswordDialog({ trigger, defaultEmail = "" }: ForgotPasswordDialogProps) {
  const { resetPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMessage(null);
    
    const validation = emailSchema.safeParse(email.trim().toLowerCase());
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const { error } = await resetPassword(validation.data);
      
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      
      setEmail(validation.data);
      setSent(true);
    } catch {
      setErrorMessage("Não foi possível enviar o pedido. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (loading && !isOpen) return;
    setErrorMessage(null);
    setOpen(isOpen);
    if (isOpen) {
      setEmail(defaultEmail);
      setSent(false);
    } else {
      setEmail("");
      setSent(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="link" className="px-0 h-auto font-normal text-muted-foreground">
            Esqueci minha senha
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="auth-surface sm:max-w-md rounded-lg">
        <DialogHeader>
          <DialogTitle>Recuperar senha</DialogTitle>
          <DialogDescription>
            {sent 
              ? "Pedido de recuperação realizado."
              : "Digite seu email para receber um link de recuperação de senha."
            }
          </DialogDescription>
        </DialogHeader>
        
        {sent ? (
          <div className="flex flex-col items-center py-6 space-y-4">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-success" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Se houver uma conta com <strong className="break-all text-foreground">{email}</strong>, você receberá um link para redefinir a senha.
            </p>
            <p className="text-center text-sm text-muted-foreground">Verifique também o spam. Se houver mais de um e-mail, use o link mais recente.</p>
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Fechar
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMessage && <Alert variant="destructive" role="alert"><CircleAlert className="h-4 w-4" /><AlertDescription>{errorMessage}</AlertDescription></Alert>}
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                className="h-12"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoFocus
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !email}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Enviar link"
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
