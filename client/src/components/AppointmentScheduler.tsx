import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar as CalendarIcon, AlertCircle, Globe, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import crypto from "crypto-js";
import {
  COMMON_TIMEZONES,
  detectUserTimezone,
  convertToUTC,
  convertFromUTC,
  createTimestamp,
} from "@/../../shared/timezone-utils";

interface AppointmentSchedulerProps {
  subscriptions: Array<{
    subscription: any;
    course: any;
    tutor: any;
  }>;
  onScheduleComplete?: () => void;
}

export function AppointmentScheduler({ subscriptions, onScheduleComplete }: AppointmentSchedulerProps) {
  const { user } = useAuth();
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringCount, setRecurringCount] = useState<number>(1);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [smsOptIn, setSmsOptIn] = useState<boolean>(false);

  const utils = trpc.useUtils();

  // Get selected subscription details FIRST (before other hooks that depend on it)
  const selectedSubscription = useMemo(() => {
    return subscriptions.find(s => s.subscription.id === selectedSubscriptionId);
  }, [subscriptions, selectedSubscriptionId]);

  const { data: availabilityData } = trpc.subscription.getAvailability.useQuery(
    { subscriptionId: selectedSubscriptionId ?? 0 },
    { enabled: !!selectedSubscriptionId }
  );

  // Fetch tutor's timezone
  const { data: tutorProfile } = trpc.tutorProfile.get.useQuery(
    { userId: selectedSubscription?.tutor?.id ?? 0 },
    { enabled: !!selectedSubscription?.tutor?.id }
  );

  // Fetch parent's timezone
  const { data: parentProfile } = trpc.parentProfile.getMy.useQuery(
    undefined,
    { enabled: true }
  );

  const createSessionMutation = trpc.session.create.useMutation();
  const quickBookRecurringMutation = trpc.session.quickBookRecurring.useMutation();

  // Determine timezones
  const tutorTimezone = tutorProfile?.timezone || detectUserTimezone();
  // user.timezone is kept up-to-date by Settings page (refreshProfile called on save)
  // parentProfile.timezone may be stale if the tRPC cache hasn't been invalidated yet
  const parentTimezone = user?.timezone || detectUserTimezone();

  // Get timezone abbreviation for parent e.g. "EST", "IST"
  const parentTimezoneAbbr = useMemo(() => {
    const tz = COMMON_TIMEZONES.find(t => t.value === parentTimezone);
    if (tz) {
      const match = tz.label.match(/\(([^)]+)\)$/);
      return match ? match[1] : tz.label;
    }
    return '';
  }, [parentTimezone]);

  // Get friendly timezone label
  const parentTimezoneFriendlyName = useMemo(() => {
    const found = COMMON_TIMEZONES.find(tz => tz.value === parentTimezone);
    return found ? found.label : parentTimezone;
  }, [parentTimezone]);

  const tutorTimezoneFriendlyName = useMemo(() => {
    const found = COMMON_TIMEZONES.find(tz => tz.value === tutorTimezone);
    return found ? found.label : tutorTimezone;
  }, [tutorTimezone]);

  // Get duration from selected subscription's course
  const duration = selectedSubscription?.course.duration || 60;

  // Auto-select today's date when subscription is selected
  useEffect(() => {
    if (selectedSubscriptionId && !selectedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setSelectedDate(today);
    }
  }, [selectedSubscriptionId, selectedDate]);

  // Calculate available time slots with timezone conversion
  const availableTimeSlotsMap = useMemo(() => {
    if (!selectedDate || !availabilityData) return new Map<string, number>();

    // Compute day boundaries in UTC for the selected date in the parent's timezone.
    // We use the calendar date values (year/month/day) directly rather than relying
    // on browser-local setHours, which would be wrong when browser TZ != parentTimezone.
    const selectedDayStartUTC = createTimestamp(
      selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
      0, 0, parentTimezone
    );
    const selectedDayEndUTC = createTimestamp(
      selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(),
      23, 59, parentTimezone
    );

    const slotsMap = new Map<string, number>(); // time string -> UTC timestamp
    const booked = availabilityData.booked || [];
    const now = Date.now();

    const selectedDateNoonUTC = createTimestamp(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      12, 0,
      parentTimezone
    );

    // Check adjacent days to handle timezone crossovers
    for (let dayOffset = -1; dayOffset <= 1; dayOffset++) {
      // Build noon UTC for this offset day, entirely in the parent's timezone
      const checkDateNoonUTC = selectedDateNoonUTC + dayOffset * 24 * 60 * 60 * 1000;

      // Convert to tutor's timezone to find day of week
      const checkDateInTutorTZ = convertFromUTC(checkDateNoonUTC, tutorTimezone);
      const tutorDayOfWeek = checkDateInTutorTZ.getDay();

      // Get tutor's availability for this day
      const windows = (availabilityData.availability || []).filter(
        (w: any) => w.dayOfWeek === tutorDayOfWeek
      );

      if (!windows.length) continue;

      // Generate slots in tutor's timezone
      windows.forEach((w: any) => {
        const [sh, sm] = w.startTime.split(":").map(Number);
        const [eh, em] = w.endTime.split(":").map(Number);
        let cursor = sh * 60 + sm;
        const end = eh * 60 + em;

        while (cursor + duration <= end) {
          const tutorHour = Math.floor(cursor / 60);
          const tutorMinute = cursor % 60;

          // Convert slot time to UTC using tutor's timezone directly
          const slotTimestampUTC = createTimestamp(
            checkDateInTutorTZ.getFullYear(),
            checkDateInTutorTZ.getMonth(),
            checkDateInTutorTZ.getDate(),
            tutorHour,
            tutorMinute,
            tutorTimezone
          );

          // Convert to parent's timezone for display
          const slotInParentTZ = convertFromUTC(slotTimestampUTC, parentTimezone);

          // Only include slots within selected day in parent's timezone
          if (slotTimestampUTC < selectedDayStartUTC || slotTimestampUTC > selectedDayEndUTC) {
            cursor += 30;
            continue;
          }

          // Check if slot is in the past
          if (slotTimestampUTC <= now) {
            cursor += 30;
            continue;
          }

          // Check for conflicts with existing bookings
          const slotEndUTC = slotTimestampUTC + duration * 60000;
          const overlaps = booked.some((b: any) => {
            const bs = b.scheduledAt;
            const be = bs + b.duration * 60000;
            return slotTimestampUTC < be && slotEndUTC > bs;
          });

          if (!overlaps) {
            const displayTime = slotInParentTZ.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true
            });
            slotsMap.set(displayTime, slotTimestampUTC);
          }

          cursor += 30;
        }
      });
    }

    // Return sorted map (display string -> UTC timestamp ms)
    return new Map(
      Array.from(slotsMap.entries()).sort((a, b) => a[1] - b[1])
    );
  }, [availabilityData, selectedDate, duration, tutorTimezone, parentTimezone]);

  const availableTimeSlots = useMemo(
    () => Array.from(availableTimeSlotsMap.keys()),
    [availableTimeSlotsMap]
  );

  // Generate preview of recurring sessions
  const recurringPreview = useMemo(() => {
    if (!isRecurring || !selectedDate || !selectedTimeSlot) return [];

    const baseUTC = availableTimeSlotsMap.get(selectedTimeSlot);
    if (!baseUTC) return [];

    const sessions = [];
    const intervalMs = (frequency === "weekly" ? 7 : 14) * 24 * 60 * 60 * 1000;

    for (let i = 0; i < recurringCount; i++) {
      sessions.push(new Date(baseUTC + i * intervalMs));
    }

    return sessions;
  }, [isRecurring, selectedDate, selectedTimeSlot, recurringCount, frequency, availableTimeSlotsMap]);

  // Compute which recurring preview dates conflict with existing bookings
  const recurringConflicts = useMemo(() => {
    if (!recurringPreview.length) return new Set<number>();
    const booked = availabilityData?.booked || [];
    const conflicted = new Set<number>();
    recurringPreview.forEach((sessionDate, i) => {
      const start = sessionDate.getTime();
      const end = start + duration * 60000;
      const hasConflict = booked.some((b: any) => start < b.scheduledAt + b.duration * 60000 && end > b.scheduledAt);
      if (hasConflict) conflicted.add(i);
    });
    return conflicted;
  }, [recurringPreview, availabilityData, duration]);

  // Helper function to book recurring sessions
  const bookRecurringSessions = async (sessionsToBook: Date[]) => {
    if (!selectedSubscription) return;

    const sessions = sessionsToBook.map((date) => ({
      scheduledAt: date.getTime(),
    }));

    await quickBookRecurringMutation.mutateAsync({
      subscriptionId: selectedSubscription.subscription.id,
      courseId: selectedSubscription.course.id,
      tutorId: selectedSubscription.tutor?.id ?? 0,
      sessions,
      duration,
      notes: `Recurring series (${frequency})`,
    });

    const skipped = recurringCount - sessions.length;
    if (skipped > 0) {
      toast.success(`${sessions.length} session${sessions.length > 1 ? 's' : ''} scheduled. ${skipped} conflicting slot${skipped > 1 ? 's were' : ' was'} skipped.`);
    } else {
      toast.success(`${sessions.length} session${sessions.length > 1 ? 's' : ''} scheduled successfully!`);
    }

    // Reset form
    setSelectedDate(undefined);
    setSelectedTimeSlot("");
    setIsRecurring(false);
    setRecurringCount(1);

    // Refresh data
    await utils.session.myUpcoming.invalidate();
    await utils.session.myBookings.invalidate();
    await utils.subscription.getAvailability.invalidate();

    onScheduleComplete?.();
  };

  const handleSchedule = async () => {
    if (!selectedSubscriptionId || !selectedDate || !selectedTimeSlot) {
      toast.error("Please fill all required fields");
      return;
    }

    if (!selectedSubscription) {
      toast.error("Subscription not found");
      return;
    }

    try {
      // Use the pre-computed UTC timestamp from the slots map — do NOT reconstruct
      // from the display string, which would use browser-local timezone and be wrong.
      const scheduledAtUTC = availableTimeSlotsMap.get(selectedTimeSlot);
      if (!scheduledAtUTC) {
        toast.error("Invalid time slot selected. Please try again.");
        return;
      }
      const scheduledDate = new Date(scheduledAtUTC);

      if (isRecurring && recurringCount > 1) {
        // Book only the non-conflicted slots; conflicted ones are shown inline and skipped
        const availableSlots = recurringPreview.filter((_, i) => !recurringConflicts.has(i));

        if (availableSlots.length === 0) {
          toast.error("All selected sessions are already booked. Please choose a different date or time.");
          return;
        }

        await bookRecurringSessions(availableSlots);
      } else {
        // Create single session
        await createSessionMutation.mutateAsync({
          subscriptionId: selectedSubscriptionId,
          tutorId: selectedSubscription.tutor?.id ?? 0,
          parentId: selectedSubscription.subscription.parentId,
          scheduledAt: scheduledDate.getTime(),
          duration,
        });

        toast.success("Session scheduled successfully!");
      }

      // Reset form
      setSelectedDate(undefined);
      setSelectedTimeSlot("");
      setIsRecurring(false);
      setRecurringCount(1);

      // Refresh data
      await utils.session.myUpcoming.invalidate();
      await utils.session.myBookings.invalidate();
      await utils.subscription.getAvailability.invalidate();

      onScheduleComplete?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to schedule session");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Appointment Type Header with Timezone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            New Appointment
          </CardTitle>
          <CardDescription>Schedule a tutoring session</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subscription-select">Select Course & Tutor</Label>
            <Select
              value={selectedSubscriptionId?.toString() || ""}
              onValueChange={(val) => setSelectedSubscriptionId(Number(val))}
            >
              <SelectTrigger id="subscription-select" className="w-full">
                <SelectValue placeholder="Choose a subscription" />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)]">
                {subscriptions.map(({ subscription, course, tutor }) => (
                  <SelectItem
                    key={subscription.id}
                    value={subscription.id.toString()}
                    className="max-w-full"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 w-full truncate">
                      <span className="truncate">
                        {course.title} - {course.duration || 60} min with {tutor?.name || "Tutor"}
                      </span>
                      {subscription.studentFirstName && (
                        <span className="text-muted-foreground text-xs sm:text-sm sm:ml-2 truncate">
                          ({subscription.studentFirstName} {subscription.studentLastName})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedSubscriptionId && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm pt-3 border-t bg-blue-50/50 dark:bg-blue-950/20 rounded-md p-3 sm:p-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <span className="font-semibold text-blue-900 dark:text-blue-100">Your Time Zone:</span>
                </div>
                <span className="text-blue-800 dark:text-blue-200 font-medium ml-7 sm:ml-0">
                  {parentTimezoneFriendlyName} ({parentTimezoneAbbr})
                </span>
                <span className="text-xs text-blue-700/70 dark:text-blue-300/70 ml-7 sm:ml-auto">
                  All times shown in your local timezone
                </span>
              </div>

              {tutorTimezone !== parentTimezone && selectedSubscription && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm bg-amber-50/50 dark:bg-amber-950/20 rounded-md p-3 border border-amber-200 dark:border-amber-800">
                  <span className="text-amber-800 dark:text-amber-200">
                    <span className="font-semibold">Note:</span> {selectedSubscription.tutor?.name} is in {tutorTimezoneFriendlyName}. Times shown are automatically converted to your timezone.
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedSubscriptionId && (
        <>

          {/* Date & Time Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Date & Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Calendar */}
                <div className="space-y-2">
                  <Label>Select Date</Label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) => { const today = new Date(); today.setHours(0, 0, 0, 0); return date < today; }}
                    className="rounded-md border"
                  />
                </div>

                {/* Time Slots */}
                <div className="space-y-2">
                  <Label>Available Time Slots</Label>
                  <div className="border rounded-lg p-4 max-h-[400px] overflow-y-auto space-y-2">
                    {!selectedDate ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Select a date to see available times
                      </p>
                    ) : availableTimeSlots.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No available times for this day
                      </p>
                    ) : (
                      availableTimeSlots.map((time) => (
                        <button
                          key={time}
                          onClick={() => setSelectedTimeSlot(time)}
                          className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                            selectedTimeSlot === time
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted border-border"
                          }`}
                        >
                          {time}{parentTimezoneAbbr && <span className="ml-1 text-xs opacity-70">{parentTimezoneAbbr}</span>}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recurring Options */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="recurring"
                    checked={isRecurring}
                    onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
                  />
                  <Label htmlFor="recurring" className="cursor-pointer">
                    Recurring Appointment
                  </Label>
                </div>
                {isRecurring && (
                  <Badge variant="outline">Series</Badge>
                )}
              </div>
            </CardHeader>
            {isRecurring && (
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="recurring-count">Number of Sessions</Label>
                    <Input
                      id="recurring-count"
                      type="number"
                      min="1"
                      max="52"
                      value={recurringCount}
                      onChange={(e) => setRecurringCount(Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select value={frequency} onValueChange={(val: any) => setFrequency(val)}>
                      <SelectTrigger id="frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="biweekly">Bi-weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedDate && selectedTimeSlot && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">
                      Repeat every {frequency === "weekly" ? "week" : "2 weeks"} on{" "}
                      {format(selectedDate, "EEEE")} at {selectedTimeSlot} starting{" "}
                      {format(selectedDate, "MMMM d, yyyy")} for {recurringCount} times
                    </p>

                    {recurringPreview.length > 0 && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Session dates:</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                          {recurringPreview.map((date, index) => {
                            const isConflict = recurringConflicts.has(index);
                            return (
                              <div
                                key={index}
                                className={`flex items-center justify-between rounded-md px-3 py-1.5 text-xs ${
                                  isConflict
                                    ? "bg-red-50 border border-red-200 text-red-800"
                                    : "bg-green-50 border border-green-200 text-green-800"
                                }`}
                              >
                                <span className="flex items-center gap-1.5">
                                  {isConflict
                                    ? <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                                    : <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                  }
                                  Session {index + 1}: {format(date, "EEE, MMM d, yyyy 'at' h:mm a")}
                                </span>
                                {isConflict && (
                                  <span className="ml-2 font-semibold text-red-600 whitespace-nowrap">Already booked</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {recurringConflicts.size > 0 && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            {recurringConflicts.size} conflicting slot{recurringConflicts.size > 1 ? 's' : ''} will be skipped. {recurringCount - recurringConflicts.size} session{(recurringCount - recurringConflicts.size) !== 1 ? 's' : ''} will be booked.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Student Information (pre-filled) */}
          {selectedSubscription && (
            <Card>
              <CardHeader>
                <CardTitle>Student Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input
                      value={selectedSubscription.subscription.studentFirstName || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input
                      value={selectedSubscription.subscription.studentLastName || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Grade</Label>
                  <Input
                    value={selectedSubscription.subscription.studentGrade || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <Separator />

                {/* SMS Opt-in */}
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="sms-opt-in"
                    checked={smsOptIn}
                    onCheckedChange={(checked) => setSmsOptIn(checked as boolean)}
                  />
                  <div className="space-y-1">
                    <Label
                      htmlFor="sms-opt-in"
                      className="text-sm font-normal cursor-pointer leading-relaxed"
                    >
                      I've received permission from this client to opt them in to receive an SMS
                      reminder message before their appointment.
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Message and data rates may apply. One message per appointment. Deliverability
                      is subject to the recipient country.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedSubscriptionId(null);
                setSelectedDate(undefined);
                setSelectedTimeSlot("");
                setIsRecurring(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={
                !selectedSubscriptionId ||
                !selectedDate ||
                !selectedTimeSlot ||
                (isRecurring && recurringCount > 1 && recurringConflicts.size === recurringCount) ||
                createSessionMutation.isPending ||
                quickBookRecurringMutation.isPending
              }
            >
              {createSessionMutation.isPending || quickBookRecurringMutation.isPending
                ? "Scheduling..."
                : isRecurring && recurringCount > 1
                ? `Add ${recurringCount - recurringConflicts.size} Session${(recurringCount - recurringConflicts.size) !== 1 ? 's' : ''}${recurringConflicts.size > 0 ? ` (skip ${recurringConflicts.size} conflict${recurringConflicts.size > 1 ? 's' : ''})` : ''}`
                : "Schedule Session"}
            </Button>
          </div>
        </>
      )}

    </div>
  );
}
