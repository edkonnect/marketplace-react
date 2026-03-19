import { useAuthContext } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function useAuth(options?: { redirectOnUnauthenticated?: boolean; redirectPath?: string }) {
  const { user, loading, previousLastSignedIn, login, logout, signup, refreshProfile } = useAuthContext();
  const { redirectOnUnauthenticated = false, redirectPath = "/login" } = options ?? {};
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading) return;
    if (user) return;
    setLocation(redirectPath);
  }, [redirectOnUnauthenticated, redirectPath, loading, user, setLocation]);

  return {
    user,
    loading,
    previousLastSignedIn,
    isAuthenticated: Boolean(user),
    login,
    signup,
    logout,
    refresh: refreshProfile,
    refreshProfile,
  };
}
