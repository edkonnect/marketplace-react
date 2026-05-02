import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

type SuperUserContextValue = {
  isUnlocked: boolean;
  isChecking: boolean;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
};

const SuperUserContext = createContext<SuperUserContextValue | undefined>(undefined);

const API_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export function SuperUserProvider({ children, userId }: { children: React.ReactNode; userId: number | null }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const prevUserIdRef = useRef(userId);

  // Verify cookie state on mount and whenever the logged-in user changes
  useEffect(() => {
    if (userId === null) {
      setIsUnlocked(false);
      prevUserIdRef.current = null;
      return;
    }

    // User switched — reset lock
    if (prevUserIdRef.current !== userId) {
      setIsUnlocked(false);
      prevUserIdRef.current = userId;
    }

    setIsChecking(true);
    request<{ verified: boolean }>("/api/auth/super-verify")
      .then(data => setIsUnlocked(data.verified))
      .catch(() => setIsUnlocked(false))
      .finally(() => setIsChecking(false));
  }, [userId]);

  const unlock = useCallback(async (password: string) => {
    await request<{ success: boolean }>("/api/auth/super-unlock", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setIsUnlocked(true);
  }, []);

  const lock = useCallback(async () => {
    await request<{ success: boolean }>("/api/auth/super-lock", { method: "POST" }).catch(() => {});
    setIsUnlocked(false);
  }, []);

  return (
    <SuperUserContext.Provider value={{ isUnlocked, isChecking, unlock, lock }}>
      {children}
    </SuperUserContext.Provider>
  );
}

export function useSuperUser() {
  const ctx = useContext(SuperUserContext);
  if (!ctx) throw new Error("useSuperUser must be used inside SuperUserProvider");
  return ctx;
}
