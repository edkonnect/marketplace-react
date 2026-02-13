import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type User = {
  id: number;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: "parent" | "tutor" | "admin";
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User | null>;
  signup: (data: { firstName: string; lastName: string; email: string; password: string; role: "parent" | "tutor" | "admin" }) => Promise<User | null>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || "Request failed");
  }
  return res.json() as Promise<T>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<{ user: User }>("/api/users/profile", { method: "GET" });
      setUser(data.user);
      return data.user;
    } catch (error) {
      try {
        await request("/api/auth/refresh-token", { method: "POST" });
        const data = await request<{ user: User }>("/api/users/profile", { method: "GET" });
        setUser(data.user);
        return data.user;
      } catch {
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
    return null;
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = useCallback(async (email: string, password: string) => {
    await request<{ user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const next = await fetchProfile();
    return next;
  }, [fetchProfile]);

  const signup = useCallback(async (data: { firstName: string; lastName: string; email: string; password: string; role: "parent" | "tutor" | "admin" }) => {
    await request<{ user: User }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Signup now requires email verification; user is not logged in yet.
    return null;
  }, []);

  const logout = useCallback(async () => {
    await request<{ success: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => { await fetchProfile(); }, [fetchProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    login,
    signup,
    logout,
    refreshProfile,
  }), [user, loading, login, signup, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
