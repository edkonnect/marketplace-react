import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link, useLocation } from "wouter";
import { BookOpen, Calendar, MessageSquare, CreditCard, Clock, Users, Video, FileText, HelpCircle, CheckCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_PATH } from "@/const";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ParentBookingsManager } from "@/components/ParentBookingsManager";
import { ParentSessionsManager } from "@/components/ParentSessionsManager";
import { AppointmentScheduler } from "@/components/AppointmentScheduler";
import { ReferralCouponPopup } from "@/components/ReferralCouponPopup";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ParentDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const formatPrice = useFormatPrice();
  const tabContentClass =
    "space-y-6 absolute inset-0 w-full transition-all duration-300 data-[state=active]:opacity-100 data-[state=active]:translate-x-0 data-[state=inactive]:opacity-0 data-[state=inactive]:translate-x-4 data-[state=inactive]:pointer-events-none [&[hidden]]:block [&[hidden]]:opacity-0";

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

  const studentOptions = useMemo(() => {
    const unique = new Set<string>();
    const names: string[] = [];
    activeSubscriptions.forEach(({ subscription }) => {
      const name = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
      if (!unique.has(name)) {
        unique.add(name);
        names.push(name);
      }
    });
    return names;
  }, [activeSubscriptions]);

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedSubscriptionStudent, setSelectedSubscriptionStudent] = useState<string>("all");
  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<string>("all");
  const [selectedHistoryTime, setSelectedHistoryTime] = useState<string>("all");
  const [selectedHistoryCourse, setSelectedHistoryCourse] = useState<string>("all");

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

  // Filter subscriptions by selected student for the Subscriptions tab
  const filteredSubscriptionsForTab = useMemo(() => {
    if (selectedSubscriptionStudent === "all") return activeSubscriptions;

    return activeSubscriptions.filter(({ subscription }) => {
      const name = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
      return name === selectedSubscriptionStudent;
    });
  }, [activeSubscriptions, selectedSubscriptionStudent]);

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

  // Filter subscriptions by selected student for the Schedule tab
  const filteredSubscriptions =
    selectedStudent
      ? activeSubscriptions.filter(({ subscription }) => {
          const name = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
          return name === selectedStudent;
        })
      : [];

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
              </TabsList>
            </div>

            <div className="relative min-h-[540px]">
            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" forceMount className={tabContentClass}>
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Subscriptions</h2>
                <Button asChild>
                  <Link href="/tutors">Find More Tutors</Link>
                </Button>
              </div>

              {/* Student Filter Dropdown */}
              {studentOptions.length > 1 && (
                <div className="flex items-center gap-4">
                  <Label htmlFor="subscription-student-filter" className="whitespace-nowrap">Filter by Student:</Label>
                  <Select value={selectedSubscriptionStudent} onValueChange={setSelectedSubscriptionStudent}>
                    <SelectTrigger id="subscription-student-filter" className="w-[250px]">
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

              {subsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
              ) : subscriptions && subscriptions.length > 0 ? (
                <>
                  {filteredSubscriptionsForTab.length === 0 ? (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mb-2">No Subscriptions Found</h3>
                        <p className="text-muted-foreground mb-6">
                          {selectedSubscriptionStudent === "all"
                            ? "No subscriptions found"
                            : `No subscriptions found for ${selectedSubscriptionStudent}`}
                        </p>
                        <Button asChild>
                          <Link href="/tutors">Browse Tutors</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                      {filteredSubscriptionsForTab.map(({ subscription, course, tutor, sessionStats, nextBillingDate, nextBillingAmount }: any) => {
                        // Calculate session progress
                        const totalSessions = course.totalSessions || 0;
                        const completedCount = sessionStats?.completedCount || 0;
                        const scheduledCount = sessionStats?.scheduledCount || 0;
                        const remainingSessions = totalSessions - completedCount - scheduledCount;

                        return (
                    <Card key={subscription.id} className="hover:shadow-elegant transition-all flex flex-col">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg mb-2">{course.title}</CardTitle>
                            <CardDescription>
                              {subscription.studentFirstName && subscription.studentLastName ? (
                                <span className="block mb-1">
                                  Student: {subscription.studentFirstName} {subscription.studentLastName}
                                  {subscription.studentGrade && ` (${subscription.studentGrade})`}
                                </span>
                              ) : null}
                              <span>with {tutor?.name ?? "Tutor"}</span>
                            </CardDescription>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                              {subscription.status}
                            </Badge>
                            {subscription.paymentStatus === "pending" && (subscription.paymentPlan === "full" || subscription.paymentPlan === "installment") && (
                              <Badge variant="destructive" className="text-xs">
                                Billing Pending
                              </Badge>
                            )}
                            {subscription.paymentPlan === "monthly" && subscription.paymentStatus === "pending" && (
                              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                Payment Pending
                              </Badge>
                            )}
                            {subscription.paymentPlan === "monthly" && subscription.paymentStatus === "paid" && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200">
                                Monthly Billing Active
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4 flex flex-col flex-1">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Started</p>
                            <p className="font-medium">
                              {new Date(subscription.startDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sessions</p>
                            <p className="font-medium">
                              {completedCount} completed, {scheduledCount} scheduled
                              {totalSessions > 0 && remainingSessions > 0 && `, ${remainingSessions} remaining`}
                            </p>
                          </div>
                        </div>

                        {subscription.paymentPlan === "monthly" && subscription.paymentStatus === "paid" && !!nextBillingDate && !isNaN(nextBillingDate) && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-blue-800 dark:text-blue-200">Next billing</span>
                              <span className="font-medium text-blue-900 dark:text-blue-100">
                                {new Date(nextBillingDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                {nextBillingAmount != null && (
                                  <span className="ml-2">{formatPrice(nextBillingAmount as number)}</span>
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                        {subscription.paymentStatus === "pending" && subscription.paymentPlan === "monthly" && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                            <p className="text-sm text-amber-900 dark:text-amber-200 mb-2">
                              Add your payment method to activate monthly billing
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
                              <CreditCard className="w-4 h-4 mr-2" />
                              {setupLoadingId === subscription.id ? "Setting up..." : "Set Up Monthly Billing"}
                            </Button>
                          </div>
                        )}

                        {subscription.paymentStatus === "pending" && (subscription.paymentPlan === "full" || subscription.paymentPlan === "installment") && (
                          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                            <p className="text-sm text-red-900 dark:text-red-200 mb-2">
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
                              <CreditCard className="w-4 h-4 mr-2" />
                              {retryLoadingId === subscription.id ? "Redirecting..." : "Complete Payment"}
                            </Button>
                          </div>
                        )}


                        <div className="space-y-2 mt-auto">
                          {subscription.status === "active" && subscription.paymentStatus === "paid" && (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => setActiveTab("schedule")}
                            >
                              <Calendar className="w-4 h-4 mr-2" />
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
                              <Link href="/messages" className="flex items-center gap-2">
                                  <MessageSquare className="w-4 h-4" />
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
                  )}
                </>
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
    </div>
  );
}
