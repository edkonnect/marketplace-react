import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link, useLocation } from "wouter";
import { BookOpen, Calendar, MessageSquare, CreditCard, Clock, Users, Video, FileText, HelpCircle, CheckCircle, TrendingUp, BarChart2, LogIn, Sparkles, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_PATH } from "@/const";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ParentBookingsManager } from "@/components/ParentBookingsManager";
import { ParentSessionsManager } from "@/components/ParentSessionsManager";
import { AppointmentScheduler } from "@/components/AppointmentScheduler";
import { ReferralCouponPopup } from "@/components/ReferralCouponPopup";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Footer from "@/components/Footer";

export default function ParentDashboard() {
  const { user, isAuthenticated, loading, previousLastSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const formatPrice = useFormatPrice();
  const tabContentClass =
    "space-y-6 w-full transition-all duration-300 data-[state=inactive]:hidden";

  const { data: subscriptions, isLoading: subsLoading, refetch: refetchSubscriptions } = trpc.subscription.mySubscriptions.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: upcomingSessions, isLoading: sessionsLoading, refetch: refetchSessions } = trpc.session.myUpcoming.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: sessionHistory, isLoading: historyLoading, refetch: refetchHistory } = trpc.session.myHistory.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: sessionNotes } = trpc.parentProfile.getSessionNotes.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: parentQuizzes, refetch: refetchQuizzes } = trpc.quiz.getByParent.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: parentGrades } = trpc.grades.getByParent.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );




  type QuizModalState = {
    quiz: NonNullable<typeof parentQuizzes>[number];
    answers: Record<number, number>;
    submitted: boolean;
    score?: number;
    correct?: number;
    total?: number;
  };
  const [quizModal, setQuizModal] = useState<QuizModalState | null>(null);

  const setupBillingMutation = trpc.course.getSetupUrl.useMutation();
  const retryCheckoutMutation = trpc.course.retryCheckout.useMutation();
  const [setupLoadingId, setSetupLoadingId] = useState<number | null>(null);
  const [retryLoadingId, setRetryLoadingId] = useState<number | null>(null);

  const completeQuizMutation = trpc.quiz.complete.useMutation({
    onSuccess: (data) => {
      setQuizModal((prev) =>
        prev ? { ...prev, submitted: true, score: data.score, correct: data.correct, total: data.total } : prev
      );
      refetchQuizzes();
    },
    onError: (error) => {
      toast.error("Failed to submit quiz: " + error.message);
    },
  });

  // Track note updates per session to show a small indicator (one-time until next update)
  const lastFeedbackRef = useRef<Map<number, string | null>>(new Map());
  const seenFeedbackRef = useRef<Map<number, string | null>>(new Map());
  const [noteAlerts, setNoteAlerts] = useState<Record<number, string>>({});
  const [historyPulse, setHistoryPulse] = useState(false);
  const [activeTab, setActiveTab] = useState("subscriptions");
  const notesInitialized = useRef(false);
  const seenStorageKey = user ? `parent_seen_notes_${user.id}` : "parent_seen_notes";

  // Load seen map once
  useEffect(() => {
    if (!seenStorageKey) return;
    try {
      const raw = localStorage.getItem(seenStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<number, string | null>;
        const map = new Map<number, string | null>();
        Object.entries(parsed).forEach(([k, v]) => map.set(Number(k), v));
        seenFeedbackRef.current = map;
      }
    } catch (e) {
      console.warn("Failed to load seen notes", e);
    }
  }, [seenStorageKey]);

  const persistSeen = () => {
    try {
      const obj: Record<number, string | null> = {};
      seenFeedbackRef.current.forEach((v, k) => {
        obj[k] = v;
      });
      localStorage.setItem(seenStorageKey, JSON.stringify(obj));
    } catch (e) {
      console.warn("Failed to persist seen notes", e);
    }
  };

  useEffect(() => {
    if (!sessionHistory) return;
    const nextAlerts: Record<number, string> = {};
    sessionHistory.forEach((s) => {
      if (!s.feedbackFromTutor) return;
      const prev = lastFeedbackRef.current.get(s.id);
      const seen = seenFeedbackRef.current.get(s.id);
      if (prev !== s.feedbackFromTutor && seen !== s.feedbackFromTutor) {
        nextAlerts[s.id] = s.feedbackFromTutor;
      }
      lastFeedbackRef.current.set(s.id, s.feedbackFromTutor);
    });
    setNoteAlerts(nextAlerts);
    if (!notesInitialized.current) {
      notesInitialized.current = true; // avoid initial noisy popup
    }
  }, [sessionHistory]);

  useEffect(() => {
    if (!notesInitialized.current) return;
    if (Object.keys(noteAlerts).length === 0) return;

    setHistoryPulse(true);
    toast.info("New tutor notes available in History");
    const timer = setTimeout(() => setHistoryPulse(false), 2000);

    // Mark current alerts as seen so they won't reappear until updated again
    Object.entries(noteAlerts).forEach(([id, feedback]) => {
      seenFeedbackRef.current.set(Number(id), feedback);
    });
    persistSeen();
    // Clear the alerts after a tick so the indicator shows once
    const clearTimer = setTimeout(() => setNoteAlerts({}), 50);

    return () => {
      clearTimeout(timer);
      clearTimeout(clearTimer);
    };
  }, [noteAlerts]);
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = LOGIN_PATH;
    }
    if (!loading && user?.role !== "parent" && user?.role !== "admin") {
      setLocation("/role-selection");
    }
  }, [loading, isAuthenticated, user, setLocation]);

  // After Stripe Setup Checkout redirect, poll until all pending monthly subs become paid
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") !== "success") return;
    window.history.replaceState({}, "", window.location.pathname);

    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(async () => {
      attempts++;
      const result = await refetchSubscriptions();
      const allResolved = result.data?.every(
        s => s.subscription.paymentPlan !== "monthly" || s.subscription.paymentStatus !== "pending"
      );
      if (allResolved || attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 2000); // poll every 2s, up to 20s total

    return () => clearInterval(interval);
  }, []);

  const activeSubscriptions = subscriptions?.filter(s => s.subscription.status === "active") || [];
  const completedSessions = sessionHistory?.filter(s => s.status === "completed") || [];

  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<string>("all");
  const [selectedHistoryTime, setSelectedHistoryTime] = useState<string>("all");
  const [selectedHistoryCourse, setSelectedHistoryCourse] = useState<string>("all");
  const [subscriptionSearchQuery, setSubscriptionSearchQuery] = useState("");

  const subscriptionStudentMap = useMemo(() => {
    const map = new Map<number, string>();
    activeSubscriptions.forEach(({ subscription }) => {
      const name = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim();
      if (subscription.id && name) {
        map.set(subscription.id, name);
      }
    });
    return map;
  }, [activeSubscriptions]);

  // Combine structured notes with feedbackFromTutor from session history
  const combinedNotes = useMemo(() => {
    const notesMap = new Map();

    // Add structured notes from sessionNotes query
    (sessionNotes || []).forEach((note) => {
      notesMap.set(note.id, note);
    });

    // Add feedback from completed/no_show sessions in history
    (sessionHistory || [])
      .filter((s) => (s.status === "completed" || s.status === "no_show") && s.feedbackFromTutor)
      .forEach((session) => {
        // Only add if not already present from sessionNotes (to avoid duplicates)
        if (!notesMap.has(session.id)) {
          notesMap.set(session.id, {
            id: session.id,
            sessionId: session.id,
            tutorName: session.tutorName,
            subscriptionId: session.subscriptionId,
            progressSummary: session.feedbackFromTutor,
            homework: null,
            challenges: null,
            nextSteps: null,
            createdAt: session.updatedAt || new Date(session.scheduledAt),
            scheduledAt: session.scheduledAt,
            studentFirstName: session.studentFirstName,
            studentLastName: session.studentLastName,
            courseSubject: session.courseSubject,
            courseTitle: session.courseTitle,
          });
        }
      });

    return Array.from(notesMap.values());
  }, [sessionNotes, sessionHistory]);

  const noteStudentOptions = useMemo(() => {
    const set = new Set<string>();
    // Include students that have notes
    combinedNotes.forEach((note) => {
      const name = [note.studentFirstName, note.studentLastName].filter(Boolean).join(" ").trim()
        || (note.subscriptionId ? subscriptionStudentMap.get(note.subscriptionId) ?? "" : "");
      if (name) set.add(name);
    });
    // Fallback to students from active subscriptions so dropdown isn't empty
    activeSubscriptions.forEach(({ subscription }) => {
      const name = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim();
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [combinedNotes, activeSubscriptions, subscriptionStudentMap]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    // Courses/titles from combined notes
    combinedNotes.forEach((note) => {
      if (note.courseTitle) set.add(note.courseTitle);
      else if (note.courseSubject) set.add(note.courseSubject);
    });
    // Fallback to courses from active subscriptions
    activeSubscriptions.forEach(({ course }) => {
      if (course?.title) set.add(course.title);
      else if (course?.subject) set.add(course.subject);
    });
    return Array.from(set);
  }, [combinedNotes, activeSubscriptions]);

  // Filtered history sessions
  const filteredHistorySessions = useMemo(() => {
    if (!sessionHistory) return [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return sessionHistory
      .filter((s) => s.status === "scheduled" || s.status === "completed" || s.status === "no_show")
      .filter((session) => {
        const studentName = [session.studentFirstName, session.studentLastName].filter(Boolean).join(" ").trim();
        const courseName = session.courseTitle || "";

        const matchesStudent = selectedHistoryStudent === "all" || studentName === selectedHistoryStudent;
        const matchesCourse = selectedHistoryCourse === "all" || courseName === selectedHistoryCourse;

        // Time filter logic
        let matchesTime = true;
        if (selectedHistoryTime !== "all") {
          const sessionDate = new Date(session.scheduledAt);
          const sessionMonth = sessionDate.getMonth();
          const sessionYear = sessionDate.getFullYear();

          if (selectedHistoryTime === "this_month") {
            matchesTime = sessionMonth === currentMonth && sessionYear === currentYear;
          } else if (selectedHistoryTime === "last_month") {
            const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            matchesTime = sessionMonth === lastMonth && sessionYear === lastMonthYear;
          }
        }

        return matchesStudent && matchesCourse && matchesTime;
      });
  }, [sessionHistory, selectedHistoryStudent, selectedHistoryTime, selectedHistoryCourse]);

  const getStudentName = (subscription: any) =>
    [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";

  const getStatusPriority = (subscription: any) => {
    if (subscription.status === "active" && subscription.paymentStatus === "paid") return 0;
    if (subscription.status === "active") return 1;
    if (subscription.paymentStatus === "pending") return 2;
    return 3;
  };

  const formatStatusLabel = (value: string | null | undefined) => {
    if (!value) return "Status";
    return value
      .split("_")
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  };

  const getPrimaryStatusBadge = (subscription: any) => {
    if (subscription.status === "active") {
      return {
        label: "Active",
        className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
      };
    }

    return {
      label: formatStatusLabel(subscription.status),
      className: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
    };
  };

  const getPaymentStatusBadge = (subscription: any) => {
    if (subscription.paymentStatus === "pending" && subscription.paymentPlan === "full") {
      return {
        label: "Billing Pending",
        className: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
      };
    }

    if (subscription.paymentPlan === "monthly" && subscription.paymentStatus === "pending") {
      return {
        label: "Monthly Setup Needed",
        className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
      };
    }

    if (subscription.paymentPlan === "monthly" && (subscription.paymentStatus === "paid" || subscription.paymentStatus === "completed")) {
      return {
        label: "Monthly Billing Active",
        className: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
      };
    }

    if (subscription.paymentPlan === "installment" && subscription.paymentStatus === "paid") {
      return {
        label: `Installment ${(subscription as any).installmentsPaidCount ?? 0} of ${subscription.numberOfInstallments ?? 3} paid`,
        className: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200",
      };
    }

    if (subscription.paymentPlan === "installment" && subscription.paymentStatus === "pending") {
      return {
        label: "Installment Setup Needed",
        className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
      };
    }

    return null;
  };

  const getPaymentPlanLabel = (subscription: any) => {
    if (subscription.paymentPlan === "monthly") return "Monthly billing";
    if (subscription.paymentPlan === "installment") {
      return `${subscription.numberOfInstallments ?? 3}-part installment`;
    }
    return "Full payment";
  };

  const groupedSubscriptionsForTab = useMemo(() => {
    const groups = new Map<string, {
      studentName: string;
      grades: Set<string>;
      items: any[];
      activeCount: number;
      actionRequiredCount: number;
    }>();

    activeSubscriptions.forEach((entry: any) => {
      const studentName = getStudentName(entry.subscription);
      const existing = groups.get(studentName) ?? {
        studentName,
        grades: new Set<string>(),
        items: [],
        activeCount: 0,
        actionRequiredCount: 0,
      };

      if (entry.subscription.studentGrade) {
        existing.grades.add(String(entry.subscription.studentGrade));
      }

      if (entry.subscription.status === "active") {
        existing.activeCount += 1;
      }

      if (entry.subscription.paymentStatus === "pending") {
        existing.actionRequiredCount += 1;
      }

      existing.items.push(entry);
      groups.set(studentName, existing);
    });

    return Array.from(groups.values())
      .sort((a, b) => a.studentName.localeCompare(b.studentName))
      .map((group) => ({
        ...group,
        gradeLabel: group.grades.size === 1 ? Array.from(group.grades)[0] : null,
        items: [...group.items].sort((a, b) => {
          const priorityDiff = getStatusPriority(a.subscription) - getStatusPriority(b.subscription);
          if (priorityDiff !== 0) return priorityDiff;
          return (a.course?.title ?? "").localeCompare(b.course?.title ?? "");
        }),
      }));
  }, [activeSubscriptions]);

  const filteredGroupedSubscriptionsForTab = useMemo(() => {
    const query = subscriptionSearchQuery.trim().toLowerCase();
    if (!query) return groupedSubscriptionsForTab;

    return groupedSubscriptionsForTab.flatMap((group) => {
      const studentMatches = group.studentName.toLowerCase().includes(query);
      const filteredItems = studentMatches
        ? group.items
        : group.items.filter(({ course }: any) => {
            const title = course?.title?.toLowerCase() ?? "";
            const subject = course?.subject?.toLowerCase() ?? "";
            return title.includes(query) || subject.includes(query);
          });

      if (filteredItems.length === 0) return [];

      return [{
        ...group,
        items: filteredItems,
        activeCount: filteredItems.filter((item: any) => item.subscription.status === "active").length,
        actionRequiredCount: filteredItems.filter((item: any) => item.subscription.paymentStatus === "pending").length,
      }];
    });
  }, [groupedSubscriptionsForTab, subscriptionSearchQuery]);

  // Map sessionId -> structured note for quick lookup in history
  const noteBySessionId = useMemo(() => {
    const map = new Map<number, NonNullable<typeof sessionNotes>[number]>();
    (sessionNotes || []).forEach((note) => {
      if (note.sessionId) map.set(note.sessionId, note);
    });
    return map;
  }, [sessionNotes]);

  // Map sessionId -> quiz for quick lookup in history
  const quizBySessionId = useMemo(() => {
    const map = new Map<number, NonNullable<typeof parentQuizzes>[number]>();
    (parentQuizzes || []).forEach((q) => map.set(q.sessionId, q));
    return map;
  }, [parentQuizzes]);

  // Map sessionId -> rubric grade for quick lookup in history
  const gradeBySessionId = useMemo(() => {
    const map = new Map<number, NonNullable<typeof parentGrades>[number]>();
    (parentGrades || []).forEach((g) => { if (g.sessionId) map.set(g.sessionId, g); });
    return map;
  }, [parentGrades]);

  // Track which session grade cards are expanded to show evidence
  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());
  const toggleGradeExpand = (sessionId: number) => {
    setExpandedGrades((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId); else next.add(sessionId);
      return next;
    });
  };

  // Analytics computations
  const analyticsStats = useMemo(() => {
    const allSessions = sessionHistory || [];
    const completed = allSessions.filter(s => s.status === "completed");
    const noShows = allSessions.filter(s => s.status === "no_show");
    const totalScheduled = allSessions.filter(s => s.status === "completed" || s.status === "no_show" || s.status === "scheduled");
    const attendanceRate = totalScheduled.length > 0 ? Math.round((completed.length / totalScheduled.length) * 100) : 0;
    const totalMinutes = completed.reduce((sum, s) => sum + (s.duration || 0), 0);

    // Per-student breakdown
    const studentMap = new Map<string, { sessions: number; lastSession: number | null; quizScores: number[] }>();
    completed.forEach((s) => {
      const name = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim() || "Student";
      if (!studentMap.has(name)) studentMap.set(name, { sessions: 0, lastSession: null, quizScores: [] });
      const entry = studentMap.get(name)!;
      entry.sessions += 1;
      if (entry.lastSession === null || s.scheduledAt > entry.lastSession) entry.lastSession = s.scheduledAt;
    });
    (parentQuizzes || []).filter(q => q.status === "completed" && q.score != null).forEach((q) => {
      const session = allSessions.find(s => s.id === q.sessionId);
      if (!session) return;
      const name = [session.studentFirstName, session.studentLastName].filter(Boolean).join(" ").trim() || "Student";
      if (studentMap.has(name)) studentMap.get(name)!.quizScores.push(q.score!);
    });

    // Monthly sessions (last 6 months)
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      const count = completed.filter(s => {
        const sd = new Date(s.scheduledAt);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      }).length;
      months.push({ label, count });
    }

    const completedQuizzes = (parentQuizzes || []).filter(q => q.status === "completed");
    const avgQuizScore = completedQuizzes.length > 0
      ? Math.round(completedQuizzes.reduce((sum, q) => sum + (q.score ?? 0), 0) / completedQuizzes.length)
      : null;

    return {
      totalCompleted: completed.length,
      noShowCount: noShows.length,
      attendanceRate,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      studentBreakdown: Array.from(studentMap.entries()).map(([name, data]) => ({ name, ...data })),
      monthlyActivity: months,
      completedQuizzes: completedQuizzes.length,
      avgQuizScore,
    };
  }, [sessionHistory, parentQuizzes]);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <ReferralCouponPopup />

      <div className="flex-1 mt-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-b border-border">
          <div className="container py-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Parent Dashboard</h1>
                <p className="text-muted-foreground">Manage your child's tutoring sessions and progress</p>
              </div>
              <NotificationCenter />
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Overview Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Active Subscriptions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-3xl font-bold">{activeSubscriptions.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Upcoming Sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-accent" />
                  </div>
                  <span className="text-3xl font-bold">{upcomingSessions?.length || 0}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Completed Sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-success" />
                  </div>
                  <span className="text-3xl font-bold">{completedSessions.length}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Active Tutors</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <span className="text-3xl font-bold">
                    {new Set(
                      activeSubscriptions
                        .map(s => s.tutor?.id)
                        .filter((id): id is number => Boolean(id))
                    ).size}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="overflow-x-auto">
              <TabsList className="inline-flex min-w-max gap-2 sm:w-full sm:flex-wrap sm:justify-start">
                <TabsTrigger className="whitespace-nowrap" value="subscriptions">Subscriptions</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="bookings">My Bookings</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="schedule">Schedule</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="sessions">Sessions</TabsTrigger>
                <TabsTrigger
                  className={`whitespace-nowrap ${historyPulse ? "ring-2 ring-primary/60 animate-pulse" : ""}`}
                  value="history"
                >
                  History
                </TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="analytics">Analytics</TabsTrigger>
              </TabsList>
            </div>

            <div>
            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" forceMount className={tabContentClass}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">My Subscriptions</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Search by student name or enrolled course
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-[340px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={subscriptionSearchQuery}
                      onChange={(event) => setSubscriptionSearchQuery(event.target.value)}
                      placeholder="Search student or course..."
                      className="pl-9"
                    />
                  </div>

                  <Button asChild>
                    <Link href="/tutors">Find More Tutors</Link>
                  </Button>
                </div>
              </div>

              {subsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
              ) : activeSubscriptions.length > 0 ? (
                <div className="space-y-6">
                  {filteredGroupedSubscriptionsForTab.length === 0 ? (
                    <Card>
                      <CardContent className="py-14 text-center">
                        <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">No matching subscriptions</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          No students or courses matched "{subscriptionSearchQuery.trim()}".
                        </p>
                      </CardContent>
                    </Card>
                  ) : filteredGroupedSubscriptionsForTab.map(({ studentName, gradeLabel, items, activeCount, actionRequiredCount }) => {
                    const useHorizontalScroll = items.length > 2;

                    return (
                    <section key={studentName} className="space-y-3">
                      <div className="flex flex-col gap-2 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold tracking-tight">{studentName}</h3>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {[
                              items.length === 1 ? "1 course" : `${items.length} courses`,
                              gradeLabel,
                              actionRequiredCount > 0 ? `${actionRequiredCount} needs attention` : `${activeCount} active`,
                            ].filter(Boolean).join(" • ")}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {useHorizontalScroll && (
                            <span className="self-center text-xs text-muted-foreground">
                              Scroll to view all
                            </span>
                          )}
                          {actionRequiredCount > 0 && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                              {actionRequiredCount} action required
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-muted-foreground">
                            {items.length} {items.length === 1 ? "course" : "courses"}
                          </Badge>
                        </div>
                      </div>

                      <div
                        className={cn(
                          useHorizontalScroll
                            ? "grid grid-flow-col auto-cols-[85%] gap-3 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory [scrollbar-width:thin] sm:auto-cols-[calc((100%-0.75rem)/2)]"
                            : "grid gap-3 lg:grid-cols-2",
                        )}
                      >
                        {items.map(({ subscription, course, tutor, sessionStats, nextBillingDate, nextBillingAmount }: any) => {
                          const totalSessions = course.totalSessions || 0;
                          const completedCount = sessionStats?.completedCount || 0;
                          const scheduledCount = sessionStats?.scheduledCount || 0;
                          const remainingSessions = Math.max(totalSessions - completedCount - scheduledCount, 0);
                          const accountedSessions = totalSessions > 0 ? Math.min(completedCount + scheduledCount, totalSessions) : 0;
                          const progressValue = totalSessions > 0 ? Math.round((accountedSessions / totalSessions) * 100) : 0;
                          const primaryStatus = getPrimaryStatusBadge(subscription);
                          const paymentStatus = getPaymentStatusBadge(subscription);

                          return (
                            <Card
                              key={subscription.id}
                              className={cn(
                                "flex h-full flex-col border-border/60 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
                                useHorizontalScroll && "snap-start"
                              )}
                            >
                              <CardHeader className="space-y-3 p-5 pb-3">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                  <div className="space-y-1">
                                    <CardTitle className="text-lg leading-tight">{course.title}</CardTitle>
                                    <CardDescription className="text-sm">
                                      with <span className="font-medium text-foreground">{tutor?.name ?? "Tutor"}</span>
                                    </CardDescription>
                                  </div>

                                  <div className="flex flex-wrap gap-2 sm:max-w-[240px] sm:justify-end">
                                    <Badge variant="secondary" className={`text-[11px] ${primaryStatus.className}`}>
                                      {primaryStatus.label}
                                    </Badge>
                                    {paymentStatus && (
                                      <Badge variant="secondary" className={`text-[11px] ${paymentStatus.className}`}>
                                        {paymentStatus.label}
                                      </Badge>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap gap-2 text-xs">
                                  <span className="rounded-full bg-muted/50 px-3 py-1 text-muted-foreground">
                                    <span className="font-medium text-foreground">Started:</span>{" "}
                                    {new Date(subscription.startDate).toLocaleDateString()}
                                  </span>
                                  <span className="rounded-full bg-muted/50 px-3 py-1 text-muted-foreground">
                                    <span className="font-medium text-foreground">Plan:</span>{" "}
                                    {getPaymentPlanLabel(subscription)}
                                  </span>
                                </div>
                              </CardHeader>

                              <CardContent className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-0">
                                <div className="rounded-lg border border-border/60 bg-background p-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium">Session progress</p>
                                    {totalSessions > 0 ? (
                                      <span className="text-xs text-muted-foreground">
                                        {accountedSessions}/{totalSessions}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">No session cap</span>
                                    )}
                                  </div>

                                  {totalSessions > 0 && (
                                    <Progress value={progressValue} className="mt-2 h-2" />
                                  )}

                                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span className="rounded-full bg-muted/50 px-2.5 py-1">
                                      <span className="font-medium text-foreground">{completedCount}</span> completed
                                    </span>
                                    <span className="rounded-full bg-muted/50 px-2.5 py-1">
                                      <span className="font-medium text-foreground">{scheduledCount}</span> scheduled
                                    </span>
                                    <span className="rounded-full bg-muted/50 px-2.5 py-1">
                                      <span className="font-medium text-foreground">{totalSessions > 0 ? remainingSessions : "—"}</span> remaining
                                    </span>
                                  </div>
                                </div>

                                {subscription.paymentPlan === "installment" && subscription.paymentStatus === "paid" && !!nextBillingDate && !isNaN(nextBillingDate) && (subscription as any).installmentsPaidCount < (subscription.numberOfInstallments ?? 3) && (
                                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm dark:border-blue-900 dark:bg-blue-950/20">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                      <span className="text-blue-800 dark:text-blue-200">
                                        Next installment ({((subscription as any).installmentsPaidCount ?? 0) + 1} of {subscription.numberOfInstallments ?? 3})
                                      </span>
                                      <span className="font-medium text-blue-900 dark:text-blue-100">
                                        {new Date(nextBillingDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                        {nextBillingAmount != null && (
                                          <span className="ml-2">{formatPrice(nextBillingAmount as number)}</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {subscription.paymentPlan === "monthly" && (subscription.paymentStatus === "paid" || subscription.paymentStatus === "completed") && !!nextBillingDate && !isNaN(nextBillingDate) && (
                                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm dark:border-blue-900 dark:bg-blue-950/20">
                                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                      <span className="text-blue-800 dark:text-blue-200">Next billing</span>
                                      <span className="font-medium text-blue-900 dark:text-blue-100">
                                        {new Date(nextBillingDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                        {nextBillingAmount != null && (
                                          <span className="ml-2">{formatPrice(nextBillingAmount as number)}</span>
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {subscription.paymentStatus === "pending" && subscription.paymentPlan === "monthly" && (
                                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/20">
                                    <p className="mb-2 text-sm text-amber-900 dark:text-amber-200">
                                      Add your payment method to activate monthly billing.
                                    </p>
                                    <Button
                                      size="sm"
                                      className="w-full"
                                      disabled={setupLoadingId === subscription.id}
                                      onClick={async () => {
                                        try {
                                          setSetupLoadingId(subscription.id);
                                          const result = await setupBillingMutation.mutateAsync({
                                            subscriptionId: subscription.id,
                                            origin: window.location.origin,
                                          });
                                          if (result?.setupUrl) {
                                            window.open(result.setupUrl, "_blank");
                                          } else {
                                            toast.error("Could not create billing setup. Please contact support.");
                                          }
                                        } catch (error) {
                                          toast.error("Failed to set up billing");
                                        } finally {
                                          setSetupLoadingId(null);
                                        }
                                      }}
                                    >
                                      <CreditCard className="mr-2 h-4 w-4" />
                                      {setupLoadingId === subscription.id ? "Setting up..." : "Set Up Monthly Billing"}
                                    </Button>
                                  </div>
                                )}

                                {subscription.paymentStatus === "pending" && (subscription.paymentPlan === "full" || subscription.paymentPlan === "installment") && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 dark:border-red-900 dark:bg-red-950/20">
                                    <p className="mb-2 text-sm text-red-900 dark:text-red-200">
                                      Payment is required to activate this enrollment.
                                    </p>
                                    <Button
                                      size="sm"
                                      className="w-full"
                                      disabled={retryLoadingId === subscription.id}
                                      onClick={async () => {
                                        try {
                                          setRetryLoadingId(subscription.id);
                                          const result = await retryCheckoutMutation.mutateAsync({
                                            subscriptionId: subscription.id,
                                            origin: window.location.origin,
                                          });
                                          if (result?.checkoutUrl) {
                                            window.open(result.checkoutUrl, "_blank");
                                          } else {
                                            toast.error("Could not create payment session. Please contact support.");
                                          }
                                        } catch (error: any) {
                                          toast.error(error?.message || "Failed to initiate payment");
                                        } finally {
                                          setRetryLoadingId(null);
                                        }
                                      }}
                                    >
                                      <CreditCard className="mr-2 h-4 w-4" />
                                      {retryLoadingId === subscription.id ? "Redirecting..." : "Complete Payment"}
                                    </Button>
                                  </div>
                                )}

                                <div className="mt-auto space-y-2">
                                  {subscription.status === "active" && subscription.paymentStatus === "paid" && (
                                    <Button
                                      size="sm"
                                      className="w-full"
                                      onClick={() => setActiveTab("schedule")}
                                    >
                                      <Calendar className="mr-2 h-4 w-4" />
                                      Book Session
                                    </Button>
                                  )}

                                  <div className="flex gap-2">
                                    <Button asChild variant="outline" size="sm" className="flex-1">
                                      <Link href={`/course/${course.id}`}>
                                        View Course
                                      </Link>
                                    </Button>
                                    <Button asChild variant="outline" size="sm" className="flex-1">
                                      <Link href="/messages" className="flex items-center justify-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Message
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </section>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No Active Subscriptions</h3>
                    <p className="text-muted-foreground mb-6">
                      Start your learning journey by finding a tutor
                    </p>
                    <Button asChild>
                      <Link href="/tutors">Browse Tutors</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Bookings Tab */}
            <TabsContent value="bookings" forceMount className={tabContentClass}>
              <ParentBookingsManager />
            </TabsContent>

            {/* Schedule Tab - New Acuity-style interface */}
            <TabsContent value="schedule" forceMount className={tabContentClass}>
              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2">Schedule Sessions</h2>
                <p className="text-sm text-muted-foreground">
                  Book tutoring sessions with your subscribed tutors
                </p>
              </div>

              {activeSubscriptions.length > 0 ? (
                <AppointmentScheduler
                  subscriptions={activeSubscriptions}
                  onScheduleComplete={async () => {
                    // Refresh data after scheduling
                    await refetchSubscriptions();
                    await refetchSessions();
                    await refetchHistory();
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No Active Subscriptions</h3>
                    <p className="text-muted-foreground mb-6">
                      Subscribe to a course to start scheduling sessions
                    </p>
                    <Button asChild>
                      <Link href="/tutors">Browse Tutors</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Sessions Tab */}
            <TabsContent value="sessions" forceMount className={tabContentClass}>
              <h2 className="text-2xl font-bold mb-6">Upcoming Sessions</h2>
              <ParentSessionsManager
                upcomingSessions={upcomingSessions || []}
                sessionsLoading={sessionsLoading}
              />
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" forceMount className={tabContentClass}>
              <h2 className="text-2xl font-bold">Session History</h2>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="history-student">Student</Label>
                  <Select value={selectedHistoryStudent} onValueChange={setSelectedHistoryStudent}>
                    <SelectTrigger id="history-student">
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {noteStudentOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="history-time">Time Period</Label>
                  <Select value={selectedHistoryTime} onValueChange={setSelectedHistoryTime}>
                    <SelectTrigger id="history-time">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All time</SelectItem>
                      <SelectItem value="this_month">This month</SelectItem>
                      <SelectItem value="last_month">Last month</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="history-course">Course</Label>
                  <Select value={selectedHistoryCourse} onValueChange={setSelectedHistoryCourse}>
                    <SelectTrigger id="history-course">
                      <SelectValue placeholder="All courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All courses</SelectItem>
                      {subjectOptions.map((subject) => (
                        <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {historyLoading ? (
                <div className="space-y-4 mt-6">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
              ) : filteredHistorySessions.length > 0 ? (
                <div className="space-y-4 mt-6">
                  {filteredHistorySessions
                    .slice(0, 10)
                    .map((session) => (
                    <Card key={session.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-sm text-muted-foreground">{session.courseTitle || "Course"}</div>
                            <p className="font-semibold">
                              {new Date(session.scheduledAt).toLocaleDateString()} • {new Date(session.scheduledAt).toLocaleTimeString()}
                            </p>
                            <Badge
                              variant={
                                session.status === "completed" ? "default" :
                                session.status === "no_show" ? "outline" :
                                "secondary"
                              }
                              className={
                                session.status === "no_show"
                                  ? "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800"
                                  : ""
                              }
                            >
                              {session.status === "no_show" ? "Completed (No Show)" : session.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {session.duration} minutes • Tutor: {session.tutorName || "Tutor"}
                            {(session.studentFirstName || session.studentLastName) && (
                              <> • Student: {[session.studentFirstName, session.studentLastName].filter(Boolean).join(" ")}</>
                            )}
                          </p>
                          {session.feedbackFromTutor && (
                            <div className="mt-3 p-4 sm:p-5 rounded-xl border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 shadow-sm">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex-1 space-y-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-base font-semibold text-blue-900 dark:text-blue-100">Session Summary</span>
                                    {noteAlerts[session.id] && (
                                      <Badge variant="default" className="text-xs flex items-center gap-1 bg-green-500 hover:bg-green-600">
                                        <span className="inline-block h-2 w-2 rounded-full bg-white animate-pulse" />
                                        New Update
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                                    <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap break-words">
                                      {session.feedbackFromTutor}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {noteBySessionId.has(session.id) && (() => {
                            const n = noteBySessionId.get(session.id)!;
                            const hasExtra = n.homework || n.challenges || n.nextSteps;
                            if (!hasExtra) return null;
                            return (
                              <div className="mt-3 p-4 rounded-xl border-l-4 border-blue-400 bg-gradient-to-br from-blue-50 to-blue-100/40 dark:from-blue-950/20 dark:to-blue-900/10 space-y-2">
                                {n.homework && (
                                  <div>
                                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-0.5">Homework</p>
                                    <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap">{n.homework}</p>
                                  </div>
                                )}
                                {n.challenges && (
                                  <div>
                                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-0.5">Challenges</p>
                                    <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap">{n.challenges}</p>
                                  </div>
                                )}
                                {n.nextSteps && (
                                  <div>
                                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-0.5">Next Steps</p>
                                    <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap">{n.nextSteps}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {quizBySessionId.has(session.id) && (
                            <div className="mt-3">
                              {quizBySessionId.get(session.id)!.status === "completed" ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(() => {
                                    const s = quizBySessionId.get(session.id)!.score;
                                    const c = s == null || s >= 70 ? "text-green-600 dark:text-green-400" : s >= 40 ? "text-orange-500 dark:text-orange-400" : "text-red-600 dark:text-red-400";
                                    return (
                                      <div className={`flex items-center gap-1.5 text-sm ${c}`}>
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Quiz completed</span>
                                        {s != null && <span className="font-semibold">· {s}%</span>}
                                      </div>
                                    );
                                  })()}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      const q = quizBySessionId.get(session.id)!;
                                      const storedAnswers: Record<number, number> = q.studentAnswers
                                        ? (JSON.parse(q.studentAnswers) as number[]).reduce((acc, ans, idx) => ({ ...acc, [idx]: ans }), {})
                                        : {};
                                      setQuizModal({ quiz: q, answers: storedAnswers, submitted: true, score: q.score ?? undefined, correct: q.correctCount ?? undefined, total: q.totalCount ?? undefined });
                                    }}
                                  >
                                    View Results
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-violet-500 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:border-violet-700"
                                  onClick={() => {
                                    const q = quizBySessionId.get(session.id)!;
                                    setQuizModal({ quiz: q, answers: {}, submitted: false });
                                  }}
                                >
                                  <HelpCircle className="w-3 h-3 mr-1" />
                                  Take Quiz
                                </Button>
                              )}
                            </div>
                          )}

                          {/* Session Grade */}
                          {gradeBySessionId.has(session.id) && (() => {
                            const g = gradeBySessionId.get(session.id)!;
                            const score = g.rubricOverallScore;
                            const isExpanded = expandedGrades.has(session.id);
                            const evidence: { criterion: string; score: number; evidence: string }[] = Array.isArray(g.rubricEvidence) ? g.rubricEvidence : [];
                            const scoreLabel = score == null ? null : score >= 3.5 ? "Excellent" : score >= 2.5 ? "Proficient" : score >= 1.5 ? "Developing" : "Needs Support";
                            const scoreBg = score == null ? "bg-muted" : score >= 3.5 ? "bg-emerald-500" : score >= 2.5 ? "bg-blue-500" : score >= 1.5 ? "bg-amber-400" : "bg-red-500";
                            const scoreText = score == null ? "text-muted-foreground" : score >= 3.5 ? "text-emerald-600 dark:text-emerald-400" : score >= 2.5 ? "text-blue-600 dark:text-blue-400" : score >= 1.5 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";
                            return (
                              <div className="mt-4 rounded-xl border border-border/60 overflow-hidden shadow-sm">
                                {/* Header bar */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border-b border-border/50">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                    <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Teaching Quality</span>
                                  </div>
                                  <button
                                    onClick={() => toggleGradeExpand(session.id)}
                                    className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-200 font-medium transition-colors"
                                  >
                                    {isExpanded ? "Hide details" : "View details"}
                                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                  </button>
                                </div>

                                <div className="px-4 py-3 space-y-3 bg-background">
                                  {/* Score summary row */}
                                  <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 flex-1">
                                      <div className="relative w-10 h-10 shrink-0">
                                        <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                                          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/40" />
                                          <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                                            strokeDasharray={`${((score ?? 0) / 4) * 94.2} 94.2`}
                                            strokeLinecap="round"
                                            className={score == null ? "text-muted" : score >= 3.5 ? "text-emerald-500" : score >= 2.5 ? "text-blue-500" : score >= 1.5 ? "text-amber-400" : "text-red-500"}
                                          />
                                        </svg>
                                        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${scoreText}`}>
                                          {score != null ? score.toFixed(1) : "—"}
                                        </span>
                                      </div>
                                      <div>
                                        <p className={`text-sm font-bold ${scoreText}`}>{scoreLabel ?? "—"}</p>
                                        <p className="text-xs text-muted-foreground">out of 4.0</p>
                                      </div>
                                    </div>
                                    {/* Mini score pills */}
                                    <div className="flex gap-1.5 flex-wrap justify-end">
                                      {evidence.map((e) => {
                                        const pill = e.score === 4 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : e.score === 3 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : e.score === 2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
                                        const short = e.criterion.split(" ")[0];
                                        return (
                                          <span key={e.criterion} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${pill}`} title={e.criterion}>
                                            {short} {e.score}/4
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Expanded detail */}
                                  {isExpanded && (
                                    <div className="space-y-2.5 pt-1 border-t border-border/40">
                                      {evidence.map((e) => {
                                        const bar = e.score === 4 ? "bg-emerald-500" : e.score === 3 ? "bg-blue-500" : e.score === 2 ? "bg-amber-400" : "bg-red-500";
                                        const label = e.score === 4 ? "Excellent" : e.score === 3 ? "Proficient" : e.score === 2 ? "Developing" : "Support";
                                        return (
                                          <div key={e.criterion} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-xs font-medium truncate flex-1">{e.criterion}</span>
                                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${e.score === 4 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : e.score === 3 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : e.score === 2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>{e.score}/4 · {label}</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                              <div className={`h-1.5 rounded-full ${bar} transition-all`} style={{ width: `${(e.score / 4) * 100}%` }} />
                                            </div>
                                            {e.evidence && (
                                              <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-muted pl-2">"{e.evidence}"</p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Quality warning */}
                                  {g.rubricTranscriptQuality === "low" && (
                                    <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5">
                                      <span className="text-amber-500 shrink-0 text-xs mt-0.5">⚠️</span>
                                      <p className="text-xs text-amber-700 dark:text-amber-400">Grade may be inaccurate — {g.rubricTranscriptQualityReason || "transcript had audio gaps"}</p>
                                    </div>
                                  )}

                                  {/* Footer note */}
                                  <p className="text-[10px] text-muted-foreground/70 italic border-t border-border/30 pt-2">
                                    AI-assisted quality signal based on session transcript. Scores reflect observable teaching behaviors only.
                                  </p>
                                </div>
                              </div>
                            );
                          })()}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No Session History</h3>
                    <p className="text-muted-foreground">
                      Your completed sessions will appear here
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" forceMount className={tabContentClass}>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-2xl font-bold">Learning Analytics</h2>
                  <p className="text-sm text-muted-foreground mt-0.5">Overview of your child's progress and activity</p>
                </div>
                {previousLastSignedIn && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2 self-start sm:self-auto">
                    <LogIn className="w-3.5 h-3.5 shrink-0" />
                    <span>Last login: <span className="font-medium text-foreground">{new Date(previousLastSignedIn).toLocaleString()}</span></span>
                  </div>
                )}
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                {/* Sessions Completed */}
                <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider opacity-80">Sessions Done</p>
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold">{analyticsStats.totalCompleted}</p>
                  <p className="text-xs opacity-70 mt-1">completed sessions</p>
                </div>

                {/* Attendance Rate */}
                <div className={`rounded-2xl p-5 text-white shadow-md bg-gradient-to-br ${analyticsStats.attendanceRate >= 80 ? "from-emerald-500 to-emerald-600" : analyticsStats.attendanceRate >= 60 ? "from-orange-400 to-orange-500" : "from-red-500 to-red-600"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider opacity-80">Attendance</p>
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold">{analyticsStats.attendanceRate}%</p>
                  <p className="text-xs opacity-70 mt-1">{analyticsStats.attendanceRate >= 80 ? "excellent" : analyticsStats.attendanceRate >= 60 ? "needs improvement" : "low attendance"}</p>
                </div>

                {/* Total Hours */}
                <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 p-5 text-white shadow-md">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider opacity-80">Total Hours</p>
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold">{analyticsStats.totalHours}</p>
                  <p className="text-xs opacity-70 mt-1">hours of learning</p>
                </div>

                {/* Avg Quiz Score */}
                <div className={`rounded-2xl p-5 text-white shadow-md bg-gradient-to-br ${analyticsStats.avgQuizScore == null ? "from-slate-400 to-slate-500" : analyticsStats.avgQuizScore >= 70 ? "from-teal-500 to-teal-600" : analyticsStats.avgQuizScore >= 40 ? "from-amber-400 to-amber-500" : "from-rose-500 to-rose-600"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-medium uppercase tracking-wider opacity-80">Avg Quiz Score</p>
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <HelpCircle className="w-4 h-4" />
                    </div>
                  </div>
                  <p className="text-4xl font-bold">{analyticsStats.avgQuizScore != null ? `${analyticsStats.avgQuizScore}%` : "—"}</p>
                  <p className="text-xs opacity-70 mt-1">{analyticsStats.avgQuizScore != null ? `${analyticsStats.completedQuizzes} quiz${analyticsStats.completedQuizzes !== 1 ? "zes" : ""} taken` : "no quizzes yet"}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Monthly Activity */}
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
                    <BarChart2 className="w-4 h-4 text-primary" /> Monthly Activity
                  </h3>
                  <div className="rounded-xl border bg-card shadow-sm p-5 space-y-3 flex-1">
                    {analyticsStats.monthlyActivity.every(m => m.count === 0) ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-muted-foreground gap-2">
                        <BarChart2 className="w-8 h-8 opacity-30" />
                        <p className="text-sm">No session data yet</p>
                      </div>
                    ) : (
                      <>
                        {(() => {
                          const max = Math.max(...analyticsStats.monthlyActivity.map(m => m.count), 1);
                          return analyticsStats.monthlyActivity.map(({ label, count }) => (
                            <div key={label} className="flex items-center gap-3 text-sm">
                              <span className="w-20 text-muted-foreground shrink-0 text-xs">{label}</span>
                              <div className="flex-1 bg-muted rounded-full h-2.5 overflow-hidden">
                                <div
                                  className="h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500"
                                  style={{ width: `${(count / max) * 100}%` }}
                                />
                              </div>
                              <span className="w-5 text-right font-semibold text-xs">{count}</span>
                            </div>
                          ));
                        })()}
                      </>
                    )}
                  </div>
                </div>

                {/* No-show + quick summary */}
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-primary" /> Session Summary
                  </h3>
                  <div className="rounded-xl border bg-card shadow-sm divide-y flex-1">
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        Completed
                      </div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{analyticsStats.totalCompleted}</span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                        Scheduled
                      </div>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {(subscriptions || []).reduce((sum, s) => sum + (s.sessionStats?.scheduledCount ?? 0), 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                        No-shows
                      </div>
                      <span className={`font-semibold ${analyticsStats.noShowCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>
                        {analyticsStats.noShowCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0" />
                        Active Enrollments
                      </div>
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {(subscriptions || []).filter(s => s.subscription.status === "active").length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Teaching Quality */}
              {parentGrades && parentGrades.length > 0 && (() => {
                const criteria = [
                  { key: "rubricAcademicEfficiency", label: "Academic Efficiency" },
                  { key: "rubricInstructionalQuality", label: "Instructional Quality" },
                  { key: "rubricStrategyInsight", label: "Strategy & Insight" },
                  { key: "rubricSynthesisBranding", label: "Synthesis & Branding" },
                ] as const;
                const gradedRows = parentGrades.filter(g => g.rubricOverallScore != null);
                const avgFor = (key: string) => {
                  const vals = gradedRows.map(g => (g as any)[key]).filter((v: any) => v != null) as number[];
                  return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                };
                const scoreColor = (v: number | null) => v == null ? "bg-muted" : v >= 3.5 ? "bg-emerald-500" : v >= 2.5 ? "bg-blue-500" : v >= 1.5 ? "bg-amber-400" : "bg-red-500";
                const scoreText = (v: number | null) => v == null ? "text-muted-foreground" : v >= 3.5 ? "text-emerald-600 dark:text-emerald-400" : v >= 2.5 ? "text-blue-600 dark:text-blue-400" : v >= 1.5 ? "text-amber-500" : "text-red-600 dark:text-red-400";
                return (
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-primary" /> Teaching Quality
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Avg scores card */}
                      <div className="rounded-xl border bg-card shadow-sm flex-1">
                        <div className="px-5 pt-4 pb-5 space-y-3">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Avg Rubric Scores ({gradedRows.length} session{gradedRows.length !== 1 ? "s" : ""} graded)</p>
                          {criteria.map(({ key, label }) => {
                            const avg = avgFor(key);
                            return (
                              <div key={key} className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-36 shrink-0">{label}</span>
                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                  <div className={`h-2 rounded-full ${scoreColor(avg)} transition-all`} style={{ width: avg ? `${(avg / 4) * 100}%` : "0%" }} />
                                </div>
                                <span className={`text-xs font-semibold w-8 text-right ${scoreText(avg)}`}>{avg != null ? avg.toFixed(1) : "—"}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Score trend card */}
                      <div className="rounded-xl border bg-card shadow-sm flex-1">
                        <div className="px-5 pt-4 pb-5 space-y-3">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Score Trend (per session)</p>
                          {gradedRows.length < 2 ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">Grade more sessions to see a trend.</p>
                          ) : (
                            <div className="flex items-end gap-2 h-24 pt-2">
                              {gradedRows.slice().reverse().map((g, i) => {
                                const score = g.rubricOverallScore ?? 0;
                                const heightPct = (score / 4) * 100;
                                const bar = score >= 3.5 ? "bg-emerald-500" : score >= 2.5 ? "bg-blue-500" : score >= 1.5 ? "bg-amber-400" : "bg-red-500";
                                const dateLabel = g.scheduledAt ? new Date(g.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : `#${i + 1}`;
                                return (
                                  <div key={i} className="flex flex-col items-center gap-1 flex-1" title={`${dateLabel}: ${score.toFixed(1)}/4`}>
                                    <span className="text-xs font-semibold text-muted-foreground">{score.toFixed(1)}</span>
                                    <div className="w-full flex items-end justify-center h-16">
                                      <div className={`w-full rounded-t ${bar} transition-all`} style={{ height: `${heightPct}%` }} />
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate w-full text-center">{dateLabel}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Per-Student Breakdown */}
              {analyticsStats.studentBreakdown.length > 0 && (
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-primary" /> Student Breakdown
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {analyticsStats.studentBreakdown.map(({ name, sessions, lastSession, quizScores }) => {
                      const avg = quizScores.length > 0 ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length) : null;
                      const initials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                      return (
                        <div key={name} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                          <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-violet-500" />
                          <div className="px-5 pt-4 pb-5 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                {initials}
                              </div>
                              <div>
                                <p className="font-semibold text-base leading-tight">{name}</p>
                                <p className="text-xs text-muted-foreground">{lastSession ? `Last session ${new Date(lastSession).toLocaleDateString()}` : "No sessions yet"}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-3 text-center">
                                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{sessions}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Sessions</p>
                              </div>
                              <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 p-3 text-center">
                                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{quizScores.length}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">Quizzes</p>
                              </div>
                              <div className={`rounded-xl p-3 text-center ${avg == null ? "bg-muted/50" : avg >= 70 ? "bg-emerald-50 dark:bg-emerald-950/40" : avg >= 40 ? "bg-amber-50 dark:bg-amber-950/40" : "bg-red-50 dark:bg-red-950/40"}`}>
                                <p className={`text-2xl font-bold ${avg == null ? "text-muted-foreground" : avg >= 70 ? "text-emerald-600 dark:text-emerald-400" : avg >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                                  {avg != null ? `${avg}%` : "—"}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">Avg Score</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>

      {/* Quiz Taking Modal */}
      {quizModal && (
        <Dialog open={true} onOpenChange={() => setQuizModal(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
            <div className="px-6 pt-6 pb-4 border-b shrink-0">
              <DialogTitle>Session Quiz</DialogTitle>
              <DialogDescription className="mt-1">
                {quizModal.submitted
                  ? "Quiz completed! Here are your results."
                  : `Answer all ${quizModal.quiz.questions.length} questions then submit.`}
              </DialogDescription>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-6 px-6 py-4">
              {quizModal.submitted ? (
                <div className="space-y-4">
                  <div className="text-center space-y-2 py-4">
                    <div className={`text-5xl font-bold ${quizModal.score == null || quizModal.score >= 70 ? "text-green-600 dark:text-green-400" : quizModal.score >= 40 ? "text-orange-500 dark:text-orange-400" : "text-red-600 dark:text-red-400"}`}>{quizModal.score}%</div>
                    <p className="text-lg text-muted-foreground">
                      {quizModal.correct} out of {quizModal.total} correct
                    </p>
                  </div>
                  {quizModal.quiz.questions.map((q, idx) => {
                    const isCorrect = quizModal.answers[idx] === q.correctAnswer;
                    return (
                      <div
                        key={q.id}
                        className={`p-3 rounded-lg border-l-4 ${
                          isCorrect
                            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
                            : "border-red-500 bg-red-50 dark:bg-red-950/20"
                        }`}
                      >
                        <p className="text-sm font-medium mb-1">{idx + 1}. {q.question}</p>
                        <p className="text-xs text-muted-foreground">
                          Your answer:{" "}
                          <span className={isCorrect ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                            {q.options[quizModal.answers[idx]] ?? "Not answered"}
                          </span>
                          {!isCorrect && (
                            <span className="text-green-600 dark:text-green-400 ml-2">
                              Correct: {q.options[q.correctAnswer]}
                            </span>
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                quizModal.quiz.questions.map((q, idx) => (
                  <div key={q.id} className="space-y-3">
                    <p className="text-sm font-semibold">{idx + 1}. {q.question}</p>
                    <RadioGroup
                      value={quizModal.answers[idx]?.toString() ?? ""}
                      onValueChange={(val) => {
                        setQuizModal((prev) =>
                          prev ? { ...prev, answers: { ...prev.answers, [idx]: parseInt(val) } } : prev
                        );
                      }}
                      className="space-y-2"
                    >
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                        >
                          <RadioGroupItem value={optIdx.toString()} id={`q${idx}-opt${optIdx}`} />
                          <Label htmlFor={`q${idx}-opt${optIdx}`} className="cursor-pointer text-sm flex-1">
                            {opt}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0">
              {quizModal.submitted ? (
                <Button onClick={() => setQuizModal(null)}>Close</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setQuizModal(null)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      const answersArray = quizModal.quiz.questions.map((_, idx) =>
                        quizModal.answers[idx] ?? -1
                      );
                      completeQuizMutation.mutate({
                        quizId: quizModal.quiz.id,
                        answers: answersArray,
                      });
                    }}
                    disabled={
                      completeQuizMutation.isPending ||
                      Object.keys(quizModal.answers).length < quizModal.quiz.questions.length
                    }
                  >
                    {completeQuizMutation.isPending ? "Submitting..." : "Submit Quiz"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Footer />
    </div>
  );
}
