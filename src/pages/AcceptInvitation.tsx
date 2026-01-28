import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAcceptInvitation, useInvitationInfo } from "@/hooks/useTenantUsers";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, CheckCircle, XCircle, Loader2, LogIn } from "lucide-react";

const AcceptInvitation = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { data: invitationInfo, isLoading: infoLoading, error: infoError } = useInvitationInfo(token);
  const acceptInvitation = useAcceptInvitation();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");

  useEffect(() => {
    // If user is logged in and invitation is valid, accept automatically
    if (user && invitationInfo?.is_valid && status === "pending" && !acceptInvitation.isPending) {
      handleAccept();
    }
  }, [user, invitationInfo]);

  const handleAccept = async () => {
    if (!token) return;
    
    try {
      await acceptInvitation.mutateAsync(token);
      setStatus("success");
      setTimeout(() => {
        navigate("/select-tenant");
      }, 2000);
    } catch (error) {
      setStatus("error");
    }
  };

  const isLoading = authLoading || infoLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando convite...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (infoError || !invitationInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <XCircle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Convite não encontrado</h2>
            <p className="text-muted-foreground text-center mb-4">
              Este link de convite é inválido ou não existe.
            </p>
            <Button asChild>
              <Link to="/">Ir para o início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitationInfo.is_valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <XCircle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Convite expirado</h2>
            <p className="text-muted-foreground text-center mb-4">
              Este convite já foi usado ou expirou. Solicite um novo convite ao administrador.
            </p>
            <Button asChild>
              <Link to="/">Ir para o início</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Convite aceito!</h2>
            <p className="text-muted-foreground text-center mb-4">
              Você agora tem acesso à empresa <strong>{invitationInfo.tenant_name}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">Redirecionando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center p-8">
            <XCircle className="h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold mb-2">Erro ao aceitar convite</h2>
            <p className="text-muted-foreground text-center mb-4">
              Ocorreu um erro ao processar o convite. Por favor, tente novamente.
            </p>
            <Button onClick={handleAccept} disabled={acceptInvitation.isPending}>
              {acceptInvitation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User not logged in - show invitation details and prompt to login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Você foi convidado!</CardTitle>
            <CardDescription>
              Para entrar na empresa <strong>{invitationInfo.tenant_name}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Você será adicionado como</p>
              <p className="font-semibold">
                {invitationInfo.role === "admin" ? "Administrador" : "Operador"}
              </p>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Faça login ou crie uma conta para aceitar o convite.
            </p>
            <Button asChild className="w-full">
              <Link to={`/auth?redirect=/invite/${token}`}>
                <LogIn className="h-4 w-4 mr-2" />
                Entrar ou Criar Conta
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User logged in but acceptance is pending
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Processando convite...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvitation;
