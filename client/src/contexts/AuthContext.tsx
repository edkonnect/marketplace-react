import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type User = {
  id: number;
  email: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: "parent" | "tutor" | "admin" | "coordinator";
  timezone?: string | null;
  lastSignedIn?: string | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  previousLastSignedIn: string | null;
  login: (email: string, password: string) => Promise<User | null>;
  signup: (data: { firstName: string; lastName: string; email: string; password: string; role: "parent" | "tutor" | "admin" | "coordinator"; timezone?: string }) => Promise<User | null>;
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

// Refresh access token ~1 min before it expires (access token = 15 min, so refresh every 13 min)
const TOKEN_REFRESH_INTERVAL_MS = 13 * 60 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousLastSignedIn, setPreviousLastSignedIn] = useState<string | null>(null);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const silentRefresh = useCallback(async () => {
    try {
      await request("/api/auth/refresh-token", { method: "POST" });
    } catch {
      // Refresh failed — user's session has fully expired; clear state
      setUser(null);
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, []);

  const startRefreshInterval = useCallback(() => {
    if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    refreshIntervalRef.current = setInterval(silentRefresh, TOKEN_REFRESH_INTERVAL_MS);
  }, [silentRefresh]);

  const stopRefreshInterval = useCallback(() => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request<{ user: User }>("/api/users/profile", { method: "GET" });
      setUser(data.user);
      startRefreshInterval();
      return data.user;
    } catch (error) {
      try {
        await request("/api/auth/refresh-token", { method: "POST" });
        const data = await request<{ user: User }>("/api/users/profile", { method: "GET" });
        setUser(data.user);
        startRefreshInterval();
        return data.user;
      } catch {
        setUser(null);
        stopRefreshInterval();
      }
    } finally {
      setLoading(false);
    }
    return null;
  }, [startRefreshInterval, stopRefreshInterval]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Refresh token when tab becomes visible again after being hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user) {
        silentRefresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user, silentRefresh]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => stopRefreshInterval();
  }, [stopRefreshInterval]);

  const login = useCallback(async (email: string, password: string) => {
    const timezone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return undefined; } })();
    const loginData = await request<{ user: User; previousLastSignedIn: string | null }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password, timezone }),
    });
    setPreviousLastSignedIn(loginData.previousLastSignedIn ?? null);
    const next = await fetchProfile();
    return next;
  }, [fetchProfile]);

  const signup = useCallback(async (data: { firstName: string; lastName: string; email: string; password: string; role: "parent" | "tutor" | "admin" | "coordinator"; timezone?: string; refCode?: string }) => {
    await request<{ user: User }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    });
    // Signup now requires email verification; user is not logged in yet.
    return null;
  }, []);

  const logout = useCallback(async () => {
    stopRefreshInterval();
    await request<{ success: boolean }>("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    setPreviousLastSignedIn(null);
  }, [stopRefreshInterval]);

  const refreshProfile = useCallback(async () => { await fetchProfile(); }, [fetchProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    previousLastSignedIn,
    login,
    signup,
    logout,
    refreshProfile,
  }), [user, loading, previousLastSignedIn, login, signup, logout, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
