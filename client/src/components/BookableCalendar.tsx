import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Clock, Repeat, Globe } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  COMMON_TIMEZONES,
  detectUserTimezone,
  getDayOfWeekInTimezone,
  createTimestamp,
  formatSessionTime,
  convertFromUTC,
  convertToUTC,
} from "@/../../shared/timezone-utils";

interface TimeSlot {
  time: string; // Time in tutor's timezone (for reference)
  available: boolean;
  displayTime: string; // Time as displayed to user in their timezone
  timestampUTC: number; // UTC timestamp for this slot
}

interface BookableCalendarProps {
  tutorId: number;
  tutorName: string;
  courseId: number;
  courseName: string;
  sessionDuration: number; // in minutes
  isTrial?: boolean; // Flag for trial booking mode
  onBookingComplete: (scheduledAt?: number) => void; // Pass scheduledAt for trial mode
}

type RecurringFrequency = 'once' | 'weekly' | 'biweekly';

interface RecurringSession {
  date: Date;
  time: string;
  displayTime: string;
  timestampUTC: number;
}

export function BookableCalendar({
  tutorId,
  tutorName,
  courseId,
  courseName,
  sessionDuration,
  isTrial = false,
  onBookingComplete,
}: BookableCalendarProps) {
  const { user } = useAuthContext();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('once');
  const [numberOfWeeks, setNumberOfWeeks] = useState<number>(4);
  const [recurringSessions, setRecurringSessions] = useState<RecurringSession[]>([]);

  // Fetch tutor's profile to get their timezone
  const { data: tutorProfile } = trpc.tutorProfile.get.useQuery(
    { userId: tutorId },
    { enabled: !!tutorId }
  );

  // Fetch parent's profile to get their timezone
  const { data: parentProfile } = trpc.parentProfile.get.useQuery(
    { userId: user?.id || 0 },
    { enabled: !!user?.id && user?.role === 'parent' }
  );

  // Fetch tutor's weekly availability
  const { data: tutorAvailability = [] } = trpc.tutorAvailability.getByTutorId.useQuery(
    { tutorId },
    { enabled: !!tutorId }
  );

  // Fetch tutor's time blocks (unavailable periods)
  const { data: tutorTimeBlocks = [] } = trpc.tutorAvailability.getTimeBlocksByTutorId.useQuery(
    { tutorId },
    { enabled: !!tutorId }
  );

  // Fetch tutor's upcoming sessions to check for conflicts
  const { data: tutorSessions = [] } = trpc.session.getUpcomingByTutorId.useQuery(
    { tutorId },
    { enabled: !!tutorId }
  );

  // Determine timezones
  const tutorTimezone = tutorProfile?.timezone || detectUserTimezone();
  // user.timezone is kept in sync by Settings (refreshProfile on save), so prefer it over the cached parentProfile query
  const parentTimezone = user?.timezone || parentProfile?.timezone || detectUserTimezone();

  // Get friendly timezone names
  const parentTimezoneName = useMemo(() => {
    const found = COMMON_TIMEZONES.find(tz => tz.value === parentTimezone);
    return found ? found.label : parentTimezone;
  }, [parentTimezone]);

  const tutorTimezoneName = useMemo(() => {
    const found = COMMON_TIMEZONES.find(tz => tz.value === tutorTimezone);
    return found ? found.label : tutorTimezone;
  }, [tutorTimezone]);

  // Get timezone abbreviation for parent e.g. "EST", "IST"
  const parentTimezoneAbbr = useMemo(() => {
    const tz = COMMON_TIMEZONES.find(t => t.value === parentTimezone);
    if (tz) {
      const match = tz.label.match(/\(([^)]+)\)$/);
      return match ? match[1] : tz.label;
    }
    return '';
  }, [parentTimezone]);

  // Generate time slots from 8 AM to 8 PM based on actual availability
  const generateTimeSlots = (): TimeSlot[] => {
    if (!selectedDate) return [];


    // Set to midnight in parent's local time for the selected date
    const selectedDayStart = new Date(selectedDate);
    selectedDayStart.setHours(0, 0, 0, 0);

    const selectedDayEnd = new Date(selectedDate);
    selectedDayEnd.setHours(23, 59, 59, 999);

    const slotsMap = new Map<string, TimeSlot>();

    // Check the selected day and adjacent days to handle timezone conversions
    // that might cause slots to appear on different days
    for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
      // Create a date for checking (could be yesterday, today, or tomorrow)
      const checkDate = new Date(selectedDate);
      checkDate.setDate(checkDate.getDate() + dayOffset);
      checkDate.setHours(12, 0, 0, 0); // Use noon to determine day of week

      // Convert this date to tutor's timezone to find what day of week it is for the tutor
      const checkDateUTC = convertToUTC(checkDate, parentTimezone);
      const checkDateInTutorTZ = convertFromUTC(checkDateUTC, tutorTimezone);
      const tutorDayOfWeek = checkDateInTutorTZ.getDay();

      // Get tutor's availability for this day of week
      const dayAvailability = tutorAvailability.filter(
        (slot: any) => slot.dayOfWeek === tutorDayOfWeek && slot.isActive
      );

      if (dayAvailability.length === 0) {
        continue;
      }

      // For this tutor day, generate all time slots according to their availability
      for (let tutorHour = 0; tutorHour < 24; tutorHour++) {
        for (let tutorMinute = 0; tutorMinute < 60; tutorMinute += 30) {
          const tutorMinutes = tutorHour * 60 + tutorMinute;

          // Check if this time falls within tutor's availability window
          let isInAvailabilityWindow = false;
          for (const availability of dayAvailability) {
            const [startHour, startMin] = availability.startTime.split(':').map(Number);
            const [endHour, endMin] = availability.endTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            if (tutorMinutes >= startMinutes && tutorMinutes < endMinutes) {
              isInAvailabilityWindow = true;
              break;
            }
          }

          if (!isInAvailabilityWindow) {
            continue;
          }

          // Convert slot time to UTC using tutor's timezone directly
          const slotTimestampUTC = createTimestamp(
            checkDateInTutorTZ.getFullYear(),
            checkDateInTutorTZ.getMonth(),
            checkDateInTutorTZ.getDate(),
            tutorHour,
            tutorMinute,
            tutorTimezone
          );

          // Convert to parent's timezone to see when this slot appears for the parent
          const slotInParentTZ = convertFromUTC(slotTimestampUTC, parentTimezone);

          // Only include slots that fall within the selected day in parent's timezone
          if (slotInParentTZ < selectedDayStart || slotInParentTZ > selectedDayEnd) {
            continue;
          }

          const parentHour = slotInParentTZ.getHours();
          const parentMinute = slotInParentTZ.getMinutes();
          const displayTime = `${parentHour.toString().padStart(2, "0")}:${parentMinute.toString().padStart(2, "0")}`;
          // Check if this time is blocked by a time block (using UTC timestamp)
          let isBlocked = false;
          for (const block of tutorTimeBlocks) {
            if (slotTimestampUTC >= block.startTime && slotTimestampUTC < block.endTime) {
              isBlocked = true;
              break;
            }
          }

          if (isBlocked) {
            continue; // Skip blocked slots
          }

          // Check if this time conflicts with an existing session (using UTC timestamps)
          let hasConflict = false;
          const newSessionStart = slotTimestampUTC;
          const newSessionEnd = slotTimestampUTC + (sessionDuration * 60000);

          for (const session of tutorSessions) {
            const existingSessionStart = session.scheduledAt;
            const existingSessionEnd = existingSessionStart + (session.duration * 60000);

            const overlaps = (
              (newSessionStart >= existingSessionStart && newSessionStart < existingSessionEnd) ||
              (newSessionEnd > existingSessionStart && newSessionEnd <= existingSessionEnd) ||
              (newSessionStart <= existingSessionStart && newSessionEnd >= existingSessionEnd)
            );

            if (overlaps) {
              hasConflict = true;
              break;
            }
          }

          // Only add available slots that aren't already in the map
          const tutorTime = `${tutorHour.toString().padStart(2, "0")}:${tutorMinute.toString().padStart(2, "0")}`;
          if (!hasConflict && !slotsMap.has(displayTime)) {
            slotsMap.set(displayTime, {
              time: tutorTime, // Store tutor's time for reference
              available: true,
              displayTime, // Display parent's time in UI
              timestampUTC: slotTimestampUTC // Store UTC timestamp for booking
            });
          }
        }
      }
    }

    // Convert map to array and sort by display time
    return Array.from(slotsMap.values()).sort((a, b) => {
      const [aHour, aMin] = a.displayTime.split(':').map(Number);
      const [bHour, bMin] = b.displayTime.split(':').map(Number);
      return (aHour * 60 + aMin) - (bHour * 60 + bMin);
    });
  };

  const timeSlots = generateTimeSlots();

  const handleTimeSlotClick = (slot: TimeSlot) => {
    setSelectedSlot(slot);

    // Calculate recurring sessions if applicable
    if (selectedDate && recurringFrequency !== 'once') {
      const sessions: RecurringSession[] = [];
      const weekIncrement = recurringFrequency === 'weekly' ? 1 : 2;

      for (let i = 0; i < numberOfWeeks; i++) {
        const weeksToAdd = i * weekIncrement;
        // Add weeks to the UTC timestamp to calculate recurring session times
        const recurringTimestampUTC = slot.timestampUTC + (weeksToAdd * 7 * 24 * 60 * 60 * 1000);

        // Convert back to parent timezone for display
        const recurringDateInParentTZ = convertFromUTC(recurringTimestampUTC, parentTimezone);

        sessions.push({
          date: recurringDateInParentTZ,
          time: slot.time,
          displayTime: slot.displayTime,
          timestampUTC: recurringTimestampUTC
        });
      }

      setRecurringSessions(sessions);
    } else {
      setRecurringSessions([]);
    }

    setIsConfirmDialogOpen(true);
  };

  const bookSessionMutation = trpc.session.quickBook.useMutation({
    onSuccess: () => {
      toast.success("Session booked successfully!");
      setIsConfirmDialogOpen(false);
      onBookingComplete();
    },
    onError: (error) => {
      toast.error(`Failed to book session: ${error.message}`);
    },
  });

  const bookRecurringMutation = trpc.session.quickBookRecurring.useMutation({
    onSuccess: (data) => {
      if (data.totalFailed > 0) {
        toast.warning(`Booked ${data.totalBooked} sessions. ${data.totalFailed} sessions failed.`);
      } else {
        toast.success(`Successfully booked ${data.totalBooked} recurring sessions!`);
      }
      setIsConfirmDialogOpen(false);
      onBookingComplete();
    },
    onError: (error) => {
      toast.error(`Failed to book recurring sessions: ${error.message}`);
    },
  });

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;

    // Use the UTC timestamp from the selected slot (already calculated correctly)
    const scheduledTimestampUTC = selectedSlot.timestampUTC;

    if (isTrial) {
      // For trial mode, just pass the scheduled time back to parent component
      onBookingComplete(scheduledTimestampUTC);
      setIsConfirmDialogOpen(false);
      return;
    }

    if (recurringSessions.length > 0) {
      // Book multiple recurring sessions using their pre-calculated UTC timestamps
      const sessions = recurringSessions.map(session => ({
        scheduledAt: session.timestampUTC
      }));

      bookRecurringMutation.mutate({
        courseId,
        tutorId,
        sessions,
        duration: sessionDuration,
      });
    } else {
      // Book single session
      bookSessionMutation.mutate({
        courseId,
        tutorId,
        scheduledAt: scheduledTimestampUTC,
        duration: sessionDuration,
      });
    }
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Timezone Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm bg-blue-50/50 dark:bg-blue-950/20 rounded-md p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="font-semibold text-blue-900 dark:text-blue-100">Your Time Zone:</span>
        </div>
        <span className="text-blue-800 dark:text-blue-200 font-medium ml-7 sm:ml-0">
          {parentTimezoneName} ({parentTimezoneAbbr})
        </span>
        <span className="text-xs text-blue-700/70 dark:text-blue-300/70 ml-7 sm:ml-auto">
          All times shown in your local timezone
        </span>
      </div>

      {tutorTimezone !== parentTimezone && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm bg-amber-50/50 dark:bg-amber-950/20 rounded-md p-3 border border-amber-200 dark:border-amber-800">
          <span className="text-amber-800 dark:text-amber-200">
            <span className="font-semibold">Note:</span> {tutorName} is in {tutorTimezoneName} ({tutorTimezone}). Times shown are automatically converted to your timezone ({parentTimezone}).
          </span>
        </div>
      )}


      {/* Recurring Options - Hide for trial lessons */}
      {!isTrial && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Repeat className="w-5 h-5" />
            <h3 className="text-base sm:text-lg font-semibold">Booking Options</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <Select value={recurringFrequency} onValueChange={(value) => setRecurringFrequency(value as RecurringFrequency)}>
                <SelectTrigger id="frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One-time session</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly (every 2 weeks)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          {recurringFrequency !== 'once' && (
            <div>
              <Label htmlFor="weeks">Number of Sessions</Label>
              <Input
                id="weeks"
                type="number"
                min={2}
                max={52}
                value={numberOfWeeks}
                onChange={(e) => setNumberOfWeeks(parseInt(e.target.value) || 4)}
              />
            </div>
          )}
        </div>
        {recurringFrequency !== 'once' && (
          <p className="text-sm text-muted-foreground mt-2">
            You'll book {numberOfWeeks} sessions, {recurringFrequency === 'weekly' ? 'every week' : 'every 2 weeks'}
          </p>
        )}
      </Card>
      )}

      {isTrial && (
        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎉</span>
            <h3 className="text-base sm:text-lg font-semibold text-blue-900 dark:text-blue-100">Free Trial Lesson</h3>
          </div>
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Select a convenient time for your 60-minute trial session.
          </p>
        </div>
      )}

      <div>
        <h3 className="text-base sm:text-lg font-semibold mb-4">Select a Date</h3>
        <Card className="p-4 inline-block">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={(date) => {
              // Disable past dates
              if (date < new Date()) return true;

              // Disable Sundays
              if (date.getDay() === 0) return true;

              // Disable dates with no availability slots
              const dayOfWeek = date.getDay();
              const hasAvailability = tutorAvailability.some(
                (slot: any) => slot.dayOfWeek === dayOfWeek && slot.isActive
              );

              return !hasAvailability;
            }}
            className="rounded-md"
          />
        </Card>
      </div>

      {selectedDate && (
        <div>
          <h3 className="text-base sm:text-lg font-semibold mb-4">
            Available Time Slots - {formatDate(selectedDate)}
          </h3>
          {timeSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No available time slots for this day.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {timeSlots.map((slot) => (
                <Button
                  key={slot.time}
                  variant="outline"
                  onClick={() => handleTimeSlotClick(slot)}
                  className="h-12 sm:h-14 flex flex-col items-center justify-center hover:bg-primary hover:text-primary-foreground"
                >
                  <Clock className="w-3 h-3 mb-1" />
                  <span className="text-xs sm:text-sm font-medium">{slot.displayTime}</span>
                  {parentTimezoneAbbr && <span className="text-[10px] opacity-60">{parentTimezoneAbbr}</span>}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {recurringSessions.length > 0 ? `Confirm ${recurringSessions.length} Recurring Sessions` : 'Confirm Session Booking'}
            </DialogTitle>
            <DialogDescription>
              Please review the session details before confirming your booking.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Course</p>
                <p className="font-medium">{courseName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tutor</p>
                <p className="font-medium">{tutorName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{sessionDuration} minutes</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
                <p className="font-medium">{recurringSessions.length > 0 ? recurringSessions.length : 1}</p>
              </div>
            </div>

            {recurringSessions.length > 0 ? (
              <div>
                <p className="text-sm font-medium mb-2">Scheduled Sessions:</p>
                <div className="max-h-60 overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2">#</th>
                        <th className="text-left p-2">Date</th>
                        <th className="text-left p-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recurringSessions.map((session, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{index + 1}</td>
                          <td className="p-2">{formatDate(session.date)}</td>
                          <td className="p-2">{session.displayTime}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">{formatDate(selectedDate)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {selectedSlot?.displayTime || ''}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsConfirmDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleConfirmBooking} className="w-full sm:w-auto">Confirm Booking</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
