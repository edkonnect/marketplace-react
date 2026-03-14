import { useMemo } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { LOGIN_PATH } from "@/const";
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { TimeBlockManager } from "@/components/TimeBlockManager";
import { Globe, Clock } from "lucide-react";
import { COMMON_TIMEZONES } from "@/../../shared/timezone-utils";

export default function TutorAvailability() {
  const { user, isAuthenticated, loading } = useAuth();

  const { data: tutorProfile } = trpc.tutorProfile.getMy.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "tutor",
  });

  const tutorTimezone = tutorProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const timezoneFriendlyName = useMemo(() => {
    const found = COMMON_TIMEZONES.find(tz => tz.value === tutorTimezone);
    return found ? found.label : tutorTimezone;
  }, [tutorTimezone]);

  const timezoneAbbr = useMemo(() => {
    return new Date().toLocaleTimeString("en-US", {
      timeZone: tutorTimezone,
      timeZoneName: "short",
    }).split(" ").pop();
  }, [tutorTimezone]);

  if (!loading && !isAuthenticated) {
    window.location.href = LOGIN_PATH;
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <div className="container max-w-3xl pt-24 pb-12 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Manage Availability</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Set your regular weekly schedule and block out time for vacations or appointments.
            Parents will only be able to book sessions during your available hours.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm bg-blue-50/50 dark:bg-blue-950/20 rounded-md p-3 sm:p-4 border border-blue-200 dark:border-blue-800 mb-6">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <span className="font-semibold text-blue-900 dark:text-blue-100">Your Time Zone:</span>
          </div>
          <span className="text-blue-800 dark:text-blue-200 font-medium ml-7 sm:ml-0">
            {timezoneFriendlyName} ({timezoneAbbr})
          </span>
          <span className="text-xs text-blue-700/70 dark:text-blue-300/70 ml-7 sm:ml-auto">
            Availability slots are saved in your local timezone
          </span>
        </div>

        <div className="space-y-6">
          <AvailabilityManager />
          <TimeBlockManager />
        </div>
      </div>
    </div>
  );
}
