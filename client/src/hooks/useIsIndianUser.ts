import { useAuthContext } from "@/contexts/AuthContext";

const INDIAN_TIMEZONES = ["Asia/Calcutta", "Asia/Kolkata"];

export function useIsIndianUser(): boolean {
  const { user } = useAuthContext();

  // Logged-in user: check their saved timezone
  if (user?.timezone) {
    return INDIAN_TIMEZONES.includes(user.timezone);
  }

  // Logged-out visitor: check browser timezone
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return INDIAN_TIMEZONES.includes(browserTz);
  } catch {
    return false;
  }
}
