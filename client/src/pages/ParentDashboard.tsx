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
import { BookOpen, Calendar, MessageSquare, CreditCard, Clock, Users, Video, FileText, HelpCircle, CheckCircle, TrendingUp, BarChart2, LogIn, Sparkles, Search, Target, Activity, Download } from "lucide-react";
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

function renderBoldMarkdown(text: string) {
  const html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function ParentFilesPanel() {
  const { data: files = [], isLoading } = trpc.fileManagement.getFilesForParent.useQuery();
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStudent, setFilterStudent] = useState<string>("all");

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  type FileRow = any;

  // Derive unique course and student options for dropdowns
  const courseOptions = Array.from(new Set((files as FileRow[]).map((r) => r.courseName ?? "General"))).sort();
  const studentOptions = Array.from(
    new Set(
      (files as FileRow[])
        .filter((r) => filterCourse === "all" || (r.courseName ?? "General") === filterCourse)
        .map((r) => r.studentFirstName ? `${r.studentFirstName} ${r.studentLastName ?? ""}`.trim() : "General")
    )
  ).sort();

  // Reset student filter when course changes
  function handleCourseChange(val: string) {
    setFilterCourse(val);
    setFilterStudent("all");
  }

  // Filter and group by course → student
  const grouped: Record<string, Record<string, FileRow[]>> = {};
  const seenKeys = new Set<string>();

  for (const row of files as FileRow[]) {
    const dedupeKey = `${row.file.id}-${row.assignment.id}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    const course = row.courseName ?? "General";
    const student = row.studentFirstName ? `${row.studentFirstName} ${row.studentLastName ?? ""}`.trim() : "General";

    if (filterCourse !== "all" && course !== filterCourse) continue;
    if (filterStudent !== "all" && student !== filterStudent) continue;

    if (!grouped[course]) grouped[course] = {};
    if (!grouped[course][student]) grouped[course][student] = [];
    grouped[course][student].push(row);
  }

  const hasResults = Object.keys(grouped).length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Files</h2>
        <p className="text-muted-foreground text-sm">Files shared with you by your tutor.</p>
      </div>

      {!isLoading && files.length > 0 && (
        <div className="flex gap-3 flex-wrap">
          <Select value={filterCourse} onValueChange={handleCourseChange}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courseOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All Students" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Students</SelectItem>
              {studentOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Your tutor hasn't shared any files with you yet.</p>
          </CardContent>
        </Card>
      ) : !hasResults ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No files match the selected filters.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([courseName, studentMap]) => (
            <div key={courseName} className="space-y-4">
              <h3 className="text-lg font-semibold border-b pb-2">{courseName}</h3>
              {Object.entries(studentMap).map(([studentName, rows]) => (
                <div key={studentName} className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide pl-1">{studentName}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {rows.map((row: any) => (
                      <Card key={`${row.file.id}-${row.assignment.id}`} className="hover:shadow-md transition-shadow">
                        <CardContent className="pt-4 pb-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{row.file.title}</p>
                                <p className="text-xs text-muted-foreground">From {row.tutorFirstName} {row.tutorLastName}</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="flex-shrink-0 text-xs">{row.file.fileType.includes("pdf") ? "PDF" : "Word"}</Badge>
                          </div>
                          {row.file.description && <p className="text-sm text-muted-foreground line-clamp-2">{row.file.description}</p>}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatFileSize(row.file.fileSize)}</span>
                            <span>{new Date(row.assignment.assignedAt).toLocaleDateString()}</span>
                          </div>
                          <Button size="sm" variant="outline" className="w-full" onClick={() => window.open(`/api/files/proxy/${row.file.id}`, "_blank")}>
                            <Download className="w-4 h-4 mr-1" /> Download / View
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParentDashboard() {
  const { user, isAuthenticated, loading, previousLastSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const formatPrice = useFormatPrice();
  const tabContentClass =
    "space-y-6 w-full data-[state=inactive]:hidden";

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
  const retryInstallmentsMutation = trpc.course.retryInstallmentCheckout.useMutation();
  const [setupLoadingId, setSetupLoadingId] = useState<number | null>(null);
  const [retryLoadingId, setRetryLoadingId] = useState<number | null>(null);
  const [retryInstallLoadingId, setRetryInstallLoadingId] = useState<number | null>(null);
  const [paymentModalSub, setPaymentModalSub] = useState<{ subscription: any; course: any } | null>(null);

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

  const [selectedSessionStudent, setSelectedSessionStudent] = useState<string>("all");
  const [selectedSessionTime, setSelectedSessionTime] = useState<string>("all");
  const [selectedSessionCourse, setSelectedSessionCourse] = useState<string>("all");
  const [subscriptionSearchQuery, setSubscriptionSearchQuery] = useState("");
  const [activeStudentTab, setActiveStudentTab] = useState(0);
  const [showSubsModal, setShowSubsModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showProficiencyModal, setShowProficiencyModal] = useState(false);
  const [showEngagementModal, setShowEngagementModal] = useState(false);

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

  const sessionStudentOptions = useMemo(() => {
    const set = new Set<string>();
    (upcomingSessions || []).forEach((s) => {
      const name = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim();
      if (name) set.add(name);
    });
    return Array.from(set);
  }, [upcomingSessions]);

  const sessionCourseOptions = useMemo(() => {
    const set = new Set<string>();
    (upcomingSessions || []).forEach((s) => {
      if (s.courseTitle) set.add(s.courseTitle);
    });
    return Array.from(set);
  }, [upcomingSessions]);

  const filteredUpcomingSessions = useMemo(() => {
    if (!upcomingSessions) return [];

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return upcomingSessions.filter((session) => {
      const studentName = [session.studentFirstName, session.studentLastName].filter(Boolean).join(" ").trim();
      const courseName = session.courseTitle || "";

      const matchesStudent = selectedSessionStudent === "all" || studentName === selectedSessionStudent;
      const matchesCourse = selectedSessionCourse === "all" || courseName === selectedSessionCourse;

      let matchesTime = true;
      if (selectedSessionTime !== "all") {
        const sessionDate = new Date(session.scheduledAt);
        const sessionMonth = sessionDate.getMonth();
        const sessionYear = sessionDate.getFullYear();
        if (selectedSessionTime === "this_month") {
          matchesTime = sessionMonth === currentMonth && sessionYear === currentYear;
        } else if (selectedSessionTime === "last_month") {
          const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
          const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
          matchesTime = sessionMonth === lastMonth && sessionYear === lastMonthYear;
        }
      }

      return matchesStudent && matchesCourse && matchesTime;
    });
  }, [upcomingSessions, selectedSessionStudent, selectedSessionTime, selectedSessionCourse]);

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

  // Track which engagement breakdown cards are expanded
  const [expandedEngagement, setExpandedEngagement] = useState<Set<number>>(new Set());
  const toggleEngagementExpand = (sessionId: number) => {
    setExpandedEngagement((prev) => {
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

    // Avg rubric score from parentGrades
    const gradedRows = (parentGrades || []).filter(g => g.rubricOverallScore != null);
    const avgRubricScore = gradedRows.length > 0
      ? Math.round((gradedRows.reduce((sum, g) => sum + Number(g.rubricOverallScore!), 0) / gradedRows.length) * 10) / 10
      : null;

    // Proficiency label based on quiz score + attendance
    let proficiencyLabel: "Above Average" | "On Track" | "Needs Attention" = "On Track";
    if (avgQuizScore != null && attendanceRate != null) {
      if (avgQuizScore >= 70 && attendanceRate >= 80) proficiencyLabel = "Above Average";
      else if (avgQuizScore < 50 || attendanceRate < 50) proficiencyLabel = "Needs Attention";
    }

    return {
      totalCompleted: completed.length,
      noShowCount: noShows.length,
      attendanceRate,
      totalHours: Math.round(totalMinutes / 60 * 10) / 10,
      studentBreakdown: Array.from(studentMap.entries()).map(([name, data]) => ({ name, ...data })),
      monthlyActivity: months,
      completedQuizzes: completedQuizzes.length,
      avgQuizScore,
      avgRubricScore,
      proficiencyLabel,
    };
  }, [sessionHistory, parentQuizzes, parentGrades]);

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
                <TabsTrigger className="whitespace-nowrap" value="my-files">My Files</TabsTrigger>
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

                                {subscription.paymentStatus === "pending" && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 dark:border-red-900 dark:bg-red-950/20">
                                    <p className="mb-2 text-sm text-red-900 dark:text-red-200">
                                      Payment is required to activate this enrollment.
                                    </p>
                                    <Button
                                      size="sm"
                                      className="w-full"
                                      onClick={() => setPaymentModalSub({ subscription, course })}
                                    >
                                      <CreditCard className="mr-2 h-4 w-4" />
                                      Complete Payment
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
              <h2 className="text-2xl font-bold">Upcoming Sessions</h2>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="session-student">Student</Label>
                  <Select value={selectedSessionStudent} onValueChange={setSelectedSessionStudent}>
                    <SelectTrigger id="session-student">
                      <SelectValue placeholder="All students" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All students</SelectItem>
                      {sessionStudentOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="session-time">Time Period</Label>
                  <Select value={selectedSessionTime} onValueChange={setSelectedSessionTime}>
                    <SelectTrigger id="session-time">
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
                  <Label htmlFor="session-course">Course</Label>
                  <Select value={selectedSessionCourse} onValueChange={setSelectedSessionCourse}>
                    <SelectTrigger id="session-course">
                      <SelectValue placeholder="All courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All courses</SelectItem>
                      {sessionCourseOptions.map((name) => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6">
                <ParentSessionsManager
                  upcomingSessions={filteredUpcomingSessions}
                  sessionsLoading={sessionsLoading}
                />
              </div>
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
                            {session.isTrial && (
                              <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/20">
                                Trial Lesson
                              </Badge>
                            )}
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
                                      {renderBoldMarkdown(session.feedbackFromTutor)}
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
                            const gEngagement = gradeBySessionId.get(session.id)!;
                            const eng = (gEngagement as any).rubricEngagementData as {
                              studentParticipationRate?: string;
                              studentRole?: string;
                              studentCriticalThinking?: string;
                              tutorParticipationRate?: string;
                              tutorRole?: string;
                              tutorInstructionalStyle?: string;
                            } | null;
                            if (eng) {
                              const isEngExpanded = expandedEngagement.has(session.id);
                              const studentName = session.studentFirstName || "Student";
                              const tutorName = (session as any).tutorName || "Tutor";
                              const ctLevel = eng.studentCriticalThinking?.split(".")[0]?.trim() || "";
                              const ctBadge = ctLevel === "High" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : ctLevel === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : ctLevel === "Low" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-muted text-muted-foreground";

                              const parseParticipationPct = (rate?: string) => {
                                const match = rate?.match(/(\d+(?:\.\d+)?)/);
                                return match ? parseFloat(match[1]) : null;
                              };
                              const studentPct = parseParticipationPct(eng.studentParticipationRate);
                              const tutorPct = parseParticipationPct(eng.tutorParticipationRate);
                              // Extract just the percentage portion for collapsed display
                              const extractPctDisplay = (rate?: string) => {
                                const match = rate?.match(/~?\d+(?:\.\d+)?%/);
                                return match ? match[0] : rate;
                              };

                              return (
                                <div className="mt-3 rounded-xl border border-border/60 overflow-hidden shadow-sm">
                                  {/* Header */}
                                  <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-b border-border/50">
                                    <div className="flex items-center gap-2">
                                      <svg className="w-3.5 h-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                                      <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">Engagement Breakdown</span>
                                    </div>
                                    <button
                                      onClick={() => toggleEngagementExpand(session.id)}
                                      className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 font-medium transition-colors"
                                    >
                                      {isEngExpanded ? "Hide" : "View"}
                                      <svg className={`w-3 h-3 transition-transform ${isEngExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                    </button>
                                  </div>

                                  {isEngExpanded && (
                                    <div className="px-4 py-3 space-y-4 bg-background divide-y divide-border/40">
                                      {/* Student Section */}
                                      <div className="space-y-2.5">
                                        <p className="text-xs font-semibold text-foreground">Student Engagement · {studentName}</p>
                                        {eng.studentParticipationRate && (
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs text-muted-foreground">Participation</span>
                                              <span className="text-xs font-medium">{eng.studentParticipationRate}</span>
                                            </div>
                                            {studentPct !== null && (
                                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full bg-sky-400 transition-all" style={{ width: `${Math.min(studentPct, 100)}%` }} />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {eng.studentRole && (
                                          <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Role</p>
                                            <p className="text-xs text-foreground/80 leading-relaxed">{eng.studentRole}</p>
                                          </div>
                                        )}
                                        {eng.studentCriticalThinking && (
                                          <div>
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Critical Thinking</p>
                                              {ctLevel && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ctBadge}`}>{ctLevel}</span>}
                                            </div>
                                            <p className="text-xs text-foreground/80 leading-relaxed">{eng.studentCriticalThinking}</p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Tutor Section */}
                                      <div className="space-y-2.5 pt-3">
                                        <p className="text-xs font-semibold text-foreground">Tutor Engagement · {tutorName}</p>
                                        {eng.tutorParticipationRate && (
                                          <div className="space-y-1">
                                            <div className="flex items-center justify-between">
                                              <span className="text-xs text-muted-foreground">Participation</span>
                                              <span className="text-xs font-medium">{eng.tutorParticipationRate}</span>
                                            </div>
                                            {tutorPct !== null && (
                                              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                <div className="h-1.5 rounded-full bg-violet-400 transition-all" style={{ width: `${Math.min(tutorPct, 100)}%` }} />
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        {eng.tutorRole && (
                                          <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Role</p>
                                            <p className="text-xs text-foreground/80 leading-relaxed">{eng.tutorRole}</p>
                                          </div>
                                        )}
                                        {eng.tutorInstructionalStyle && (
                                          <div>
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Instructional Style</p>
                                            <p className="text-xs text-foreground/80 leading-relaxed">{eng.tutorInstructionalStyle}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {!isEngExpanded && (
                                    <div className="px-4 py-2.5 bg-background flex items-center gap-4">
                                      {eng.studentParticipationRate && <span className="text-xs text-muted-foreground">{studentName}: <span className="font-medium text-sky-600 dark:text-sky-400">{extractPctDisplay(eng.studentParticipationRate)}</span></span>}
                                      {eng.tutorParticipationRate && <span className="text-xs text-muted-foreground">{tutorName}: <span className="font-medium text-violet-600 dark:text-violet-400">{extractPctDisplay(eng.tutorParticipationRate)}</span></span>}
                                      {ctLevel && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto ${ctBadge}`}>{ctLevel} Critical Thinking</span>}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Session Grade (rubric) */}
                          {gradeBySessionId.has(session.id) && (() => {
                            const g = gradeBySessionId.get(session.id)!;
                            const score = g.rubricOverallScore != null ? Number(g.rubricOverallScore) : null;
                            const isExpanded = expandedGrades.has(session.id);
                            const evidence: { criterion: string; score: number; evidence: string }[] = Array.isArray(g.rubricEvidence) ? g.rubricEvidence : [];
                            if (score == null && evidence.length === 0) return null;
                            const scoreLabel = score == null ? null : score >= 3.5 ? "Excellent" : score >= 2.5 ? "Proficient" : score >= 1.5 ? "Developing" : "Needs Support";
                            const scoreText = score == null ? "text-muted-foreground" : score >= 3.5 ? "text-emerald-600 dark:text-emerald-400" : score >= 2.5 ? "text-blue-600 dark:text-blue-400" : score >= 1.5 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";
                            // Parent-friendly descriptions per score level per criterion
                            const criteriaDescriptions: Record<string, Record<number, string>> = {
                              "Academic Efficiency & Time Management": {
                                4: "Session starts smoothly and quickly. Your child is actively working within minutes and stays focused almost the entire time.",
                                3: "Short setup at the beginning, then steady focus. Most of the session is productive.",
                                2: "Noticeable time lost to setup, distractions, or off-topic conversation.",
                                1: "Large portion of session feels unstructured or unproductive.",
                              },
                              "Learning Engagement & Understanding": {
                                4: "Your child explains their thinking clearly and solves problems independently with guidance.",
                                3: "Your child practices after explanations and shows understanding through solving.",
                                2: "Your child mostly watches or follows along without much independent thinking.",
                                1: "Your child is disengaged or just copying answers without understanding.",
                              },
                              "Strategy & Problem-Solving Skills": {
                                4: "Your child learns smart techniques, shortcuts, and how to approach problems efficiently.",
                                3: "Your child understands the concept and picks up a few helpful tips.",
                                2: "Focus is mainly on basic steps without deeper strategy.",
                                1: "Your child struggles to understand the concept or lacks clarity on how to apply it.",
                              },
                              "Session Value & Takeaways": {
                                4: "Your child can clearly explain what they learned and leaves with a structured plan or homework.",
                                3: "Session ends with a quick recap and some practice assigned.",
                                2: "Session ends without a clear summary or next steps.",
                                1: "No clear takeaway or direction after the session.",
                              },
                            };
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
                                        const short = e.criterion === "Academic Efficiency & Time Management" ? "Efficiency" : e.criterion === "Learning Engagement & Understanding" ? "Engagement" : e.criterion === "Strategy & Problem-Solving Skills" ? "Strategy" : "Takeaways";
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
                                        const label = e.score === 4 ? "Exceeds" : e.score === 3 ? "Proficient" : e.score === 2 ? "Developing" : "Support";
                                        const parentDesc = criteriaDescriptions[e.criterion]?.[e.score];
                                        return (
                                          <div key={e.criterion} className="space-y-1">
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-xs font-medium truncate flex-1">{e.criterion}</span>
                                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${e.score === 4 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : e.score === 3 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : e.score === 2 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"}`}>{e.score}/4 · {label}</span>
                                            </div>
                                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                              <div className={`h-1.5 rounded-full ${bar} transition-all`} style={{ width: `${(e.score / 4) * 100}%` }} />
                                            </div>
                                            {parentDesc && (
                                              <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-muted pl-2">{parentDesc}</p>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}


                                  {/* Footer note */}
                                  <p className="text-[10px] text-muted-foreground/70 italic border-t border-border/30 pt-2">
                                    AI-assisted quality signal based on session transcript. Scores reflect observable session quality.
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
            <TabsContent value="my-files" forceMount className={tabContentClass}>
              <ParentFilesPanel />
            </TabsContent>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-2">

                {/* Card 1 — Subscription Details */}
                {(() => {
                  const studentGroups = Object.entries(
                    (subscriptions || []).reduce((acc, item) => {
                      const name = [item.subscription.studentFirstName, item.subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
                      if (!acc[name]) acc[name] = [];
                      acc[name].push(item);
                      return acc;
                    }, {} as Record<string, NonNullable<typeof subscriptions>>)
                  );
                  const clampedTab = Math.min(activeStudentTab, Math.max(0, studentGroups.length - 1));
                  const activeGroup = studentGroups[clampedTab];
                  const firstItem = activeGroup?.[1]?.[0];
                  const totalCourses = activeGroup?.[1]?.length ?? 0;
                  const visibleTabs = studentGroups.slice(0, 3);
                  const hiddenCount = studentGroups.length - 3;
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-md flex flex-col gap-2 h-[220px]">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wider opacity-80">Subscriptions</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                          </div>
                          {studentGroups.length > 0 && (
                            <button onClick={() => setShowSubsModal(true)} className="text-xs font-medium opacity-90 hover:opacity-100 underline underline-offset-2">Show more</button>
                          )}
                        </div>
                      </div>
                      {studentGroups.length === 0 ? (
                        <p className="text-4xl font-bold">0</p>
                      ) : (
                        <>
                          <p className="text-4xl font-bold">{studentGroups.length}</p>
                          <p className="text-xs opacity-70 -mt-1">student{studentGroups.length !== 1 ? "s" : ""} enrolled</p>
                          {/* Student tabs — max 3 visible */}
                          <div className="flex gap-1.5 items-center flex-nowrap overflow-hidden">
                            {visibleTabs.map(([name, items], idx) => {
                              const grade = items[0]?.subscription.studentGrade;
                              return (
                                <button
                                  key={name}
                                  onClick={() => setActiveStudentTab(idx)}
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors border shrink-0 ${clampedTab === idx ? "bg-white text-blue-600 border-white" : "bg-white/20 text-white border-white/30 hover:bg-white/30"}`}
                                >
                                  {name.split(" ")[0]}{grade ? ` G${grade}` : ""}
                                </button>
                              );
                            })}
                            {hiddenCount > 0 && (
                              <button onClick={() => setShowSubsModal(true)} className="text-xs px-2 py-0.5 rounded-full bg-white/20 border border-white/30 font-medium shrink-0 hover:bg-white/30">
                                +{hiddenCount}
                              </button>
                            )}
                          </div>
                          {/* Active student: show first course only */}
                          {firstItem && (
                            <div className="rounded-xl bg-white/15 px-3 py-2 space-y-0.5 mt-auto">
                              <p className="text-sm font-semibold truncate">{firstItem.course?.title || "Course"}</p>
                              <p className="text-xs opacity-75">{firstItem.sessionStats?.completedCount ?? 0} done · {firstItem.sessionStats?.scheduledCount ?? 0} upcoming</p>
                              {totalCourses > 1 && <p className="text-[10px] opacity-60">+{totalCourses - 1} more course{totalCourses - 1 !== 1 ? "s" : ""}</p>}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Card 2 — Billing & Spend Analyzer */}
                {(() => {
                  const getSubAmount = (item: NonNullable<typeof subscriptions>[number]): number => {
                    if (item.nextBillingAmount != null) return Number(item.nextBillingAmount);
                    const s = item.subscription;
                    if (s.paymentPlan === "installment" && s.firstInstallmentAmount != null) return Number(s.firstInstallmentAmount);
                    const coursePrice = Number(item.course?.price ?? 0);
                    const promo = Number(s.promoDiscountAmount ?? 0);
                    const discount = Number(s.discountAmount ?? 0);
                    return Math.max(0, coursePrice - promo - discount);
                  };
                  const activeSubs = (subscriptions || []).filter(s => s.subscription.status === "active");
                  const totalSpend = activeSubs.reduce((sum, s) => sum + getSubAmount(s), 0);
                  const totalSavings = (subscriptions || []).reduce((sum, s) => sum + Number(s.subscription.promoDiscountAmount ?? 0) + Number(s.subscription.discountAmount ?? 0), 0);
                  const hasSiblingDiscount = (subscriptions || []).some(s => s.subscription.siblingDiscountApplied);
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-md flex flex-col gap-2 h-[220px]">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wider opacity-80">Billing & Spend</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <CreditCard className="w-4 h-4" />
                          </div>
                          <button onClick={() => setShowBillingModal(true)} className="text-xs font-medium opacity-90 hover:opacity-100 underline underline-offset-2">Show more</button>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">${totalSpend.toFixed(0)}</p>
                      <p className="text-xs opacity-70 -mt-2">across {activeSubs.length} active enrollment{activeSubs.length !== 1 ? "s" : ""}</p>
                      {totalSavings > 0 && (
                        <p className="text-xs opacity-90">Saved <span className="font-bold">${totalSavings.toFixed(2)}</span> via discounts</p>
                      )}
                      {hasSiblingDiscount && (
                        <span className="self-start text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">Sibling discount applied</span>
                      )}
                    </div>
                  );
                })()}

                {/* Card 3 — Learning Proficiency */}
                {(() => {
                  const { avgQuizScore, attendanceRate, avgRubricScore, proficiencyLabel, completedQuizzes } = analyticsStats;
                  const gradientClass = proficiencyLabel === "Above Average"
                    ? "from-teal-500 to-teal-600"
                    : proficiencyLabel === "On Track"
                    ? "from-violet-500 to-violet-600"
                    : "from-amber-400 to-amber-500";
                  return (
                    <div className={`rounded-2xl bg-gradient-to-br ${gradientClass} p-5 text-white shadow-md flex flex-col gap-2 h-[220px]`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wider opacity-80">Learning Proficiency</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Target className="w-4 h-4" />
                          </div>
                          <button onClick={() => setShowProficiencyModal(true)} className="text-xs font-medium opacity-90 hover:opacity-100 underline underline-offset-2">Show more</button>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">{avgQuizScore != null ? `${avgQuizScore}%` : "—"}</p>
                      <p className="text-xs opacity-70 -mt-2">avg quiz score · {completedQuizzes} taken</p>
                      <p className="text-xs opacity-90 font-medium">{proficiencyLabel}</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs opacity-80">
                          <span>Attendance</span><span className="font-semibold">{attendanceRate}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                          <div className="h-1.5 rounded-full bg-white/80" style={{ width: `${attendanceRate}%` }} />
                        </div>
                        {avgRubricScore != null && (
                          <>
                            <div className="flex items-center justify-between text-xs opacity-80">
                              <span>Teaching Quality</span><span className="font-semibold">{avgRubricScore}/4</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                              <div className="h-1.5 rounded-full bg-white/80" style={{ width: `${(avgRubricScore / 4) * 100}%` }} />
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Card 4 — Engagement Breakdown */}
                {(() => {
                  const quizzesCompleted = analyticsStats.completedQuizzes;
                  const sessionsAttended = analyticsStats.totalCompleted;
                  const recentThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
                  const hasRecentFeedback = (sessionHistory || []).some(s => s.feedbackFromTutor && new Date(s.scheduledAt).getTime() > recentThreshold);
                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-5 text-white shadow-md flex flex-col gap-2 h-[220px]">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wider opacity-80">Engagement</p>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                            <Activity className="w-4 h-4" />
                          </div>
                          <button onClick={() => setShowEngagementModal(true)} className="text-xs font-medium opacity-90 hover:opacity-100 underline underline-offset-2">Show more</button>
                        </div>
                      </div>
                      <p className="text-4xl font-bold">{sessionsAttended}</p>
                      <p className="text-xs opacity-70 -mt-2">sessions attended</p>
                      <div className="space-y-1.5 text-xs opacity-90">
                        <div className="flex items-center justify-between">
                          <span>Quizzes completed</span>
                          <span className="font-bold">{quizzesCompleted}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Messaging</span>
                          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${hasRecentFeedback ? "bg-white/25" : "bg-white/10 opacity-60"}`}>
                            {hasRecentFeedback ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                  { key: "rubricInstructionalQuality", label: "Learning Engagement" },
                  { key: "rubricStrategyInsight", label: "Strategy & Problem-Solving" },
                  { key: "rubricSynthesisBranding", label: "Session Value & Takeaways" },
                ] as const;
                const gradedRows = parentGrades.filter(g => g.rubricOverallScore != null);
                if (gradedRows.length === 0) return null;
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
                                <span className="text-xs text-muted-foreground w-40 shrink-0">{label}</span>
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
                                const score = Number(g.rubricOverallScore ?? 0);
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

      {/* Modal 1 — Subscription Details */}
      <Dialog open={showSubsModal} onOpenChange={setShowSubsModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
          <div className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" /> Subscription Details
            </DialogTitle>
            <DialogDescription className="mt-1">All enrollments across your students</DialogDescription>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-6">
            {(subscriptions || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No enrollments found.</p>
            ) : (
              Object.entries(
                (subscriptions || []).reduce((acc, item) => {
                  const name = [item.subscription.studentFirstName, item.subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
                  if (!acc[name]) acc[name] = [];
                  acc[name].push(item);
                  return acc;
                }, {} as Record<string, NonNullable<typeof subscriptions>>)
              ).map(([studentName, items]) => (
                <div key={studentName}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
                      {studentName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{studentName}</p>
                      {items[0]?.subscription.studentGrade && (
                        <p className="text-xs text-muted-foreground">Grade {items[0].subscription.studentGrade}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3 ml-10">
                    {items.map((item) => {
                      const s = item.subscription;
                      const statusColor = s.status === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : s.status === "paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
                      return (
                        <div key={s.id} className="rounded-xl border bg-card p-4 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{item.course?.title || "Course"}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{item.course?.subject || ""}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 capitalize ${statusColor}`}>{s.status}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            <div>
                              <p className="text-muted-foreground">Tutor</p>
                              <p className="font-medium">{item.tutor?.name ?? "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Payment Plan</p>
                              <p className="font-medium capitalize">{s.paymentPlan?.replace("_", " ") || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Sessions Done</p>
                              <p className="font-medium">{item.sessionStats?.completedCount ?? 0}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Upcoming</p>
                              <p className="font-medium">{item.sessionStats?.scheduledCount ?? 0}</p>
                            </div>
                            {item.nextBillingDate && (
                              <div>
                                <p className="text-muted-foreground">Next Billing</p>
                                <p className="font-medium">{new Date(item.nextBillingDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                              </div>
                            )}
                            {item.nextBillingAmount != null && (
                              <div>
                                <p className="text-muted-foreground">Billing Amount</p>
                                <p className="font-medium">${Number(item.nextBillingAmount).toFixed(2)}</p>
                              </div>
                            )}
                            {s.startDate && (
                              <div>
                                <p className="text-muted-foreground">Enrolled Since</p>
                                <p className="font-medium">{new Date(s.startDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                              </div>
                            )}
                            {s.paymentStatus && (
                              <div>
                                <p className="text-muted-foreground">Payment Status</p>
                                <p className="font-medium capitalize">{s.paymentStatus}</p>
                              </div>
                            )}
                          </div>
                          {(s.siblingDiscountApplied || s.loyaltyDiscountApplied || Number(s.promoDiscountAmount ?? 0) > 0 || Number(s.discountAmount ?? 0) > 0) && (
                            <div className="pt-2 border-t flex flex-wrap gap-1.5 items-center">
                              <span className="text-[10px] text-muted-foreground">Discounts:</span>
                              {s.siblingDiscountApplied && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Sibling</span>}
                              {s.loyaltyDiscountApplied && <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">Loyalty</span>}
                              {Number(s.promoDiscountAmount ?? 0) > 0 && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Promo −${Number(s.promoDiscountAmount).toFixed(2)}</span>}
                              {Number(s.discountAmount ?? 0) > 0 && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Discount −${Number(s.discountAmount).toFixed(2)}</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowSubsModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 2 — Billing & Spend */}
      {(() => {
        const getSubAmount = (item: NonNullable<typeof subscriptions>[number]): number => {
          if (item.nextBillingAmount != null) return Number(item.nextBillingAmount);
          const s = item.subscription;
          if (s.paymentPlan === "installment" && s.firstInstallmentAmount != null) return Number(s.firstInstallmentAmount);
          const coursePrice = Number(item.course?.price ?? 0);
          const promo = Number(s.promoDiscountAmount ?? 0);
          const discount = Number(s.discountAmount ?? 0);
          return Math.max(0, coursePrice - promo - discount);
        };
        const activeSubs = (subscriptions || []).filter(s => s.subscription.status === "active");
        const totalSpend = activeSubs.reduce((sum, s) => sum + getSubAmount(s), 0);
        const totalSavings = (subscriptions || []).reduce((sum, s) => sum + Number(s.subscription.promoDiscountAmount ?? 0) + Number(s.subscription.discountAmount ?? 0), 0);
        const planLabel = (plan: string) => plan === "monthly" ? "Monthly" : plan === "installment" ? "Installment" : "Full";
        return (
          <Dialog open={showBillingModal} onOpenChange={setShowBillingModal}>
            <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
              <div className="px-6 pt-6 pb-4 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> Billing &amp; Spend Analyzer
                </DialogTitle>
                <DialogDescription className="mt-1">Full breakdown of costs and savings across all enrollments</DialogDescription>
              </div>
              <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
                {/* Summary row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-4">
                    <p className="text-xs text-muted-foreground">Total Spend</p>
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">${totalSpend.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{activeSubs.length} active enrollment{activeSubs.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4">
                    <p className="text-xs text-muted-foreground">Total Saved</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">${totalSavings.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">via discounts &amp; promos</p>
                  </div>
                </div>
                {/* Per-enrollment breakdown */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Enrollment Breakdown</p>
                  <div className="space-y-2">
                    {activeSubs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active enrollments.</p>
                    ) : activeSubs.map((item) => {
                      const s = item.subscription;
                      const amount = getSubAmount(item);
                      const savings = Number(s.promoDiscountAmount ?? 0) + Number(s.discountAmount ?? 0);
                      return (
                        <div key={s.id} className="rounded-xl border bg-card p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-sm">{item.course?.title || "Course"}</p>
                              <p className="text-xs text-muted-foreground">{[s.studentFirstName, s.studentLastName].filter(Boolean).join(" ")} · {planLabel(s.paymentPlan)} plan</p>
                            </div>
                            <p className="font-bold text-base shrink-0">${amount.toFixed(2)}</p>
                          </div>
                          {item.nextBillingDate && (
                            <p className="text-xs text-muted-foreground">Next billing: {new Date(item.nextBillingDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                          )}
                          {savings > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                              {Number(s.promoDiscountAmount ?? 0) > 0 && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Promo −${Number(s.promoDiscountAmount).toFixed(2)}</span>}
                              {Number(s.discountAmount ?? 0) > 0 && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Discount −${Number(s.discountAmount).toFixed(2)}</span>}
                              {s.siblingDiscountApplied && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">Sibling discount</span>}
                              {s.loyaltyDiscountApplied && <span className="text-[10px] bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">Loyalty discount</span>}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter className="px-6 py-4 border-t shrink-0">
                <Button variant="outline" onClick={() => setShowBillingModal(false)}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Modal 3 — Learning Proficiency */}
      <Dialog open={showProficiencyModal} onOpenChange={setShowProficiencyModal}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
          <div className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" /> Learning Proficiency
            </DialogTitle>
            <DialogDescription className="mt-1">Detailed breakdown of quiz performance, attendance, and teaching quality</DialogDescription>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
            {/* Overall label */}
            {(() => {
              const { avgQuizScore, attendanceRate, avgRubricScore, proficiencyLabel, completedQuizzes, totalCompleted, noShowCount, studentBreakdown } = analyticsStats;
              const profColor = proficiencyLabel === "Above Average" ? "text-emerald-600 dark:text-emerald-400" : proficiencyLabel === "On Track" ? "text-blue-600 dark:text-blue-400" : "text-amber-500";
              const profBg = proficiencyLabel === "Above Average" ? "bg-emerald-50 dark:bg-emerald-950/40" : proficiencyLabel === "On Track" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-amber-50 dark:bg-amber-950/40";
              return (
                <>
                  <div className={`rounded-xl px-4 py-3 ${profBg}`}>
                    <p className={`text-base font-bold ${profColor}`}>{proficiencyLabel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Overall assessment based on quiz score &amp; attendance</p>
                  </div>
                  {/* Metrics */}
                  <div className="space-y-4">
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiz Performance</p>
                      <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold">{avgQuizScore != null ? `${avgQuizScore}%` : "—"}</p>
                        <p className="text-xs text-muted-foreground">{completedQuizzes} quiz{completedQuizzes !== 1 ? "zes" : ""} taken</p>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${avgQuizScore ?? 0}%` }} />
                      </div>
                      {/* Per-student quiz scores */}
                      {studentBreakdown.filter(s => s.quizScores.length > 0).length > 0 && (
                        <div className="pt-2 space-y-1.5">
                          {studentBreakdown.filter(s => s.quizScores.length > 0).map(({ name, quizScores }) => {
                            const avg = Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length);
                            return (
                              <div key={name} className="flex items-center gap-3 text-xs">
                                <span className="w-24 text-muted-foreground truncate">{name}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-1.5 rounded-full bg-violet-400" style={{ width: `${avg}%` }} />
                                </div>
                                <span className="w-8 text-right font-semibold">{avg}%</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance</p>
                      <div className="flex items-end justify-between">
                        <p className="text-3xl font-bold">{attendanceRate}%</p>
                        <p className="text-xs text-muted-foreground">{totalCompleted} completed · {noShowCount} no-show</p>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500`} style={{ width: `${attendanceRate}%` }} />
                      </div>
                    </div>
                    {avgRubricScore != null && (
                      <div className="rounded-xl border bg-card p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teaching Quality (Rubric)</p>
                        <div className="flex items-end justify-between">
                          <p className="text-3xl font-bold">{avgRubricScore}<span className="text-base font-normal text-muted-foreground">/4</span></p>
                          <p className="text-xs text-muted-foreground">{(parentGrades || []).filter(g => g.rubricOverallScore != null).length} session{(parentGrades || []).filter(g => g.rubricOverallScore != null).length !== 1 ? "s" : ""} graded</p>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-2 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${(avgRubricScore / 4) * 100}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowProficiencyModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal 4 — Engagement Breakdown */}
      <Dialog open={showEngagementModal} onOpenChange={setShowEngagementModal}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
          <div className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Engagement Breakdown
            </DialogTitle>
            <DialogDescription className="mt-1">Detailed view of platform activity across sessions, quizzes, and messaging</DialogDescription>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {(() => {
              const { totalCompleted, noShowCount, completedQuizzes, studentBreakdown, monthlyActivity } = analyticsStats;
              const recentThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
              const recentFeedbackSessions = (sessionHistory || []).filter(s => s.feedbackFromTutor && new Date(s.scheduledAt).getTime() > recentThreshold);
              const hasRecentFeedback = recentFeedbackSessions.length > 0;
              const totalScheduled = (upcomingSessions || []).length;
              return (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{totalCompleted}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Sessions attended</p>
                    </div>
                    <div className="rounded-xl bg-violet-50 dark:bg-violet-950/40 p-3 text-center">
                      <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{completedQuizzes}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Quizzes done</p>
                    </div>
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-3 text-center">
                      <p className="text-2xl font-bold text-red-500">{noShowCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">No-shows</p>
                    </div>
                  </div>
                  {/* Sessions detail */}
                  <div className="rounded-xl border bg-card p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session Activity</p>
                    <div className="divide-y">
                      <div className="flex justify-between text-sm py-2">
                        <span className="text-muted-foreground">Completed sessions</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{totalCompleted}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2">
                        <span className="text-muted-foreground">Upcoming scheduled</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-400">{totalScheduled}</span>
                      </div>
                      <div className="flex justify-between text-sm py-2">
                        <span className="text-muted-foreground">No-shows</span>
                        <span className={`font-semibold ${noShowCount > 0 ? "text-red-500" : "text-muted-foreground"}`}>{noShowCount}</span>
                      </div>
                    </div>
                  </div>
                  {/* Per-student engagement */}
                  {studentBreakdown.length > 0 && (
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per-Student</p>
                      {studentBreakdown.map(({ name, sessions, lastSession, quizScores }) => (
                        <div key={name} className="flex items-center justify-between gap-3 text-sm">
                          <div>
                            <p className="font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">{lastSession ? `Last session ${new Date(lastSession).toLocaleDateString()}` : "No sessions yet"}</p>
                          </div>
                          <div className="flex gap-3 text-right shrink-0">
                            <div>
                              <p className="font-semibold">{sessions}</p>
                              <p className="text-[10px] text-muted-foreground">sessions</p>
                            </div>
                            <div>
                              <p className="font-semibold">{quizScores.length}</p>
                              <p className="text-[10px] text-muted-foreground">quizzes</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Messaging */}
                  <div className="rounded-xl border bg-card p-4 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Messaging Activity</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Tutor feedback (last 30 days)</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${hasRecentFeedback ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {hasRecentFeedback ? `Active (${recentFeedbackSessions.length} message${recentFeedbackSessions.length !== 1 ? "s" : ""})` : "No recent activity"}
                      </span>
                    </div>
                  </div>
                  {/* Monthly activity mini-chart */}
                  {monthlyActivity.some(m => m.count > 0) && (
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Monthly Sessions</p>
                      {(() => {
                        const max = Math.max(...monthlyActivity.map(m => m.count), 1);
                        return monthlyActivity.map(({ label, count }) => (
                          <div key={label} className="flex items-center gap-3 text-xs">
                            <span className="w-20 text-muted-foreground shrink-0">{label}</span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                            <span className="w-4 text-right font-semibold">{count}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowEngagementModal(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Payment Modal */}
      {paymentModalSub && (
        <Dialog open={true} onOpenChange={() => setPaymentModalSub(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Your Payment</DialogTitle>
              <DialogDescription>
                Choose how you'd like to pay for <strong>{paymentModalSub.course.title}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              {/* Test Prep: Full OR Installments */}
              {paymentModalSub.course.courseType === "test_prep" && (() => {
                const price = parseFloat(paymentModalSub.course.price || "0");
                const siblingPct = paymentModalSub.subscription.siblingDiscountApplied ? 5 : 0;
                const promoAmt = parseFloat(paymentModalSub.subscription.promoDiscountAmount ?? "0");
                // Loyalty discount always applies when paying in full (even if original plan was installment)
                const loyaltyPct = 5;
                const fullTotalPct = Math.min(100, siblingPct + loyaltyPct);
                const discountedTotal = Math.max(0, price * (1 - fullTotalPct / 100) - promoAmt);
                // Installment price: no loyalty discount, only sibling + promo
                const installmentBase = Math.max(0, price * (1 - siblingPct / 100) - promoAmt);
                const installmentAmt = installmentBase / 3;
                return (
                  <>
                    <button
                      className="w-full rounded-lg border-2 border-primary bg-primary/5 p-4 text-left hover:bg-primary/10 transition-colors disabled:opacity-60"
                      disabled={retryLoadingId === paymentModalSub.subscription.id}
                      onClick={async () => {
                        try {
                          setRetryLoadingId(paymentModalSub.subscription.id);
                          const result = await retryCheckoutMutation.mutateAsync({
                            subscriptionId: paymentModalSub.subscription.id,
                            origin: window.location.origin,
                          });
                          if (result?.checkoutUrl) window.open(result.checkoutUrl, "_blank");
                          else toast.error("Could not create payment session.");
                          setPaymentModalSub(null);
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to initiate payment");
                        } finally {
                          setRetryLoadingId(null);
                        }
                      }}
                    >
                      <div className="font-semibold text-sm">Pay in Full</div>
                      <div className="text-primary font-bold text-lg">{formatPrice(discountedTotal)}
                        {price > discountedTotal && <span className="ml-2 text-sm line-through text-muted-foreground">{formatPrice(price)}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[loyaltyPct > 0 && `${loyaltyPct}% loyalty`, siblingPct > 0 && `${siblingPct}% sibling`, promoAmt > 0 && `$${promoAmt} promo`].filter(Boolean).join(" + ") || "One-time payment"}
                      </div>
                    </button>

                    <button
                      className="w-full rounded-lg border-2 border-border p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-60"
                      disabled={retryInstallLoadingId === paymentModalSub.subscription.id}
                      onClick={async () => {
                        try {
                          setRetryInstallLoadingId(paymentModalSub.subscription.id);
                          const result = await retryInstallmentsMutation.mutateAsync({
                            subscriptionId: paymentModalSub.subscription.id,
                            origin: window.location.origin,
                          });
                          if (result?.setupUrl) window.open(result.setupUrl, "_blank");
                          else toast.error("Could not create installment session.");
                          setPaymentModalSub(null);
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to initiate installment payment");
                        } finally {
                          setRetryInstallLoadingId(null);
                        }
                      }}
                    >
                      <div className="font-semibold text-sm">Pay in 3 Installments</div>
                      <div className="font-bold text-lg">{formatPrice(installmentAmt)}<span className="text-sm font-normal text-muted-foreground">/month × 3</span></div>
                      <div className="text-xs text-muted-foreground">
                        {[siblingPct > 0 && `${siblingPct}% sibling`, promoAmt > 0 && `$${promoAmt} promo`].filter(Boolean).join(" + ") || "Spread the cost over 3 months"}
                      </div>
                    </button>
                  </>
                );
              })()}

              {/* Tutor / Homework: Monthly usage billing + Pay in Full */}
              {(paymentModalSub.course.courseType === "tutor" || paymentModalSub.course.courseType === "homework") && (() => {
                const price = parseFloat(paymentModalSub.course.price || "0");
                const siblingPct = paymentModalSub.subscription.siblingDiscountApplied ? 5 : 0;
                const loyaltyPct = 5; // loyalty always applies when paying in full
                const totalPct = Math.min(100, siblingPct + loyaltyPct);
                const promoAmt = parseFloat(paymentModalSub.subscription.promoDiscountAmount ?? "0");
                const discountedTotal = Math.max(0, price * (1 - totalPct / 100) - promoAmt);
                return (
                  <>
                    <button
                      className="w-full rounded-lg border-2 border-primary bg-primary/5 p-4 text-left hover:bg-primary/10 transition-colors disabled:opacity-60"
                      disabled={setupLoadingId === paymentModalSub.subscription.id}
                      onClick={async () => {
                        try {
                          setSetupLoadingId(paymentModalSub.subscription.id);
                          const result = await setupBillingMutation.mutateAsync({
                            subscriptionId: paymentModalSub.subscription.id,
                            origin: window.location.origin,
                          });
                          if (result?.setupUrl) window.open(result.setupUrl, "_blank");
                          else toast.error("Could not create billing setup.");
                          setPaymentModalSub(null);
                        } catch {
                          toast.error("Failed to set up billing");
                        } finally {
                          setSetupLoadingId(null);
                        }
                      }}
                    >
                      <div className="font-semibold text-sm">Set Up Monthly Billing</div>
                      {(siblingPct > 0 || promoAmt > 0) && (
                        <div className="text-xs text-amber-700 mt-1">
                          {[siblingPct > 0 && `${siblingPct}% sibling`, promoAmt > 0 && `$${promoAmt} promo`].filter(Boolean).join(" + ")} applied to monthly charges
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">Save your card — billed monthly based on completed sessions</div>
                    </button>

                    <button
                      className="w-full rounded-lg border-2 border-border p-4 text-left hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-60"
                      disabled={retryLoadingId === paymentModalSub.subscription.id}
                      onClick={async () => {
                        try {
                          setRetryLoadingId(paymentModalSub.subscription.id);
                          const result = await retryCheckoutMutation.mutateAsync({
                            subscriptionId: paymentModalSub.subscription.id,
                            origin: window.location.origin,
                          });
                          if (result?.checkoutUrl) window.open(result.checkoutUrl, "_blank");
                          else toast.error("Could not create payment session.");
                          setPaymentModalSub(null);
                        } catch (e: any) {
                          toast.error(e?.message || "Failed to initiate payment");
                        } finally {
                          setRetryLoadingId(null);
                        }
                      }}
                    >
                      <div className="font-semibold text-sm">Pay in Full</div>
                      <div className="font-bold text-lg">{formatPrice(discountedTotal)}
                        {price > discountedTotal && <span className="ml-2 text-sm line-through text-muted-foreground font-normal">{formatPrice(price)}</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[loyaltyPct > 0 && `${loyaltyPct}% loyalty`, siblingPct > 0 && `${siblingPct}% sibling`, promoAmt > 0 && `$${promoAmt} promo`].filter(Boolean).join(" + ") || "One-time payment"}
                      </div>
                    </button>
                  </>
                );
              })()}

              {/* Academic / Other: Monthly subscription */}
              {paymentModalSub.course.courseType !== "test_prep" &&
               paymentModalSub.course.courseType !== "tutor" &&
               paymentModalSub.course.courseType !== "homework" && (
                <button
                  className="w-full rounded-lg border-2 border-primary bg-primary/5 p-4 text-left hover:bg-primary/10 transition-colors disabled:opacity-60"
                  disabled={setupLoadingId === paymentModalSub.subscription.id}
                  onClick={async () => {
                    try {
                      setSetupLoadingId(paymentModalSub.subscription.id);
                      const result = await setupBillingMutation.mutateAsync({
                        subscriptionId: paymentModalSub.subscription.id,
                        origin: window.location.origin,
                      });
                      if (result?.setupUrl) window.open(result.setupUrl, "_blank");
                      else toast.error("Could not create billing setup.");
                      setPaymentModalSub(null);
                    } catch {
                      toast.error("Failed to set up billing");
                    } finally {
                      setSetupLoadingId(null);
                    }
                  }}
                >
                  <div className="font-semibold text-sm">Set Up Monthly Billing</div>
                  <div className="text-xs text-muted-foreground mt-1">Save your card — charged monthly on your billing date</div>
                </button>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentModalSub(null)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

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
