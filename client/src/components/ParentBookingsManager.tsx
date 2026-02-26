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
import { Calendar as CalendarIcon, Clock, Edit, Trash2, RefreshCw, Star, Info, X, List, CalendarDays, ChevronDown, ChevronUp, User, ChevronLeft, ChevronRight } from "lucide-react";
import { RatingModal } from "@/components/RatingModal";
import { StarRatingDisplay } from "@/components/StarRatingDisplay";

// Helper to get initials from name
const getInitials = (name: string) => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Avatar color based on student name (consistent hashing)
const getAvatarColor = (name: string) => {
  const colors = [
    "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
    "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200",
    "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200",
    "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
    "bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-200",
  ];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
};

interface CalendarViewProps {
  groupedBookings: Record<string, Record<string, any[]>>;
  onRateSession: (sessionId: number) => void;
  onRescheduleSession: (sessionId: number) => void;
  onCancelSession: (sessionId: number) => void;
  formatDate: (timestamp: number) => string;
  formatTime: (timestamp: number) => string;
  getStatusBadge: (status?: string | null) => ReactElement;
}

function CalendarView({
  groupedBookings,
  onRateSession,
  onRescheduleSession,
  onCancelSession,
  formatDate,
  formatTime,
  getStatusBadge,
}: CalendarViewProps) {
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewAllDate, setViewAllDate] = useState<string | null>(null);

  // Memoize flattened sessions to avoid recreating on every render
  const allSessions = useMemo(() => {
    const sessions: Array<{ session: any; student: string; subject: string }> = [];

    Object.entries(groupedBookings).forEach(([studentName, subjects]) => {
      Object.entries(subjects).forEach(([subject, sessionList]) => {
        sessionList.forEach((session) => {
          sessions.push({ session, student: studentName, subject });
        });
      });
    });

    // Sort by date once
    sessions.sort((a, b) => a.session.scheduledAt - b.session.scheduledAt);
    return sessions;
  }, [groupedBookings]);

  // Get unique students for legend (memoized)
  const uniqueStudents = useMemo(() =>
    Array.from(new Set(allSessions.map(s => s.student))),
    [allSessions]
  );

  // Memoize calendar grid calculation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0);

    // Start from Sunday before the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    // End on Saturday after the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - lastDay.getDay()));

    const calendar: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      calendar.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return calendar;
  }, [currentDate]);

  // Group sessions by date
  const sessionsByDate = useMemo(() => {
    const grouped: Record<string, typeof allSessions> = {};

    allSessions.forEach((item) => {
      const date = new Date(item.session.scheduledAt);
      const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(item);
    });

    return grouped;
  }, [allSessions]);

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Calculate session density for the current month
  const currentMonthSessionCount = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return allSessions.filter(({ session }) => {
      const sessionDate = new Date(session.scheduledAt);
      return sessionDate.getFullYear() === year && sessionDate.getMonth() === month;
    }).length;
  }, [allSessions, currentDate]);

  // Memoize color function to avoid recreating on every render
  const getSessionColor = useMemo(() => {
    return (status: string) => {
      switch (status) {
        case 'completed':
          return 'bg-green-600 hover:bg-green-700 text-white';
        case 'no_show':
          return 'bg-amber-600 hover:bg-amber-700 text-white';
        case 'cancelled':
          return 'bg-red-600 hover:bg-red-700 text-white';
        case 'scheduled':
        default:
          return 'bg-blue-600 hover:bg-blue-700 text-white';
      }
    };
  }, []);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
            </div>
            <CardTitle className="text-2xl font-bold">{monthName}</CardTitle>
            <div className="w-32"></div> {/* Spacer for balance */}
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-0">
          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-3 text-center text-sm font-semibold text-muted-foreground border-r last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const dateKey = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
              const daySessions = sessionsByDate[dateKey] || [];
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = new Date().toDateString() === day.toDateString();

              return (
                <div
                  key={index}
                  className={`min-h-[120px] border-r border-b last:border-r-0 p-2 ${
                    !isCurrentMonth ? 'bg-muted/30' : ''
                  } ${isToday ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                >
                  {/* Date Number */}
                  <div className={`text-sm font-medium mb-2 ${
                    !isCurrentMonth ? 'text-muted-foreground' : ''
                  } ${isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}`}>
                    {day.getDate()}
                  </div>

                  {/* Sessions for this day */}
                  <div className="space-y-1">
                    {daySessions.slice(0, 3).map(({ session, student, subject }) => {
                      const time = new Date(session.scheduledAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      });

                      return (
                        <button
                          key={session.id}
                          onClick={() => setExpandedSession(session.id)}
                          className={`w-full text-left p-1.5 rounded text-xs transition-colors truncate ${getSessionColor(session.status)}`}
                        >
                          <div className="font-medium truncate">
                            {time} {student} - {subject.substring(0, 15)}{subject.length > 15 ? '...' : ''}
                          </div>
                        </button>
                      );
                    })}
                    {daySessions.length > 3 && (
                      <button
                        onClick={() => setViewAllDate(dateKey)}
                        className="w-full text-xs text-blue-600 dark:text-blue-400 hover:underline text-center py-1 font-medium"
                      >
                        +{daySessions.length - 3} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* View All Sessions for a Day Dialog */}
      {viewAllDate && (
        <Dialog open={!!viewAllDate} onOpenChange={(open) => !open && setViewAllDate(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                All Sessions - {new Date(viewAllDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {(sessionsByDate[viewAllDate] || []).map(({ session, student, subject }) => {
                const time = new Date(session.scheduledAt).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                });

                return (
                  <button
                    key={session.id}
                    onClick={() => {
                      setViewAllDate(null);
                      setExpandedSession(session.id);
                    }}
                    className={`w-full text-left p-3 rounded transition-colors ${getSessionColor(session.status)}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0 ${getAvatarColor(student)}`}>
                          {getInitials(student)}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold">{subject}</div>
                          <div className="text-sm opacity-90">{student}</div>
                          <div className="text-xs opacity-75 mt-1">
                            {time} • {session.duration} min
                          </div>
                        </div>
                      </div>
                      {getStatusBadge(session.status)}
                    </div>
                  </button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Session Detail Dialog */}
      {expandedSession && (
        <Dialog open={!!expandedSession} onOpenChange={(open) => !open && setExpandedSession(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Session Details</DialogTitle>
            </DialogHeader>
            {(() => {
              const sessionData = allSessions.find(s => s.session.id === expandedSession);
              if (!sessionData) return null;

              const { session, student, subject } = sessionData;
              const isCompleted = session.status === "completed" || session.status === "no_show";
              const sessionHasPassed = session.scheduledAt < Date.now();
              const canRate = isCompleted && sessionHasPassed;

              const now = Date.now();
              const hoursUntilSession = (session.scheduledAt - now) / (1000 * 60 * 60);
              const canModifySession = hoursUntilSession >= 12;

              return (
                <>
                  <div className="space-y-4">
                    {/* Student Avatar */}
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium ${getAvatarColor(student)}`}>
                        {getInitials(student)}
                      </div>
                      <div>
                        <div className="font-semibold text-lg">{subject}</div>
                        <div className="text-sm text-muted-foreground">{student}</div>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        <span>{formatDate(session.scheduledAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{formatTime(session.scheduledAt)} ({session.duration} min)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span>Tutor: {session.tutor?.name || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        Status: {getStatusBadge(session.status)}
                      </div>
                    </div>
                  </div>

                  <DialogFooter>
                    <div className="flex flex-wrap gap-2 w-full">
                      {session.status === "scheduled" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (session.joinUrl) {
                                window.open(session.joinUrl, "_blank");
                              } else {
                                console.log("Join meeting clicked");
                              }
                            }}
                            className="w-full sm:w-auto"
                          >
                            Join meeting
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExpandedSession(null);
                              onRescheduleSession(session.id);
                            }}
                            disabled={!canModifySession}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Reschedule
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExpandedSession(null);
                              onCancelSession(session.id);
                            }}
                            disabled={!canModifySession}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                          {!canModifySession && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 w-full">
                              Changes not allowed within 12 hours of session
                            </p>
                          )}
                        </>
                      )}

                      {canRate && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setExpandedSession(null);
                            onRateSession(session.id);
                          }}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Rate this Session
                        </Button>
                      )}
                    </div>
                  </DialogFooter>
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

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

  // Check if session is within 12 hours - disable cancel/reschedule
  const now = Date.now();
  const sessionTime = session.scheduledAt;
  const hoursUntilSession = (sessionTime - now) / (1000 * 60 * 60);
  const canModifySession = hoursUntilSession >= 12;

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
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onReschedule(session.id)}
                  className="justify-start sm:justify-center flex-1 sm:flex-none"
                  disabled={!canModifySession}
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Reschedule
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCancel(session.id)}
                  className="justify-start sm:justify-center flex-1 sm:flex-none"
                  disabled={!canModifySession}
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Cancel
                </Button>
              </div>
              {!canModifySession && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center sm:text-left">
                  Changes not allowed within 12 hours of session
                </p>
              )}
            </div>
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
  const [showPolicyBanner, setShowPolicyBanner] = useState(() => {
    // Check localStorage - show banner if user hasn't dismissed it
    const dismissed = localStorage.getItem('cancellationPolicyDismissed');
    return dismissed !== 'true';
  });
  const [cancelSeriesDialogOpen, setCancelSeriesDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [selectedSessionDuration, setSelectedSessionDuration] = useState<number>(60);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newTime, setNewTime] = useState<string>("");
  const [cancelReason, setCancelReason] = useState<string>("");
  const [frequency, setFrequency] = useState<"weekly" | "biweekly">("weekly");
  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"upcoming" | "completed" | "cancelled" | "all">("upcoming");
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [ratingSessionId, setRatingSessionId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "calendar">("calendar");
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({});

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

  // Group bookings by Student → Subject → Sessions (sorted with upcoming first)
  const groupedBookings = useMemo(() => {
    if (!bookings) return null;

    const allSessions: any[] = [];

    // Flatten all sessions with their subscription metadata
    Object.entries(bookings as Record<string, any[]>).forEach(([subscriptionId, sessions]) => {
      sessions.forEach((session: any) => {
        allSessions.push({
          ...session,
          subscriptionId: Number(subscriptionId),
        });
      });
    });

    // Filter by status and student
    const filteredSessions = allSessions.filter((session: any) => {
      // Filter by status
      let statusMatch = true;
      if (statusFilter === "upcoming") {
        statusMatch = session.status === "scheduled";
      } else if (statusFilter === "completed") {
        statusMatch = session.status === "completed" || session.status === "no_show";
      } else if (statusFilter === "cancelled") {
        statusMatch = session.status === "cancelled";
      }

      if (!statusMatch) return false;

      // Filter by student
      if (selectedStudent !== "all") {
        const studentName = [session.studentFirstName, session.studentLastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        return studentName === selectedStudent;
      }

      return true;
    });

    // Group by student → subject
    const grouped: Record<string, Record<string, any[]>> = {};

    filteredSessions.forEach((session: any) => {
      const studentName = [session.studentFirstName, session.studentLastName]
        .filter(Boolean)
        .join(" ")
        .trim() || "Unknown Student";
      const subject = session.course?.title || "Unknown Subject";

      if (!grouped[studentName]) {
        grouped[studentName] = {};
      }

      if (!grouped[studentName][subject]) {
        grouped[studentName][subject] = [];
      }

      grouped[studentName][subject].push(session);
    });

    // Sort sessions within each subject: upcoming first (chronological), then past (reverse chronological)
    Object.values(grouped).forEach((subjects) => {
      Object.values(subjects).forEach((sessions) => {
        sessions.sort((a, b) => {
          const now = Date.now();
          const aIsUpcoming = a.scheduledAt >= now;
          const bIsUpcoming = b.scheduledAt >= now;

          if (aIsUpcoming && !bIsUpcoming) return -1;
          if (!aIsUpcoming && bIsUpcoming) return 1;

          // Both upcoming or both past - sort chronologically (upcoming) or reverse chronologically (past)
          if (aIsUpcoming) {
            return a.scheduledAt - b.scheduledAt;
          } else {
            return b.scheduledAt - a.scheduledAt;
          }
        });
      });
    });

    return grouped;
  }, [bookings, selectedStudent, statusFilter]);

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
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">My Bookings</h2>
          {!showPolicyBanner && (
            <button
              onClick={() => {
                setShowPolicyBanner(true);
                localStorage.removeItem('cancellationPolicyDismissed');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              title="View cancellation policy"
            >
              <Info className="w-3 h-3" />
              Policy
            </button>
          )}
        </div>
        <Button variant="outline" onClick={() => refetch()} className="w-full sm:w-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Cancellation Policy Info - Dismissible */}
      {showPolicyBanner && (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 relative animate-in fade-in slide-in-from-top-2 duration-300">
          <button
            onClick={() => {
              setShowPolicyBanner(false);
              localStorage.setItem('cancellationPolicyDismissed', 'true');
            }}
            className="absolute top-3 right-3 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded p-1 transition-all"
            aria-label="Dismiss policy banner"
            title="Dismiss this notice"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex gap-3 pr-8">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-medium mb-1">Cancellation & Rescheduling Policy</p>
              <p className="text-blue-800 dark:text-blue-300">
                Sessions can be canceled or rescheduled up to <strong>12 hours</strong> before the scheduled start time.
                Changes are not allowed within 12 hours of the session.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4">
        {/* Status Filter Pills and View Toggle */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === "upcoming" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("upcoming")}
              className="rounded-full"
            >
              Upcoming
            </Button>
            <Button
              variant={statusFilter === "completed" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("completed")}
              className="rounded-full"
            >
              Completed
            </Button>
            <Button
              variant={statusFilter === "cancelled" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("cancelled")}
              className="rounded-full"
            >
              Cancelled
            </Button>
            <Button
              variant={statusFilter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter("all")}
              className="rounded-full"
            >
              All
            </Button>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="gap-2"
            >
              <List className="w-4 h-4" />
              List
            </Button>
            <Button
              variant={viewMode === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("calendar")}
              className="gap-2"
            >
              <CalendarDays className="w-4 h-4" />
              Calendar
            </Button>
          </div>
        </div>

        {/* Student Filter Dropdown */}
        {studentOptions.length > 0 && (
          <div className="flex items-center gap-2">
            <Label htmlFor="student-filter" className="whitespace-nowrap text-sm">Student:</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger id="student-filter" className="w-[200px]">
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
      </div>

      {!groupedBookings || Object.keys(groupedBookings).length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Bookings Found</CardTitle>
            <CardDescription>
              {(() => {
                const studentText = selectedStudent === "all" ? "" : ` for ${selectedStudent}`;
                if (statusFilter === "upcoming") return `No upcoming sessions${studentText}`;
                if (statusFilter === "completed") return `No completed sessions${studentText}`;
                if (statusFilter === "cancelled") return `No cancelled sessions${studentText}`;
                return selectedStudent === "all"
                  ? "You don't have any bookings yet"
                  : `No bookings found${studentText}`;
              })()}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : viewMode === "list" ? (
        <div className="space-y-6">
          {Object.entries(groupedBookings).map(([studentName, subjects]) => {
            const isStudentExpanded = expandedStudents[studentName] ?? true;
            const totalSessions = Object.values(subjects).reduce((acc, sessions) => acc + sessions.length, 0);

            return (
              <Card key={studentName} className="overflow-hidden">
                <CardHeader className="bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {studentName}
                        <Badge variant="secondary">{totalSessions} session{totalSessions !== 1 ? 's' : ''}</Badge>
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedStudents(prev => ({ ...prev, [studentName]: !isStudentExpanded }))}
                    >
                      {isStudentExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </Button>
                  </div>
                </CardHeader>
                {isStudentExpanded && (
                  <CardContent className="pt-6 space-y-6">
                    {Object.entries(subjects).map(([subject, sessions]) => {
                      const subjectKey = `${studentName}-${subject}`;
                      const isSubjectExpanded = expandedSubjects[subjectKey] ?? true;
                      const scheduledSessions = sessions.filter(s => s.status === "scheduled");
                      const firstSession = sessions[0];
                      const subscriptionId = firstSession?.subscriptionId;

                      // Check if any scheduled session is within 12 hours
                      const now = Date.now();
                      const hasSessionWithin12Hours = scheduledSessions.some((s) => {
                        const hoursUntilSession = (s.scheduledAt - now) / (1000 * 60 * 60);
                        return hoursUntilSession < 12;
                      });
                      const canModifySeries = !hasSessionWithin12Hours;

                      return (
                        <div key={subjectKey} className="border rounded-lg overflow-hidden">
                          <div className="bg-muted/20 p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                  {subject}
                                  <Badge variant="outline">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Badge>
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Tutor: {firstSession?.tutor?.name || "Unknown"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {scheduledSessions.length > 1 && (
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRescheduleSeries(subscriptionId)}
                                      disabled={!canModifySeries}
                                      title={!canModifySeries ? "Changes not allowed within 12 hours" : ""}
                                    >
                                      <Edit className="w-4 h-4 mr-1" />
                                      Reschedule Series
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleCancelSeries(subscriptionId)}
                                      disabled={!canModifySeries}
                                      title={!canModifySeries ? "Changes not allowed within 12 hours" : ""}
                                    >
                                      <Trash2 className="w-4 h-4 mr-1" />
                                      Cancel Series
                                    </Button>
                                  </div>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedSubjects(prev => ({ ...prev, [subjectKey]: !isSubjectExpanded }))}
                                >
                                  {isSubjectExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                          {isSubjectExpanded && (
                            <div className="p-4 space-y-3">
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
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <CalendarView
          groupedBookings={groupedBookings}
          onRateSession={handleRateSession}
          onRescheduleSession={handleRescheduleSession}
          onCancelSession={handleCancelSession}
          formatDate={formatDate}
          formatTime={formatTime}
          getStatusBadge={getStatusBadge}
        />
      )}

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
