import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import {
  detectUserTimezone,
  convertFromUTC,
  createTimestamp,
  formatSessionTime,
} from "@/../../shared/timezone-utils";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const SLOT_DURATION_MINUTES = 60;

interface TutorAvailabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutorId: number;
  // Needed to resolve which Acuity appointment type to check live availability
  // against. If omitted, the modal falls back to the old tutor_availability-based
  // calculation (no live check) — still works, just not double-booking-proof.
  courseId?: number;
  tutorName?: string;
  tutorTimezone?: string | null;
  viewerTimezone?: string;
  onViewerTimezoneChange?: (tz: string) => void;
  availability: Array<{
    id: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }>;
}

export function TutorAvailabilityModal({
  open,
  onOpenChange,
  tutorId,
  courseId,
  tutorName,
  tutorTimezone,
  viewerTimezone: externalViewerTz,
  onViewerTimezoneChange,
  availability,
}: TutorAvailabilityModalProps) {
  const [activeTab, setActiveTab] = useState("this-week");
  const [internalViewerTz, setInternalViewerTz] = useState<string>(() => detectUserTimezone());

  // Use external viewer timezone if provided (controlled), else use internal state
  const viewerTz = externalViewerTz || internalViewerTz;
  const setViewerTz = (tz: string) => {
    if (onViewerTimezoneChange) {
      onViewerTimezoneChange(tz);
    } else {
      setInternalViewerTz(tz);
    }
  };

  const effectiveTutorTz = tutorTimezone || viewerTz;

  // Fetch upcoming sessions for this tutor (fallback path only)
  const { data: upcomingSessions = [] } = trpc.session.getUpcomingByTutorId.useQuery(
    { tutorId },
    { enabled: open }
  );

  // Live Acuity availability — the source of truth for "This Week" when available.
  // Reflects the tutor's real Acuity calendar right now, so a class booked
  // directly in Acuity (never synced into our sessions table) still correctly
  // blocks the slot instead of showing as free.
  const {
    data: liveSlotsData,
    isLoading: isLoadingLiveSlots,
  } = trpc.tutorAvailability.getLiveSlots.useQuery(
    { tutorId, courseId: courseId as number },
    { enabled: open && !!courseId, retry: false }
  );

  const liveAvailable = liveSlotsData?.ok === true;
  
  
  // Timezone-aware slot calculation for "This Week" tab — LIVE path.
  // Groups Acuity's raw slot timestamps into the viewer's local days.
  const liveAvailabilityDays = useMemo(() => {
    if (!liveAvailable || !liveSlotsData || liveSlotsData.ok !== true) return [];

    const now = Date.now();
    const viewerToday = convertFromUTC(now, viewerTz);
    viewerToday.setHours(0, 0, 0, 0);

    // Flatten all slot timestamps from every returned Acuity day into one list —
    // we re-bucket them by the VIEWER's calendar day below, since Acuity's own
    // `date` grouping is in the tutor's calendar timezone, not the viewer's.
    const allSlotTimestamps: number[] = [];
    for (const day of liveSlotsData.days) {
      for (const slot of day.slots) {
        const ms = Date.parse(slot.time);
        if (!Number.isNaN(ms)) allSlotTimestamps.push(ms);
      }
    }

    const days: Array<{
      key: string;
      label: string;
      dateLabel: string;
      dayOfWeek: number;
      availableTimeSlots: string[];
    }> = [];

    for (let offset = 0; offset < 7; offset++) {
      const dayDate = new Date(viewerToday);
      dayDate.setDate(viewerToday.getDate() + offset);

      const year = dayDate.getFullYear();
      const month = dayDate.getMonth();
      const date = dayDate.getDate();

      const dayStartUTC = createTimestamp(year, month, date, 0, 0, viewerTz);
      const dayEndUTC = createTimestamp(year, month, date, 23, 59, viewerTz);

      const slotsThisDay = allSlotTimestamps
        .filter((ms) => ms >= dayStartUTC && ms <= dayEndUTC && ms > now)
        .sort((a, b) => a - b)
        .map((ms) => formatSessionTime(ms, viewerTz, "h:mm a"));

      days.push({
        key: `${year}-${month + 1}-${date}`,
        label: formatSessionTime(dayStartUTC, viewerTz, "EEEE"),
        dateLabel: formatSessionTime(dayStartUTC, viewerTz, "MMM d"),
        dayOfWeek: dayDate.getDay(),
        availableTimeSlots: slotsThisDay,
      });
    }

    
    return days;
  }, [liveAvailable, liveSlotsData, viewerTz]);
  

  // Timezone-aware slot calculation for "This Week" tab — FALLBACK path
  // (used when live Acuity data isn't available for this tutor/course combo,
  // e.g. not mapped in Acuity yet). Same logic as before.
  const fallbackAvailabilityDays = useMemo(() => {
    const now = Date.now();
    const viewerToday = convertFromUTC(now, viewerTz);
    viewerToday.setHours(0, 0, 0, 0);

    const days: Array<{
      key: string;
      label: string;
      dateLabel: string;
      dayOfWeek: number;
      availableTimeSlots: string[];
    }> = [];

    for (let offset = 0; offset < 7; offset++) {
      const dayDate = new Date(viewerToday);
      dayDate.setDate(viewerToday.getDate() + offset);

      const year = dayDate.getFullYear();
      const month = dayDate.getMonth();
      const date = dayDate.getDate();

      const dayStartUTC = createTimestamp(year, month, date, 0, 0, viewerTz);
      const dayEndUTC = createTimestamp(year, month, date, 23, 59, viewerTz);
      const dayNoonUTC = createTimestamp(year, month, date, 12, 0, viewerTz);
      const slotsByTimestamp = new Map<number, string>();

      for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
        const checkDateNoonUTC = dayNoonUTC + dayOffset * 24 * 60 * 60 * 1000;
        const tutorDate = convertFromUTC(checkDateNoonUTC, effectiveTutorTz);
        const dayWindows = availability.filter(
          (slot) => slot.isActive && slot.dayOfWeek === tutorDate.getDay()
        );

        if (!dayWindows.length) continue;

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
              effectiveTutorTz
            );

            if (
              slotTimestampUTC < dayStartUTC ||
              slotTimestampUTC > dayEndUTC ||
              slotTimestampUTC <= now
            ) {
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
                formatSessionTime(slotTimestampUTC, viewerTz, "h:mm a")
              );
            }

            cursorMinutes += SLOT_DURATION_MINUTES;
          }
        }
      }

      days.push({
        key: `${year}-${month + 1}-${date}`,
        label: formatSessionTime(dayStartUTC, viewerTz, "EEEE"),
        dateLabel: formatSessionTime(dayStartUTC, viewerTz, "MMM d"),
        dayOfWeek: dayDate.getDay(),
        availableTimeSlots: Array.from(slotsByTimestamp.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, label]) => label),
      });
    }

    return days;
  }, [availability, upcomingSessions, effectiveTutorTz, viewerTz]);

  // Use live data whenever it's available; otherwise fall back to the
  // tutor_availability-based calculation.
  const upcomingAvailabilityDays = liveAvailable ? liveAvailabilityDays : fallbackAvailabilityDays;

  // Timezone-aware general schedule for "General Schedule" tab
  // (always the recurring tutor_availability table — unaffected by live checks)
  const generalScheduleByDay = useMemo(() => {
    return DAYS_OF_WEEK.map((day) => {
      const daySlots = availability.filter(
        (slot) => slot.dayOfWeek === day.value && slot.isActive
      );

      const convertedSlots = daySlots.map((slot) => {
        const [startHour, startMinute] = slot.startTime.split(":").map(Number);
        const [endHour, endMinute] = slot.endTime.split(":").map(Number);

        // Use a fixed reference week (first week of Jan 2024) for display-only conversion
        const startUTC = createTimestamp(2024, 0, 7 + slot.dayOfWeek, startHour, startMinute, effectiveTutorTz);
        let endUTC = createTimestamp(2024, 0, 7 + slot.dayOfWeek, endHour, endMinute, effectiveTutorTz);
        if (endUTC <= startUTC) endUTC += 24 * 60 * 60 * 1000;

        const startLabel = formatSessionTime(startUTC, viewerTz, "h:mm a");
        const endLabel = formatSessionTime(endUTC, viewerTz, "h:mm a");

        return { id: slot.id, startTime: startLabel, endTime: endLabel };
      });

      return { ...day, slots: convertedSlots };
    });
  }, [availability, effectiveTutorTz, viewerTz]);

  // When using live data, show every day of the week regardless of what's
  // configured in tutor_availability (live data doesn't depend on that table).
  // When using the fallback, keep the original behavior of only showing days
  // that have a configured availability window.
  const daysWithSlots = liveAvailable
    ? upcomingAvailabilityDays
    : upcomingAvailabilityDays.filter((day) => {
        const hasWindows = availability.some(
          (slot) => slot.isActive && slot.dayOfWeek === day.dayOfWeek
        );
        return hasWindows;
      });

  const timezonesDiffer =
    tutorTimezone && tutorTimezone !== viewerTz;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {tutorName ? `${tutorName}'s Availability` : "Tutor Availability"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="this-week">This Week</TabsTrigger>
            <TabsTrigger value="general">General Schedule</TabsTrigger>
          </TabsList>

          {/* Timezone Selector — shown below tabs */}
          <div className="mt-3 px-1">
            <div className="text-xs text-muted-foreground mb-1">
              {timezonesDiffer
                ? `Tutor's schedule is in ${tutorTimezone}. Slots shown in:`
                : "Slots shown in:"}
            </div>
            <TimezoneSelector
              value={viewerTz}
              onChange={setViewerTz}
              label=""
              showDetected={false}
              className="!space-y-0"
            />
          </div>

          <TabsContent value="this-week" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <Clock className="w-4 h-4" />
                <span>Available time slots for the next 7 days (after considering bookings)</span>
              </div>

              <div className="space-y-2">
                {open && courseId && isLoadingLiveSlots ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Checking live availability…
                  </p>
                ) : daysWithSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No availability configured
                  </p>
                ) : (
                  daysWithSlots.map((day) => (
                    <div key={day.key} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-semibold text-base">{day.label}</span>
                          <span className="text-sm text-muted-foreground ml-2">{day.dateLabel}</span>
                        </div>
                        <Badge variant={day.availableTimeSlots.length > 0 ? "default" : "secondary"}>
                          {day.availableTimeSlots.length}{" "}
                          {day.availableTimeSlots.length === 1 ? "slot" : "slots"} available
                        </Badge>
                      </div>

                      {day.availableTimeSlots.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {day.availableTimeSlots.map((timeSlot, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-center gap-1 text-sm bg-primary/10 text-primary px-2 py-1.5 rounded"
                            >
                              <Clock className="w-3 h-3" />
                              <span className="text-xs sm:text-sm">{timeSlot}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No available slots</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="general" className="flex-1 overflow-y-auto mt-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <CalendarIcon className="w-4 h-4" />
                <span>Typical weekly schedule (recurring availability)</span>
              </div>

              <div className="space-y-3">
                {generalScheduleByDay.map((day) => (
                  <div
                    key={day.value}
                    className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${
                      day.slots.length > 0
                        ? "bg-primary/5 border-primary/20"
                        : "bg-muted/30 border-border"
                    }`}
                  >
                    <div className="min-w-[100px]">
                      <p
                        className={`text-sm font-semibold ${
                          day.slots.length > 0 ? "text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {day.label}
                      </p>
                    </div>
                    <div className="flex-1">
                      {day.slots.length > 0 ? (
                        <div className="space-y-1">
                          {day.slots.map((slot) => (
                            <div key={slot.id} className="flex items-center gap-2 text-sm">
                              <Clock className="w-3 h-3 text-primary" />
                              <span>
                                {slot.startTime} – {slot.endTime}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Not available</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}