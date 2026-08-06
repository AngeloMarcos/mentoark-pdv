import { useState, useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2, Check, X, Mail, Info } from "lucide-react";
import brandLogo from "@/assets/mentoark-logo.png.asset.json";
import { AuthSkeleton } from "@/components/ui/skeletons";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";


const signinSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const signupSchema = z.object({
  email: z.string().min(1, "Email é obrigatório").email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(1, "Confirmação de senha é obrigatória"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, isLoading, resendConfirmation } = useAuth();

  // Separate state for each tab
  const [signinEmail, setSigninEmail] = useState("");
  const [signinPassword, setSigninPassword] = useState("");

  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const [signinNotice, setSigninNotice] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/select-tenant";

  useEffect(() => {
    if (!isLoading && user) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, isLoading, navigate, redirectTo]);

  const passwordsMatch = useMemo(() => {
    if (!signupConfirmPassword) return null;
    return signupPassword === signupConfirmPassword;
  }, [signupPassword, signupConfirmPassword]);

  const handleSignIn = async () => {
    const validation = signinSchema.safeParse({
      email: signinEmail,
      password: signinPassword,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    setSigninNotice(null);
    try {
      const { error } = await signIn(signinEmail, signinPassword);

      if (error) {
        toast.error(error.message);
        setSigninNotice(error.message);
        return;
      }

      // O redirecionamento acontece no efeito acima, após a sessão existir.
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingConfirmation) return;
    setLoading(true);
    try {
      const { error } = await resendConfirmation(pendingConfirmation);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Email de confirmação reenviado.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const validation = signupSchema.safeParse({
      email: signupEmail,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
    });

    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(signupEmail, signupPassword);

      if (result.error) {
        toast.error(result.error.message);
        return;
      }

      if (result.alreadyRegistered) {
        toast.error("Este email já possui uma conta. Faça login ou recupere a senha.");
        setSigninEmail(signupEmail);
        setSigninNotice(
          "Este email já possui uma conta. Se você não lembra a senha, use \"Esqueci minha senha\"."
        );
        setActiveTab("signin");
        return;
      }

      if (result.needsEmailConfirmation) {
        setPendingConfirmation(signupEmail);
        toast.success("Conta criada. Confirme seu email para entrar.");
        return;
      }

      toast.success("Conta criada com sucesso!");
      // Sessão ativa: o efeito de redirecionamento cuida da navegação.
    } finally {
      setLoading(false);
    }

  };

  if (isLoading) {
    return <AuthSkeleton />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/30 p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <img src={brandLogo.url} alt="MentoArk" className="w-full h-full object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">MentoArk</CardTitle>
            <CardDescription>Sistema de Ponto de Venda</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="space-y-4">
              {signinNotice && (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{signinNotice}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={signinEmail}
                  onChange={(e) => setSigninEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Senha</Label>
                <PasswordInput
                  id="signin-password"
                  placeholder="••••••••"
                  value={signinPassword}
                  onChange={(e) => setSigninPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignIn()}
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>
              <div className="flex justify-end">
                <ForgotPasswordDialog />
              </div>
              <Button 
                className="w-full touch-target" 
                onClick={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              {pendingConfirmation && (
                <Alert>
                  <Mail className="h-4 w-4" />
                  <AlertDescription className="space-y-2">
                    <p>
                      Enviamos um link de confirmação para{" "}
                      <strong>{pendingConfirmation}</strong>. Confirme o email para poder entrar.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResend}
                      disabled={loading}
                    >
                      Reenviar email
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="seu@email.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <PasswordInput
                  id="signup-password"
                  placeholder="Mínimo 6 caracteres"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
                <PasswordStrength password={signupPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-confirm-password">Confirmar Senha</Label>
                <PasswordInput
                  id="signup-confirm-password"
                  placeholder="Digite a senha novamente"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
                  disabled={loading}
                  autoComplete="new-password"
                />
                {signupConfirmPassword && (
                  <div className={`flex items-center gap-1 text-xs ${passwordsMatch ? 'text-green-600' : 'text-destructive'}`}>
                    {passwordsMatch ? (
                      <>
                        <Check className="h-3 w-3" />
                        Senhas coincidem
                      </>
                    ) : (
                      <>
                        <X className="h-3 w-3" />
                        As senhas não coincidem
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button 
                className="w-full touch-target" 
                onClick={handleSignUp}
                disabled={loading || (signupConfirmPassword !== "" && !passwordsMatch)}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Criar conta"
                )}
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
