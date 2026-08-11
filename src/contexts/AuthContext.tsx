import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { translateAuthError } from "@/lib/auth-errors";

export interface SignUpResult {
  error: Error | null;
  /** Email já cadastrado (o Supabase responde sem identidades vinculadas) */
  alreadyRegistered: boolean;
  /** Cadastro criado, mas exige confirmação por email (sem sessão) */
  needsEmailConfirmation: boolean;
  session: Session | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // TOKEN_REFRESHED sem sessão é transitório (aba suspensa): não desloga.
        if (!session && event !== "SIGNED_OUT" && event !== "INITIAL_SESSION") {
          return;
        }
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
        // Track last_seen on sign in (deferred to avoid blocking auth callback)
        if (event === "SIGNED_IN" && session?.user) {
          setTimeout(() => {
            supabase.from("user_activity").upsert({
              user_id: session.user.id,
              last_seen: new Date().toISOString(),
            }).then(() => {});
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
      if (session?.user) {
        supabase.from("user_activity").upsert({
          user_id: session.user.id,
          last_seen: new Date().toISOString(),
        }).then(() => {});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Revalida a sessão ao voltar de inatividade (aba oculta / rede caída).
  // Sem isso as requisições saem com token expirado e a tela fica "vazia".
  useEffect(() => {
    let refreshing = false;

    const revalidate = async () => {
      if (refreshing) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      refreshing = true;
      try {
        const { data } = await supabase.auth.getSession();
        const current = data.session;
        if (!current) return;

        const expiresAt = (current.expires_at ?? 0) * 1000;
        // Renova proativamente se falta menos de 5 minutos (ou já expirou)
        if (expiresAt - Date.now() < 5 * 60 * 1000) {
          const { data: refreshed, error } = await supabase.auth.refreshSession();
          if (!error && refreshed.session) {
            setSession(refreshed.session);
            setUser(refreshed.session.user);
          }
        }
      } catch {
        // silencioso: mantém a sessão atual
      } finally {
        refreshing = false;
      }
    };

    const onVisibility = () => { void revalidate(); };
    window.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    window.addEventListener("online", onVisibility);
    const interval = window.setInterval(() => { void revalidate(); }, 4 * 60 * 1000);

    return () => {
      window.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
      window.removeEventListener("online", onVisibility);
      window.clearInterval(interval);
    };
  }, []);


  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    return { error: error ? new Error(translateAuthError(error.message)) : null };
  };

  const signUp = async (email: string, password: string): Promise<SignUpResult> => {
    const redirectUrl = `${window.location.origin}/`;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) {
      const isRegistered = /already registered|already been registered/i.test(error.message);
      return {
        error: new Error(translateAuthError(error.message)),
        alreadyRegistered: isRegistered,
        needsEmailConfirmation: false,
        session: null,
      };
    }

    // Supabase devolve um usuário "vazio" (sem identities) quando o email já existe.
    const alreadyRegistered = !!data.user && (data.user.identities?.length ?? 0) === 0;

    return {
      error: null,
      alreadyRegistered,
      needsEmailConfirmation: !alreadyRegistered && !data.session,
      session: data.session ?? null,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: redirectUrl,
    });
    return { error: error ? new Error(translateAuthError(error.message)) : null };
  };

  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    return { error: error ? new Error(translateAuthError(error.message)) : null };
  };


  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        resendConfirmation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
