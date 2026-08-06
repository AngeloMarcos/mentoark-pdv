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
