import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { type AuthUser, getMe, login as loginApi, register as registerApi, setAuthToken, clearAuth } from "../lib/api";

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

  useEffect(() => {
    const storedUser = getStoredUser();
    if (!storedUser) {
      setLoading(false);
      return;
    }

    getMe()
      .then((currentUser) => {
        setStoredUser(currentUser);
        setUser(currentUser);
      })
      .catch(() => {
        clearAuth();
        setStoredUser(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: loggedInUser } = await loginApi(email, password);
    setAuthToken(token);
    setStoredUser(loggedInUser);
    setUser(loggedInUser);
  }, []);

  const register = useCallback(async (email: string, password: string, name: string) => {
    const { token, user: newUser } = await registerApi(email, password, name);
    setAuthToken(token);
    setStoredUser(newUser);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setStoredUser(null);
    setUser(null);
    window.location.href = "/login";
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
