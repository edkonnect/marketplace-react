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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import crypto from "crypto-js";

interface AppointmentSchedulerProps {
  subscriptions: Array<{
    subscription: any;
    course: any;
    tutor: any;
  }>;
  onScheduleComplete?: () => void;
}

export function AppointmentScheduler({ subscriptions, onScheduleComplete }: AppointmentSchedulerProps) {
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState<boolean>(false);
  const [recurringCount, setRecurringCount] = useState<number>(1);
  const [frequency, setFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [smsOptIn, setSmsOptIn] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [showConflictDialog, setShowConflictDialog] = useState<boolean>(false);
  const [conflictInfo, setConflictInfo] = useState<{
    conflicts: Date[];
    validSessions: Date[];
  } | null>(null);

  const utils = trpc.useUtils();
  const { data: availabilityData } = trpc.subscription.getAvailability.useQuery(
    { subscriptionId: selectedSubscriptionId ?? 0 },
    { enabled: !!selectedSubscriptionId }
  );

  const createSessionMutation = trpc.session.create.useMutation();
  const quickBookRecurringMutation = trpc.session.quickBookRecurring.useMutation();

  // Get user timezone
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneOffset = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();

  // Get selected subscription details
  const selectedSubscription = useMemo(() => {
    return subscriptions.find(s => s.subscription.id === selectedSubscriptionId);
  }, [subscriptions, selectedSubscriptionId]);

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

  // Calculate available time slots
  const availableTimeSlots = useMemo(() => {
    if (!selectedDate || !availabilityData) return [];

    const day = selectedDate.getDay();
    const windows = (availabilityData.availability || []).filter((w: any) => w.dayOfWeek === day);
    if (!windows.length) return [];

    const booked = availabilityData.booked || [];
    const slots: string[] = [];
    const now = Date.now();

    windows.forEach((w: any) => {
      const [sh, sm] = w.startTime.split(":").map(Number);
      const [eh, em] = w.endTime.split(":").map(Number);
      let cursor = sh * 60 + sm;
      const end = eh * 60 + em;

      while (cursor + duration <= end) {
        const start = new Date(selectedDate);
        start.setHours(Math.floor(cursor / 60), cursor % 60, 0, 0);
        const startMs = start.getTime();
        const endMs = startMs + duration * 60000;

        if (startMs <= now) {
          cursor += 30;
          continue;
        }

        const overlaps = booked.some((b: any) => {
          const bs = b.scheduledAt;
          const be = bs + b.duration * 60000;
          return startMs < be && endMs > bs;
        });

        if (!overlaps) {
          slots.push(start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
        }

        cursor += 30;
      }
    });

    return Array.from(new Set(slots));
  }, [availabilityData, selectedDate, duration]);

  // Generate preview of recurring sessions
  const recurringPreview = useMemo(() => {
    if (!isRecurring || !selectedDate || !selectedTimeSlot) return [];

    const sessions = [];
    const intervalDays = frequency === "weekly" ? 7 : 14;
    const baseDate = new Date(selectedDate);
    const [hours, minutes] = selectedTimeSlot.match(/(\d+):(\d+)/)?.slice(1).map(Number) || [0, 0];
    const isPM = selectedTimeSlot.toLowerCase().includes("pm") && hours !== 12;
    const is12AM = selectedTimeSlot.toLowerCase().includes("am") && hours === 12;

    baseDate.setHours(isPM ? hours + 12 : is12AM ? 0 : hours, minutes, 0, 0);

    for (let i = 0; i < recurringCount; i++) {
      const sessionDate = new Date(baseDate);
      sessionDate.setDate(baseDate.getDate() + (i * intervalDays));
      sessions.push(sessionDate);
    }

    return sessions;
  }, [isRecurring, selectedDate, selectedTimeSlot, recurringCount, frequency]);

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

    toast.success(`${sessions.length} session${sessions.length > 1 ? 's' : ''} scheduled successfully!`);

    // Reset form
    setSelectedDate(undefined);
    setSelectedTimeSlot("");
    setIsRecurring(false);
    setRecurringCount(1);
    setShowPreview(false);

    // Refresh data
    await utils.session.myUpcoming.invalidate();
    await utils.session.myBookings.invalidate();
    await utils.subscription.getAvailability.invalidate();

    onScheduleComplete?.();
  };

  const handleConfirmPartialBooking = async () => {
    if (!conflictInfo) return;

    setShowConflictDialog(false);

    try {
      await bookRecurringSessions(conflictInfo.validSessions);
    } catch (error: any) {
      toast.error(error.message || "Failed to schedule sessions");
    }

    setConflictInfo(null);
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
      const [hours, minutes] = selectedTimeSlot.match(/(\d+):(\d+)/)?.slice(1).map(Number) || [0, 0];
      const isPM = selectedTimeSlot.toLowerCase().includes("pm") && hours !== 12;
      const is12AM = selectedTimeSlot.toLowerCase().includes("am") && hours === 12;

      const scheduledDate = new Date(selectedDate);
      scheduledDate.setHours(isPM ? hours + 12 : is12AM ? 0 : hours, minutes, 0, 0);

      if (isRecurring && recurringCount > 1) {
        // Check for conflicts in recurring sessions
        const booked = availabilityData?.booked || [];
        const conflicts = recurringPreview.filter((sessionDate) => {
          const sessionStart = sessionDate.getTime();
          const sessionEnd = sessionStart + duration * 60000;

          return booked.some((b: any) => {
            const bookedStart = b.scheduledAt;
            const bookedEnd = bookedStart + b.duration * 60000;
            return sessionStart < bookedEnd && sessionEnd > bookedStart;
          });
        });

        if (conflicts.length > 0) {
          // Show conflict dialog instead of blocking
          const validSessions = recurringPreview.filter(date => !conflicts.includes(date));

          if (validSessions.length === 0) {
            // All sessions conflict - block completely
            toast.error("All sessions in this series conflict with existing bookings. Please choose a different time.");
            return;
          }

          // Some conflicts - show confirmation dialog
          setConflictInfo({ conflicts, validSessions });
          setShowConflictDialog(true);
          return;
        }

        // No conflicts - proceed with booking
        await bookRecurringSessions(recurringPreview);
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
      setShowPreview(false);

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
            <div className="flex flex-wrap items-center gap-2 text-sm pt-2 border-t">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="font-medium">Client's Time Zone:</span>
              <span className="text-muted-foreground truncate">
                ({timezoneOffset}) {userTimezone}
              </span>
            </div>
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
                    disabled={(date) => date < new Date()}
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
                          {time}
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
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="text-sm text-primary hover:underline"
                        >
                          {showPreview ? "Hide" : "Show"} session dates
                        </button>
                        {showPreview && (
                          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {recurringPreview.map((date, index) => (
                              <p key={index} className="text-xs text-muted-foreground">
                                Session {index + 1}: {format(date, "EEEE, MMMM d, yyyy 'at' h:mm a")}
                              </p>
                            ))}
                          </div>
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
                createSessionMutation.isPending ||
                quickBookRecurringMutation.isPending
              }
            >
              {createSessionMutation.isPending || quickBookRecurringMutation.isPending
                ? "Scheduling..."
                : isRecurring && recurringCount > 1
                ? `Add ${recurringCount} Sessions`
                : "Schedule Session"}
            </Button>
          </div>
        </>
      )}

      {/* Conflict Confirmation Dialog */}
      <AlertDialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Booking Conflicts Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                {conflictInfo && (
                  <>
                    <strong>{conflictInfo.conflicts.length}</strong> out of{" "}
                    <strong>{recurringCount}</strong> session{recurringCount > 1 ? 's' : ''} conflict with existing bookings:
                  </>
                )}
              </p>

              {conflictInfo && conflictInfo.conflicts.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <p className="text-sm font-medium text-amber-900 mb-2">Conflicting Dates:</p>
                  <ul className="text-sm text-amber-800 space-y-1">
                    {conflictInfo.conflicts.map((date, idx) => (
                      <li key={idx}>
                        • {date.toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        at {date.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-sm">
                {conflictInfo && (
                  <>
                    These sessions will be <strong>skipped</strong>. Would you like to continue and book the remaining{" "}
                    <strong className="text-green-600">{conflictInfo.validSessions.length}</strong> session{conflictInfo.validSessions.length > 1 ? 's' : ''}?
                  </>
                )}
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowConflictDialog(false);
              setConflictInfo(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPartialBooking}
              className="bg-green-600 hover:bg-green-700"
            >
              Book {conflictInfo?.validSessions.length} Session{conflictInfo && conflictInfo.validSessions.length > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
