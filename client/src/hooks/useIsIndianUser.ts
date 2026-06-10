import { useAuthContext } from "@/contexts/AuthContext";

// Matches backend isAsiaTz() — any Asia/* timezone pays in INR
function isAsiaTz(tz: string | null | undefined): boolean {
  return typeof tz === "string" && tz.startsWith("Asia/");
}

export function useIsIndianUser(): boolean {
  const { user } = useAuthContext();

  // Logged-in user: always use their saved timezone from DB — never fall back to browser
  if (user !== undefined && user !== null) {
    return isAsiaTz(user.timezone);
  }

  // Logged-out visitor: check browser timezone
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isAsiaTz(browserTz);
  } catch {
    return false;
  }
}
