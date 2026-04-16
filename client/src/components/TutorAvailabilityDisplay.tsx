import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  convertFromUTC,
  createTimestamp,
  detectUserTimezone,
  formatSessionTime,
  getTimezoneAbbreviation,
} from "@/../../shared/timezone-utils";

interface AvailabilitySlot {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
}

interface TutorAvailabilityDisplayProps {
  availability: AvailabilitySlot[];
  tutorId: number;
  tutorTimezone?: string | null;
  viewerTimezone?: string | null;
}

interface UpcomingAvailabilityDay {
  key: string;
  label: string;
  dateLabel: string;
  hasConfiguredWindows: boolean;
  availableTimeSlots: string[];
}

const SLOT_DURATION_MINUTES = 60;

function getUpcomingAvailabilityDays(
  availability: AvailabilitySlot[],
  upcomingSessions: Array<{ scheduledAt: number; duration: number }>,
  tutorTimezone: string,
  viewerTimezone: string
): UpcomingAvailabilityDay[] {
  const now = Date.now();
  const viewerToday = convertFromUTC(now, viewerTimezone);
  viewerToday.setHours(0, 0, 0, 0);

  const days: UpcomingAvailabilityDay[] = [];

  for (let offset = 0; offset < 7; offset++) {
    const dayDate = new Date(viewerToday);
    dayDate.setDate(viewerToday.getDate() + offset);

    const year = dayDate.getFullYear();
    const month = dayDate.getMonth();
    const date = dayDate.getDate();

    const dayStartUTC = createTimestamp(year, month, date, 0, 0, viewerTimezone);
    const dayEndUTC = createTimestamp(year, month, date, 23, 59, viewerTimezone);
    const dayNoonUTC = createTimestamp(year, month, date, 12, 0, viewerTimezone);
    const slotsByTimestamp = new Map<number, string>();
    let hasConfiguredWindows = false;

    for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
      const checkDateNoonUTC = dayNoonUTC + dayOffset * 24 * 60 * 60 * 1000;
      const tutorDate = convertFromUTC(checkDateNoonUTC, tutorTimezone);
      const dayWindows = availability.filter(
        (slot) => slot.isActive && slot.dayOfWeek === tutorDate.getDay()
      );

      if (!dayWindows.length) continue;
      hasConfiguredWindows = true;

      for (const slot of dayWindows) {
        const [startHour, startMinute] = slot.startTime.split(":").map(Number);
        const [endHour, endMinute] = slot.endTime.split(":").map(Number);
        let cursorMinutes = startHour * 60 + startMinute;
        const endMinutes = endHour * 60 + endMinute;

        while (cursorMinutes + SLOT_DURATION_MINUTES <= endMinutes) {
          const slotHour = Math.floor(cursorMinutes / 60);
          const slotMinute = cursorMinutes % 60;
          const slotTimestampUTC = createTimestamp(
            tutorDate.getFullYear(),
            tutorDate.getMonth(),
            tutorDate.getDate(),
            slotHour,
            slotMinute,
            tutorTimezone
          );

          if (slotTimestampUTC < dayStartUTC || slotTimestampUTC > dayEndUTC || slotTimestampUTC <= now) {
            cursorMinutes += SLOT_DURATION_MINUTES;
            continue;
          }

          const slotEndUTC = slotTimestampUTC + SLOT_DURATION_MINUTES * 60 * 1000;
          const isBooked = upcomingSessions.some((session) => {
            const sessionStart = session.scheduledAt;
            const sessionEnd = sessionStart + (session.duration || SLOT_DURATION_MINUTES) * 60 * 1000;
            return slotTimestampUTC < sessionEnd && slotEndUTC > sessionStart;
          });

          if (!isBooked) {
            slotsByTimestamp.set(
              slotTimestampUTC,
              formatSessionTime(slotTimestampUTC, viewerTimezone, "h:mm a")
            );
          }

          cursorMinutes += SLOT_DURATION_MINUTES;
        }
      }
    }

    days.push({
      key: `${year}-${month + 1}-${date}`,
      label: formatSessionTime(dayStartUTC, viewerTimezone, "EEEE"),
      dateLabel: formatSessionTime(dayStartUTC, viewerTimezone, "MMM d"),
      hasConfiguredWindows,
      availableTimeSlots: Array.from(slotsByTimestamp.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, label]) => label),
    });
  }

  return days;
}

export default function TutorAvailabilityDisplay({
  availability,
  tutorId,
  tutorTimezone,
  viewerTimezone,
}: TutorAvailabilityDisplayProps) {
  const effectiveViewerTimezone = viewerTimezone || detectUserTimezone();
  const effectiveTutorTimezone = tutorTimezone || effectiveViewerTimezone;
  const viewerTimezoneAbbr = useMemo(
    () => getTimezoneAbbreviation(effectiveViewerTimezone),
    [effectiveViewerTimezone]
  );

  const { data: upcomingSessions = [] } = trpc.session.getUpcomingByTutorId.useQuery({ tutorId });

  const upcomingAvailability = useMemo(
    () =>
      getUpcomingAvailabilityDays(
        availability,
        upcomingSessions,
        effectiveTutorTimezone,
        effectiveViewerTimezone
      ),
    [availability, upcomingSessions, effectiveTutorTimezone, effectiveViewerTimezone]
  );

  const hasAvailability = availability.some((slot) => slot.isActive);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Available Slots (Next 7 Days)
        </CardTitle>
        <CardDescription>
          {`Actual available time slots in your timezone (${viewerTimezoneAbbr}) after considering booked sessions`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasAvailability ? (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No availability schedule set</p>
            <p className="text-sm">Contact the tutor to discuss scheduling options</p>
          </div>
        ) : (
          <div className="space-y-2">
            {upcomingAvailability.map((day) => (
              <div key={day.key} className="group relative">
                <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors">
                  <div>
                    <span className="font-medium text-sm">{day.label}</span>
                    <p className="text-xs text-muted-foreground">{day.dateLabel}</p>
                  </div>
                  <Badge variant={day.availableTimeSlots.length > 0 ? "default" : "secondary"} className="text-xs">
                    {day.availableTimeSlots.length} {day.availableTimeSlots.length === 1 ? "slot" : "slots"} available
                  </Badge>
                </div>

                <div className="absolute left-0 right-0 top-full mt-2 z-50 hidden group-hover:block group-focus-within:block">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 max-w-md">
                    <h4 className="font-semibold text-sm mb-3 text-foreground">
                      {day.label} ({day.dateLabel}) - Available Times
                    </h4>
                    {day.availableTimeSlots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                        {day.availableTimeSlots.map((timeSlot, index) => (
                          <div
                            key={`${day.key}-${timeSlot}-${index}`}
                            className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-2 py-1.5 rounded"
                          >
                            <Clock className="w-3 h-3" />
                            <span>{timeSlot}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No available slots</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
