import Navigation from "@/components/Navigation";
import SchedulingCalendar from "@/components/SchedulingCalendar";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { BookOpen, Calendar, MessageSquare, CreditCard, Clock, Users, Video } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_PATH } from "@/const";
import { SessionNotesFeed } from "@/components/SessionNotesFeed";
import { PaymentHistoryTable } from "@/components/PaymentHistoryTable";
import { NotificationSettings } from "@/components/NotificationSettings";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ParentBookingsManager } from "@/components/ParentBookingsManager";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// no additional imports needed

export default function ParentDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: subscriptions, isLoading: subsLoading } = trpc.subscription.mySubscriptions.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: upcomingSessions, isLoading: sessionsLoading } = trpc.session.myUpcoming.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: sessionHistory, isLoading: historyLoading } = trpc.session.myHistory.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: payments, isLoading: paymentsLoading } = trpc.payment.getPaymentHistory.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: sessionNotes, isLoading: notesLoading } = trpc.parentProfile.getSessionNotes.useQuery(
    { limit: 10 },
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const { data: paymentHistory, isLoading: paymentHistoryLoading } = trpc.parentProfile.getPayments.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  // Track note updates per session to show a small indicator (one-time until next update)
  const lastFeedbackRef = useRef<Map<number, string | null>>(new Map());
  const seenFeedbackRef = useRef<Map<number, string | null>>(new Map());
  const [noteAlerts, setNoteAlerts] = useState<Record<number, string>>({});
  const [historyPulse, setHistoryPulse] = useState(false);
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

  const [selectedStudent, setSelectedStudent] = useState<string>("all");
  const filteredSubscriptions =
    selectedStudent === "all"
      ? activeSubscriptions
      : activeSubscriptions.filter(({ subscription }) => {
          const name = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
          return name === selectedStudent;
        });

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

      <div className="flex-1">
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
          <Tabs defaultValue="subscriptions" className="space-y-6">
            <TabsList className="grid w-full max-w-2xl grid-cols-8">
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="bookings">My Bookings</TabsTrigger>
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger
                value="history"
                className={historyPulse ? "ring-2 ring-primary/60 animate-pulse" : ""}
              >
                History
              </TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="notifications">Notifications</TabsTrigger>
            </TabsList>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">My Subscriptions</h2>
                <Button asChild>
                  <Link href="/tutors">Find More Tutors</Link>
                </Button>
              </div>

              {subsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)}
                </div>
              ) : subscriptions && subscriptions.length > 0 ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {subscriptions.map(({ subscription, course, tutor }) => (
                    <Card key={subscription.id} className="hover:shadow-elegant transition-all">
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
                              <span>with {tutor.name || "Tutor"}</span>
                            </CardDescription>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                              {subscription.status}
                            </Badge>
                            {subscription.paymentStatus === "pending" && subscription.paymentPlan === "full" && (
                              <Badge variant="destructive" className="text-xs">
                                Payment Pending
                              </Badge>
                            )}
                            {subscription.paymentPlan === "installment" && (
                              <Badge variant="outline" className="text-xs">
                                Installment Plan
                              </Badge>
                            )}
                            {subscription.paymentPlan === "installment" && subscription.firstInstallmentPaid && !subscription.secondInstallmentPaid && (
                              <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                2nd Payment Due
                              </Badge>
                            )}
                            {subscription.paymentPlan === "installment" && subscription.firstInstallmentPaid && subscription.secondInstallmentPaid && (
                              <Badge variant="secondary" className="text-xs bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200">
                                Fully Paid
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Started</p>
                            <p className="font-medium">
                              {new Date(subscription.startDate).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Sessions</p>
                            <p className="font-medium">{subscription.sessionsCompleted || 0} completed</p>
                          </div>
                        </div>

                        {subscription.paymentStatus === "pending" && subscription.paymentPlan === "full" && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                            <p className="text-sm text-amber-900 dark:text-amber-200 mb-2">
                              Complete your payment to access all course features
                            </p>
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={async () => {
                                try {
                                  const result = await trpc.course.createCheckoutSession.useMutation().mutateAsync({
                                    courseId: course.id,
                                    studentFirstName: subscription.studentFirstName || "",
                                    studentLastName: subscription.studentLastName || "",
                                    studentGrade: subscription.studentGrade || "",
                                  });
                                  if (result?.success) {
                                    toast.success("Payment recorded as paid.");
                                    window.location.reload();
                                  } else if ((result as any)?.checkoutUrl) {
                                    window.open((result as any).checkoutUrl, "_blank");
                                  }
                                } catch (error) {
                                  toast.error("Failed to create payment session");
                                }
                              }}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                              Pay Now
                            </Button>
                          </div>
                        )}

                        {subscription.paymentPlan === "installment" && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900 space-y-2">
                            <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                              💳 Installment Payment Plan
                            </p>
                            <div className="space-y-1 text-xs text-blue-800 dark:text-blue-300">
                              <div className="flex justify-between">
                                <span>First Installment ({subscription.firstInstallmentAmount ? `$${subscription.firstInstallmentAmount}` : 'N/A'}):</span>
                                <span className={subscription.firstInstallmentPaid ? "text-green-600 dark:text-green-400 font-medium" : "text-amber-600 dark:text-amber-400"}>
                                  {subscription.firstInstallmentPaid ? "✓ Paid" : "Pending"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Second Installment ({subscription.secondInstallmentAmount ? `$${subscription.secondInstallmentAmount}` : 'N/A'}):</span>
                                <span className={subscription.secondInstallmentPaid ? "text-green-600 dark:text-green-400 font-medium" : "text-amber-600 dark:text-amber-400"}>
                                  {subscription.secondInstallmentPaid ? "✓ Paid" : "Pending"}
                                </span>
                              </div>
                            </div>
                            {subscription.firstInstallmentPaid && !subscription.secondInstallmentPaid && (
                              <Button
                                size="sm"
                                className="w-full mt-2"
                                onClick={async () => {
                                  try {
                                    const { checkoutUrl } = await trpc.payment.processSecondInstallment.useMutation().mutateAsync({
                                      subscriptionId: subscription.id,
                                    });
                                    if (checkoutUrl) {
                                      window.open(checkoutUrl, "_blank");
                                    }
                                  } catch (error) {
                                    toast.error("Failed to create payment session");
                                  }
                                }}
                              >
                                <CreditCard className="w-4 h-4 mr-2" />
                                Pay Second Installment
                              </Button>
                            )}
                          </div>
                        )}

                        <div className="space-y-2">
                          {subscription.status === "active" && subscription.paymentStatus === "paid" && (
                            <Button asChild size="sm" className="w-full">
                              <Link href={`/book-session/${subscription.id}`} className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Book Session
                              </Link>
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
                  ))}
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
            <TabsContent value="bookings" className="space-y-6">
              <ParentBookingsManager />
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-6">
              <h2 className="text-2xl font-bold">Schedule Sessions</h2>

              {studentOptions.length > 1 && (
                <div className="flex flex-col gap-2 w-full max-w-sm">
                  <Label htmlFor="student-filter">Select Student</Label>
                  <Select
                    value={selectedStudent}
                    onValueChange={setSelectedStudent}
                  >
                    <SelectTrigger id="student-filter">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {studentOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {filteredSubscriptions.length > 0 ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Select a subscription to schedule sessions</CardTitle>
                      <CardDescription>
                        Choose from your active subscriptions below
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {filteredSubscriptions.map(({ subscription, course, tutor }) => {
                          const tutorName = tutor?.name || "Tutor";
                          const tutorId = tutor?.id;
                          const hasTutor = Boolean(tutorId);
                          return (
                          <Card key={subscription.id} className="border-2">
                            <CardHeader>
                              <CardTitle className="text-lg">{course.title}</CardTitle>
                              <CardDescription>
                                {hasTutor ? `with ${tutorName}` : "Tutor assignment pending"}
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              {hasTutor ? (
                                <>
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Click on the calendar below to schedule a new session
                                  </p>
                                  <SchedulingCalendar
                                    subscriptionId={subscription.id}
                                    tutorId={tutorId}
                                    parentId={user?.id || 0}
                                  />
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  We’re assigning a tutor for this course. Scheduling will be available once assigned.
                                </p>
                              )}
                            </CardContent>
                          </Card>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>
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
            <TabsContent value="sessions" className="space-y-6">
              <h2 className="text-2xl font-bold">Upcoming Sessions</h2>

              {sessionsLoading ? (
                <div className="space-y-4">
                  {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
              ) : upcomingSessions && upcomingSessions.length > 0 ? (
                <div className="space-y-4">
                  {upcomingSessions.map((session) => (
                    <Card key={session.id} className="bg-muted/60">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Calendar className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <p className="text-lg font-semibold leading-tight">
                                {session.courseTitle || "Course"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                with {session.tutorName || "Tutor"}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Video className="w-4 h-4" />
                            <span>{session.meetingPlatform || "On Zoom"}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Starting time</p>
                            <p className="text-base font-medium">
                              {new Date(session.scheduledAt).toLocaleDateString()} • {new Date(session.scheduledAt).toLocaleTimeString()} • {session.duration} minutes
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge>{session.status}</Badge>
                            <Button
                              onClick={() => {
                                if (session.joinUrl) {
                                  window.open(session.joinUrl, "_blank");
                                } else {
                                  console.log("Join meeting clicked");
                                }
                              }}
                            >
                              Join meeting
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-16 text-center">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No Upcoming Sessions</h3>
                    <p className="text-muted-foreground">
                      Schedule sessions with your tutors to get started
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-6">
              <h2 className="text-2xl font-bold">Session History</h2>

              {historyLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
              ) : sessionHistory && sessionHistory.filter(s => s.status === "scheduled" || s.status === "completed").length > 0 ? (
                <div className="space-y-4">
                  {sessionHistory
                    .filter((s) => s.status === "scheduled" || s.status === "completed")
                    .slice(0, 10)
                    .map((session) => (
                    <Card key={session.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <div className="text-sm text-muted-foreground">{session.courseTitle || "Course"}</div>
                            <p className="font-semibold">
                              {new Date(session.scheduledAt).toLocaleDateString()}
                            </p>
                            <Badge variant={session.status === "completed" ? "default" : "secondary"}>
                              {session.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {session.duration} minutes • Tutor: {session.tutorName || "Tutor"}
                          </p>
                          {session.feedbackFromTutor && (
                            <div className="flex items-center gap-2 text-xs text-primary">
                              {noteAlerts[session.id] ? (
                                <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
                              ) : (
                                <span className="inline-block h-2 w-2 rounded-full bg-primary/50" />
                              )}
                              <span>{noteAlerts[session.id] ? "Notes updated" : "Notes available"}</span>
                            </div>
                          )}
                          {session.feedbackFromTutor && (
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Notes :</span> {session.feedbackFromTutor}
                            </p>
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

            {/* Session Notes Tab */}
            <TabsContent value="notes" className="space-y-6">
              <h2 className="text-2xl font-bold">Session Notes</h2>
              {notesLoading ? (
                <Skeleton className="h-96" />
              ) : (
                <SessionNotesFeed notes={sessionNotes || []} />
              )}
            </TabsContent>

            {/* Payment History Tab */}
            <TabsContent value="payments" className="space-y-6">
              <h2 className="text-2xl font-bold">Payment History</h2>

              {paymentsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
              ) : !payments || payments.length === 0 ? (
                <Card>
                  <CardContent className="py-16 text-center">
                    <CreditCard className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No Payment History</h3>
                    <p className="text-muted-foreground">
                      Your payment transactions will appear here
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {payments.map((payment) => (
                    <Card key={payment.id} className="hover:shadow-elegant transition-all">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <p className="font-semibold text-lg">
                                ${payment.amount} {payment.currency.toUpperCase()}
                              </p>
                              <Badge variant={payment.status === "completed" ? "default" : "secondary"}>
                                {payment.status}
                              </Badge>
                              {payment.installmentInfo && (
                                <Badge variant="outline" className="text-xs">
                                  Installment {payment.installmentInfo.installmentNumber}/2
                                </Badge>
                              )}
                            </div>
                            
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p>
                                <span className="font-medium text-foreground">Date:</span>{" "}
                                {new Date(payment.createdAt).toLocaleDateString()} at{" "}
                                {new Date(payment.createdAt).toLocaleTimeString()}
                              </p>
                              {payment.courseName && (
                                <p>
                                  <span className="font-medium text-foreground">Course:</span>{" "}
                                  {payment.courseName}
                                </p>
                              )}
                              {payment.tutorName && (
                                <p>
                                  <span className="font-medium text-foreground">Tutor:</span>{" "}
                                  {payment.tutorName}
                                </p>
                              )}
                              {payment.studentName && (
                                <p>
                                  <span className="font-medium text-foreground">Student:</span>{" "}
                                  {payment.studentName}
                                </p>
                              )}
                              {payment.stripePaymentIntentId && (
                                <p className="text-xs">
                                  <span className="font-medium text-foreground">Transaction ID:</span>{" "}
                                  {payment.stripePaymentIntentId}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                window.open(`/api/pdf/receipt/${payment.id}`, '_blank');
                              }}
                            >
                              <CreditCard className="w-4 h-4 mr-2" />
                              Download Receipt
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications" className="space-y-6">
              <h2 className="text-2xl font-bold">Notification Settings</h2>
              <NotificationSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
