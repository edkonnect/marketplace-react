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
import { BookOpen, Calendar, MessageSquare, CreditCard, Clock, Users, Video, FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_PATH } from "@/const";
import { SessionNotesFeed } from "@/components/SessionNotesFeed";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ParentBookingsManager } from "@/components/ParentBookingsManager";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// no additional imports needed

export default function ParentDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const tabContentClass =
    "space-y-6 absolute inset-0 w-full transition-all duration-300 data-[state=active]:opacity-100 data-[state=active]:translate-x-0 data-[state=inactive]:opacity-0 data-[state=inactive]:translate-x-4 data-[state=inactive]:pointer-events-none [&[hidden]]:block [&[hidden]]:opacity-0";

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

  const { data: sessionNotes, isLoading: notesLoading } = trpc.parentProfile.getSessionNotes.useQuery(
    { limit: 50 },
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

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedSubscriptionStudent, setSelectedSubscriptionStudent] = useState<string>("all");
  const [selectedNoteStudent, setSelectedNoteStudent] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

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

  const noteStudentOptions = useMemo(() => {
    const set = new Set<string>();
    // Include students that have notes
    sessionNotes?.forEach((note) => {
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
  }, [sessionNotes, activeSubscriptions, subscriptionStudentMap]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    // Courses/titles from notes
    sessionNotes?.forEach((note) => {
      if (note.courseTitle) set.add(note.courseTitle);
      else if (note.courseSubject) set.add(note.courseSubject);
    });
    // Fallback to courses from active subscriptions
    activeSubscriptions.forEach(({ course }) => {
      if (course?.title) set.add(course.title);
      else if (course?.subject) set.add(course.subject);
    });
    return Array.from(set);
  }, [sessionNotes, activeSubscriptions]);

  const filteredSessionNotes = useMemo(() => {
    if (!sessionNotes) return [];
    return sessionNotes.filter((note) => {
      const studentName =
        [note.studentFirstName, note.studentLastName].filter(Boolean).join(" ").trim() ||
        (note.subscriptionId ? subscriptionStudentMap.get(note.subscriptionId) ?? "" : "");
      const subject = note.courseTitle || note.courseSubject || "";
      const matchesStudent = selectedNoteStudent === "all" || studentName === selectedNoteStudent;
      const matchesSubject = selectedSubject === "all" || subject === selectedSubject;
      return matchesStudent && matchesSubject;
    });
  }, [sessionNotes, selectedNoteStudent, selectedSubject, subscriptionStudentMap]);

  // Filter subscriptions by selected student for the Subscriptions tab
  const filteredSubscriptionsForTab = useMemo(() => {
    if (selectedSubscriptionStudent === "all") return activeSubscriptions;

    return activeSubscriptions.filter(({ subscription }) => {
      const name = [subscription.studentFirstName, subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
      return name === selectedSubscriptionStudent;
    });
  }, [activeSubscriptions, selectedSubscriptionStudent]);

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
                <TabsTrigger className="whitespace-nowrap" value="notes">Notes</TabsTrigger>
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
                      {filteredSubscriptionsForTab.map(({ subscription, course, tutor }) => (
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
                              <span>with {tutor?.name ?? "Tutor"}</span>
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

            {/* Schedule Tab */}
            <TabsContent value="schedule" forceMount className={tabContentClass}>
              <h2 className="text-2xl font-bold">Schedule Sessions</h2>

              <div className="flex flex-col gap-2 w-full max-w-sm">
                <Label htmlFor="student-filter">Student</Label>
                <Select
                  value={selectedStudent ?? "placeholder"}
                  onValueChange={(val) => setSelectedStudent(val === "placeholder" ? null : val)}
                >
                  <SelectTrigger id="student-filter">
                    <SelectValue placeholder="Select student" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="placeholder" disabled>
                      Select student
                    </SelectItem>
                    {studentOptions.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {selectedStudent === null ? (
                <Card>
                  <CardContent className="py-10 text-center space-y-2">
                    <h3 className="text-lg font-semibold">Select a student to view availability</h3>
                    <p className="text-muted-foreground">Choose which student you want to schedule a session for.</p>
                  </CardContent>
                </Card>
              ) : filteredSubscriptions.length > 0 ? (
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
                          const tutorName = tutor?.name ?? "Tutor";
                          const tutorId = tutor?.id;
                          const hasTutor = typeof tutorId === "number";
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
                                    tutorId={tutorId!}
                                    parentId={user?.id ?? 0}
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
            <TabsContent value="sessions" forceMount className={tabContentClass}>
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
                              {(session.studentFirstName || session.studentLastName) && (
                                <p className="text-sm text-muted-foreground">
                                  Student: {[session.studentFirstName, session.studentLastName].filter(Boolean).join(" ")}
                                </p>
                              )}
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
            <TabsContent value="history" forceMount className={tabContentClass}>
              <h2 className="text-2xl font-bold">Session History</h2>

              {historyLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                </div>
              ) : sessionHistory && sessionHistory.filter(s => s.status === "scheduled" || s.status === "completed" || s.status === "no_show").length > 0 ? (
                <div className="space-y-4">
                  {sessionHistory
                    .filter((s) => s.status === "scheduled" || s.status === "completed" || s.status === "no_show")
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
                            <Badge variant={
                              session.status === "completed" ? "default" :
                              session.status === "no_show" ? "outline" :
                              "secondary"
                            }>
                              {session.status === "no_show" ? "No Show" : session.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {session.duration} minutes • Tutor: {session.tutorName || "Tutor"}
                            {(session.studentFirstName || session.studentLastName) && (
                              <> • Student: {[session.studentFirstName, session.studentLastName].filter(Boolean).join(" ")}</>
                            )}
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
            <TabsContent value="notes" forceMount className={tabContentClass}>
              <h2 className="text-2xl font-bold">Session Notes</h2>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="note-student">Student</Label>
                  <Select value={selectedNoteStudent} onValueChange={setSelectedNoteStudent}>
                    <SelectTrigger id="note-student">
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
                  <Label htmlFor="note-subject">Course</Label>
                  <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger id="note-subject">
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

              {notesLoading ? (
                <Skeleton className="h-32" />
              ) : sessionNotes && sessionNotes.length > 0 ? (
                <SessionNotesFeed notes={filteredSessionNotes} />
              ) : (
                <Card className="mt-6">
                  <CardContent className="py-16 text-center">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-xl font-semibold mb-2">No notes yet</h3>
                    <p className="text-muted-foreground">Your tutor's session notes will appear here.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
