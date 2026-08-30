import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type AuthUser, getMe } from "../lib/api";

interface AuthContext {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthCtx = createContext<AuthContext | null>(null);

const AUTH_USER_KEY = "auth_user";

function getStoredUser(): AuthUser | null {
  const storedUser = localStorage.getItem(AUTH_USER_KEY);
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    localStorage.removeItem(AUTH_USER_KEY);
    return null;
  }
}

function setStoredUser(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    return;
  }

  localStorage.removeItem(AUTH_USER_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLocalUser = useCallback(async () => {
    const currentUser = await getMe();
    setStoredUser(currentUser);
    setUser(currentUser);
  }, []);

  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      setLoading(false);
      return;
    }

    loadLocalUser()
      .catch(() => {
        setStoredUser(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [loadLocalUser]);

  const login = useCallback(async (_email: string, _password: string) => {
    await loadLocalUser();
  }, [loadLocalUser]);

  const register = useCallback(async (_email: string, _password: string, _name: string) => {
    await loadLocalUser();
  }, [loadLocalUser]);

  const logout = useCallback(() => {
    window.location.href = "/";
  }, []);

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
}
