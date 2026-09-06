"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, clearToken, getToken, setToken } from "./api";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(u: { id: string; email: string; full_name: string }): AuthUser {
  return { id: u.id, email: u.email, fullName: u.full_name };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      // No token means nothing to fetch; this only runs once on mount,
      // and there's no async boundary here to defer it across.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    api
      .me()
      .then((me) => setUser(toAuthUser(me)))
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const { access_token } = await api.auth.login(email, password);
    setToken(access_token);
    const me = await api.me();
    setUser(toAuthUser(me));
  }

  async function register(email: string, password: string, fullName: string) {
    await api.auth.register(email, password, fullName);
    await login(email, password);
  }

  function logout() {
    clearToken();
    setUser(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Redirects to /login if there's no signed-in user once the initial auth
 * check has finished. Call at the top of any page that needs a real
 * session (board, tasks, growth, review).
 */
export function useRequireAuth(): AuthContextValue {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.user) router.replace("/login");
  }, [auth.loading, auth.user, router]);

  return auth;
}

export { ApiError };
