import { useState, useMemo } from "react";
import type { ReactElement } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Calendar as CalendarIcon, Clock, Edit, Trash2, RefreshCw, Star } from "lucide-react";
import { RatingModal } from "@/components/RatingModal";
import { StarRatingDisplay } from "@/components/StarRatingDisplay";

interface SessionCardProps {
  session: any;
  canRate: boolean;
  onRate: (sessionId: number) => void;
  onReschedule: (sessionId: number) => void;
  onCancel: (sessionId: number) => void;
  formatDate: (timestamp: number) => string;
  formatTime: (timestamp: number) => string;
  getStatusBadge: (status?: string | null) => ReactElement;
}

function SessionCard({
  session,
  canRate,
  onRate,
  onReschedule,
  onCancel,
  formatDate,
  formatTime,
  getStatusBadge,
}: SessionCardProps) {
  const { data: rating } = trpc.session.getSessionRating.useQuery(
    { sessionId: session.id },
    { enabled: canRate }
  );

  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        {/* Left side - Session info */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="font-medium">{formatDate(session.scheduledAt)}</span>
            {getStatusBadge(session.status)}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span>{formatTime(session.scheduledAt)}</span>
            <span>•</span>
            <span>{session.duration} min</span>
          </div>
        </div>

        {/* Right side - Actions or Rating */}
        <div className="flex flex-col sm:flex-row md:flex-row items-stretch sm:items-center gap-3">
          {session.status === "scheduled" && (
            <>
              <Button variant="ghost" size="sm" onClick={() => onReschedule(session.id)} className="justify-start sm:justify-center">
                <Edit className="w-4 h-4 mr-1" />
                Reschedule
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onCancel(session.id)} className="justify-start sm:justify-center">
                <Trash2 className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </>
          )}

          {canRate && (
            <div className="min-w-full sm:min-w-[280px]">
              {rating ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Your Rating</p>
                  <StarRatingDisplay rating={rating.rating} comment={rating.comment} size="sm" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRate(session.id)}
                  className="w-full"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Rate this Session
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ParentBookingsManager() {
  const [selectedSeries, setSelectedSeries] = useState<number | null>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleSeriesDialogOpen, setRescheduleSeriesDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelSeriesDialogOpen, setCancelSeriesDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [selectedSessionDuration, setSelectedSessionDuration] = useState<number>(60);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newTime, setNewTime] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingSessionId, setRatingSessionId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: bookings, isLoading, refetch } = trpc.session.myBookings.useQuery();
  const { data: availabilityData } = trpc.subscription.getAvailability.useQuery(
    { subscriptionId: selectedSubscriptionId ?? 0 },
    { enabled: !!selectedSubscriptionId }
  );

  const rescheduleMutation = trpc.session.reschedule.useMutation({
    onSuccess: () => {
      toast.success("Session rescheduled successfully!");
      setRescheduleDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to reschedule: ${error.message}`);
    },
  });

  const rescheduleSeriesMutation = trpc.session.rescheduleSeries.useMutation({
    onSuccess: (data) => {
      toast.success(`Successfully rescheduled ${data.rescheduledCount} sessions!`);
      setRescheduleSeriesDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to reschedule series: ${error.message}`);
    },
  });

  const cancelMutation = trpc.session.cancel.useMutation({
    onSuccess: () => {
      toast.success("Session canceled successfully!");
      setCancelDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  const cancelSeriesMutation = trpc.session.cancelSeries.useMutation({
    onSuccess: (data) => {
      toast.success(`Successfully canceled ${data.canceledCount} sessions!`);
      setCancelSeriesDialogOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to cancel series: ${error.message}`);
    },
  });

  const rateSessionMutation = trpc.session.rateSession.useMutation({
    onSuccess: async () => {
      toast.success("Thank you for your feedback!");
      setRatingModalOpen(false);

      // Invalidate the rating query for the specific session
      if (ratingSessionId) {
        await utils.session.getSessionRating.invalidate({ sessionId: ratingSessionId });
      }

      // Refetch bookings to update the UI
      await refetch();

      setRatingSessionId(null);
    },
    onError: (error) => {
      toast.error(`Failed to submit rating: ${error.message}`);
    },
  });

  const handleRescheduleSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    // Find the session and its subscription to scope availability and duration
    if (bookings) {
      for (const [subId, sessionList] of Object.entries(bookings as Record<string, any[]>)) {
        const found = sessionList.find((s) => s.id === sessionId);
        if (found) {
          setSelectedSubscriptionId(Number(subId));
          setSelectedSessionDuration(found.duration || 60);
          break;
        }
      }
    }
    setNewDate(undefined);
    setNewTime("");
    setRescheduleDialogOpen(true);
  };

  const handleRescheduleSeries = (subscriptionId: number) => {
    setSelectedSeries(subscriptionId);
    setSelectedSubscriptionId(subscriptionId);
    // Use first session duration in the series if available
    const sessionList = bookings ? (bookings as Record<string, any[]>)[subscriptionId] : undefined;
    if (sessionList && sessionList.length > 0) {
      setSelectedSessionDuration(sessionList[0].duration || 60);
    }
    setNewDate(undefined);
    setFrequency("weekly");
    setRescheduleSeriesDialogOpen(true);
  };

  const handleCancelSession = (sessionId: number) => {
    setSelectedSessionId(sessionId);
    setCancelReason("");
    setCancelDialogOpen(true);
  };

  const handleCancelSeries = (subscriptionId: number) => {
    setSelectedSeries(subscriptionId);
    setCancelReason("");
    setCancelSeriesDialogOpen(true);
  };

  const confirmReschedule = () => {
    if (!selectedSessionId || !newDate || !newTime) {
      toast.error("Please select both date and time");
      return;
    }

    const [hours, minutes] = newTime.split(":").map(Number);
    const scheduledDate = new Date(newDate);
    scheduledDate.setHours(hours, minutes, 0, 0);

    rescheduleMutation.mutate({
      sessionId: selectedSessionId,
      newScheduledAt: scheduledDate.getTime(),
    });
  };

  const confirmRescheduleSeries = () => {
    if (!selectedSeries || !newDate) {
      toast.error("Please select a start date");
      return;
    }

    rescheduleSeriesMutation.mutate({
      subscriptionId: selectedSeries,
      newStartDate: newDate.getTime(),
      frequency,
    });
  };

  const confirmCancel = () => {
    if (!selectedSessionId) return;

    cancelMutation.mutate({
      sessionId: selectedSessionId,
      reason: cancelReason || undefined,
    });
  };

  const confirmCancelSeries = () => {
    if (!selectedSeries) return;

    cancelSeriesMutation.mutate({
      subscriptionId: selectedSeries,
      reason: cancelReason || undefined,
    });
  };

  const handleRateSession = (sessionId: number) => {
    setRatingSessionId(sessionId);
    setRatingModalOpen(true);
  };

  const handleSubmitRating = (rating: number, comment: string) => {
    if (!ratingSessionId) return;

    rateSessionMutation.mutate({
      sessionId: ratingSessionId,
      rating,
      comment: comment || undefined,
    });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getStatusBadge = (status?: string | null) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      scheduled: "default",
      completed: "secondary",
      cancelled: "destructive",
      no_show: "outline",
    };
    const safeStatus = status || "pending";

    // Custom label for no_show
    const label = safeStatus === "no_show"
      ? "Completed (No Show)"
      : safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1);

    // Custom styling for no_show badge
    const customClassName = safeStatus === "no_show"
      ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
      : "";

    return (
      <Badge variant={variants[safeStatus] || "outline"} className={customClassName}>
        {label}
      </Badge>
    );
  };

  // Extract unique student names for the filter dropdown
  const studentOptions = useMemo(() => {
    if (!bookings) return [];
    const students = new Set<string>();

    Object.values(bookings as Record<string, any[]>).forEach((sessions) => {
      sessions.forEach((session: any) => {
        const studentName = [session.studentFirstName, session.studentLastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (studentName) {
          students.add(studentName);
        }
      });
    });

    return Array.from(students).sort();
  }, [bookings]);

  // Filter bookings by selected student
  const filteredBookings = useMemo(() => {
    if (!bookings || selectedStudent === "all") return bookings;

    const filtered: Record<string, any[]> = {};

    Object.entries(bookings as Record<string, any[]>).forEach(([subscriptionId, sessions]) => {
      const filteredSessions = sessions.filter((session: any) => {
        const studentName = [session.studentFirstName, session.studentLastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        return studentName === selectedStudent;
      });

      if (filteredSessions.length > 0) {
        filtered[subscriptionId] = filteredSessions;
      }
    });

    return filtered;
  }, [bookings, selectedStudent]);

  const availableTimeSlots = useMemo(() => {
    if (!newDate || !availabilityData) return [];

    const day = newDate.getDay(); // 0 Sunday
    const windows = (availabilityData.availability || []).filter((w: any) => w.dayOfWeek === day);
    if (!windows.length) return [];

    const duration = selectedSessionDuration || 60;
    const booked = (availabilityData.booked || []).filter((b: any) => b.id !== selectedSessionId);

    const slots: string[] = [];
    const minutesFromMidnight = (d: Date) => d.getHours() * 60 + d.getMinutes();
    const formatSlot = (d: Date) =>
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

    const now = Date.now();

    windows.forEach((w: any) => {
      const [sh, sm] = w.startTime.split(":").map(Number);
      const [eh, em] = w.endTime.split(":").map(Number);
      let cursor = sh * 60 + sm;
      const end = eh * 60 + em;

      while (cursor + duration <= end) {
        const start = new Date(newDate);
        start.setHours(Math.floor(cursor / 60), cursor % 60, 0, 0);
        const startMs = start.getTime();
        const endMs = startMs + duration * 60000;

        // Skip slots in the past (today or earlier)
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
          slots.push(formatSlot(start));
        }

        cursor += 30; // 30-minute step
      }
    });

    return Array.from(new Set(slots));
  }, [availabilityData, newDate, selectedSessionDuration, selectedSessionId]);

  if (isLoading) {
    return <div className="text-center py-8">Loading your bookings...</div>;
  }

  if (!bookings || Object.keys(bookings).length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Bookings</CardTitle>
          <CardDescription>You don't have any bookings yet</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">My Bookings</h2>
        <Button variant="outline" onClick={() => refetch()} className="w-full sm:w-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Student Filter Dropdown */}
      {studentOptions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Label htmlFor="student-filter" className="whitespace-nowrap text-sm">Filter by Student:</Label>
          <Select value={selectedStudent} onValueChange={setSelectedStudent}>
            <SelectTrigger id="student-filter" className="w-full sm:w-[250px]">
              <SelectValue placeholder="All Students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {studentOptions.map((student) => (
                <SelectItem key={student} value={student}>
                  {student}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {Object.keys(filteredBookings).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Bookings Found</CardTitle>
            <CardDescription>
              {selectedStudent === "all"
                ? "You don't have any bookings yet"
                : `No bookings found for ${selectedStudent}`}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        Object.entries(filteredBookings as Record<string, any[]>).map(([subscriptionId, sessions]) => {
        const scheduledSessions = sessions.filter(s => s.status === "scheduled");
        const firstSession = sessions[0];
        
        return (
          <Card key={subscriptionId}>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {firstSession?.course?.title || "Course"}
                    {scheduledSessions.length > 1 && (
                      <Badge variant="secondary">{scheduledSessions.length} sessions</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Tutor: {firstSession?.tutor?.name || "Unknown"}
                    {(firstSession?.studentFirstName || firstSession?.studentLastName) && (
                      <> • Student: {[firstSession.studentFirstName, firstSession.studentLastName].filter(Boolean).join(" ")}</>
                    )}
                  </CardDescription>
                </div>
                {scheduledSessions.length > 0 && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRescheduleSeries(parseInt(subscriptionId))}
                      className="w-full sm:w-auto justify-start sm:justify-center"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Reschedule Series
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleCancelSeries(parseInt(subscriptionId))}
                      className="w-full sm:w-auto justify-start sm:justify-center"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Cancel Series
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sessions.map((session: any) => {
                  const isCompleted = session.status === "completed" || session.status === "no_show";
                  const sessionHasPassed = session.scheduledAt < Date.now();
                  const canRate = isCompleted && sessionHasPassed;

                  return (
                    <SessionCard
                      key={session.id}
                      session={session}
                      canRate={canRate}
                      onRate={handleRateSession}
                      onReschedule={handleRescheduleSession}
                      onCancel={handleCancelSession}
                      formatDate={formatDate}
                      formatTime={formatTime}
                      getStatusBadge={getStatusBadge}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      }))}

      {/* Reschedule Single Session Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Session</DialogTitle>
            <DialogDescription>
              Choose a new date and time for this session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Date</Label>
              <Calendar
                mode="single"
                selected={newDate}
                onSelect={setNewDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
            <div>
              <Label>New Time</Label>
              <Select value={newTime} onValueChange={setNewTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {availableTimeSlots.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {newDate ? "No available times for this day" : "Select a date first"}
                    </SelectItem>
                  ) : (
                    availableTimeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmReschedule} disabled={!newDate || !newTime || availableTimeSlots.length === 0}>
              Confirm Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Series Dialog */}
      <Dialog open={rescheduleSeriesDialogOpen} onOpenChange={setRescheduleSeriesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Entire Series</DialogTitle>
            <DialogDescription>
              All scheduled sessions will be rescheduled based on the new start date
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Start Date</Label>
              <Calendar
                mode="single"
                selected={newDate}
                onSelect={setNewDate}
                disabled={(date) => date < new Date()}
                className="rounded-md border"
              />
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v: any) => setFrequency(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleSeriesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmRescheduleSeries} disabled={!newDate}>
              Reschedule All Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Single Session Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Let us know why you're canceling..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Session
            </Button>
            <Button variant="destructive" onClick={confirmCancel}>
              Cancel Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Series Dialog */}
      <Dialog open={cancelSeriesDialogOpen} onOpenChange={setCancelSeriesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Entire Series</DialogTitle>
            <DialogDescription>
              This will cancel all scheduled sessions in this series. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="Let us know why you're canceling..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelSeriesDialogOpen(false)}>
              Keep Series
            </Button>
            <Button variant="destructive" onClick={confirmCancelSeries}>
              Cancel All Sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rating Modal */}
      <RatingModal
        open={ratingModalOpen}
        onClose={() => {
          setRatingModalOpen(false);
          setRatingSessionId(null);
        }}
        onSubmit={handleSubmitRating}
        isSubmitting={rateSessionMutation.isPending}
      />
    </div>
  );
}
