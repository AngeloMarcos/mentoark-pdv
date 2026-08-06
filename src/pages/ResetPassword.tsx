import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrength } from "@/components/auth/PasswordStrength";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { translateAuthError } from "@/lib/auth-errors";
import brandLogo from "@/assets/mentoark-logo.png.asset.json";

type Status = "checking" | "ready" | "invalid" | "done";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = useMemo(
    () => (confirm ? password === confirm : null),
    [password, confirm]
  );

  useEffect(() => {
    let active = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setStatus("ready");
    });

    // O link de recuperação traz o token no hash (implicit) ou como ?code= (PKCE).
    const run = async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        setStatus(error ? "invalid" : "ready");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const hasRecoveryHash = window.location.hash.includes("type=recovery");
      setStatus(data.session || hasRecoveryHash ? "ready" : "invalid");
    };

    run();
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) {
      toast.error("A senha precisa ter no mínimo 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(translateAuthError(error.message));
        return;
      }
      setStatus("done");
      toast.success("Senha redefinida com sucesso!");
      await supabase.auth.signOut();
      setTimeout(() => navigate("/auth", { replace: true }), 1200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/30 p-4">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 flex items-center justify-center">
            <img src={brandLogo.url} alt="MentoArk" className="w-full h-full object-contain" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Redefinir senha</CardTitle>
            <CardDescription>
              {status === "invalid"
                ? "Link inválido ou expirado."
                : "Escolha uma nova senha para sua conta."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "checking" && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {status === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Solicite um novo link em "Esqueci minha senha" na tela de login.
              </p>
              <Button className="w-full" onClick={() => navigate("/auth")}>
                Voltar para o login
              </Button>
            </div>
          )}

          {status === "done" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <ShieldCheck className="h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">
                Senha alterada. Redirecionando para o login...
              </p>
            </div>
          )}

          {status === "ready" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova senha</Label>
                <PasswordInput
                  id="new-password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  autoComplete="new-password"
                />
                <PasswordStrength password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar nova senha</Label>
                <PasswordInput
                  id="confirm-password"
                  placeholder="Digite a senha novamente"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  disabled={loading}
                  autoComplete="new-password"
                />
                {confirm && !passwordsMatch && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>
              <Button className="w-full" onClick={handleSubmit} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar nova senha"
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
