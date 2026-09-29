import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type AuthUser, getMe } from "../lib/api";
import { supabase } from "../lib/supabase";

interface AuthContext {
  user: AuthUser | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      setUser(await getMe());
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) loadUser().finally(() => setLoading(false));
      else setLoading(false);
    });

    // Se dispara tras el redirect de vuelta de Google, y en el refresco
    // automático de la sesión que hace el propio cliente de Supabase.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) loadUser();
      else setUser(null);
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const loginWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/login` },
    });
    // A partir de aquí el navegador redirige a Google — no hay nada más que
    // hacer en esta función, la sesión se recoge sola al volver (ver arriba).
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, loginWithGoogle, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
