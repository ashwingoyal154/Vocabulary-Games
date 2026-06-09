import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";
import { track } from "./analytics";

export interface AuthResult {
  error: string | null;
  /** true when sign-up needs email confirmation before a session exists */
  needsConfirm?: boolean;
}

interface AuthValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** whether Supabase env is set up — when false, accounts are hidden entirely */
  configured: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    loading,
    configured: isSupabaseConfigured,

    async signUp(email, password) {
      if (!supabase) return { error: "Accounts aren't configured yet." };
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      track("sign_up", { needsConfirm: !data.session });
      return { error: null, needsConfirm: !data.session };
    },

    async signIn(email, password) {
      if (!supabase) return { error: "Accounts aren't configured yet." };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) track("sign_in");
      return { error: error ? error.message : null };
    },

    async signOut() {
      await supabase?.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
