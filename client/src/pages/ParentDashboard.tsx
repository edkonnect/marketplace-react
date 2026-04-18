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
import { BookOpen, Calendar, MessageSquare, CreditCard, Clock, Users, Video, FileText, HelpCircle, CheckCircle, TrendingUp, BarChart2, LogIn, Sparkles, Search, Target, Activity, Download, ChevronLeft, ChevronRight } from "lucide-react";
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
import { buildParentAnalyticsViewModel } from "@/lib/parentAnalytics";
import { statusLabel, statusToPercentScore } from "@/lib/progressStatus";

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
    toast.info("New tutor notes available in Notes");
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
  const inactiveSubscriptions = subscriptions?.filter(s => s.subscription.status !== "active") || [];
  const completedSessions = sessionHistory?.filter(s => s.status === "completed") || [];

  const [selectedHistoryStudent, setSelectedHistoryStudent] = useState<string>("all");
  const [selectedHistoryTime, setSelectedHistoryTime] = useState<string>("all");
  const [selectedHistoryCourse, setSelectedHistoryCourse] = useState<string>("all");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 8;

  const [selectedSessionStudent, setSelectedSessionStudent] = useState<string>("all");
  const [selectedSessionTime, setSelectedSessionTime] = useState<string>("all");
  const [selectedSessionCourse, setSelectedSessionCourse] = useState<string>("all");
  const [subscriptionSearchQuery, setSubscriptionSearchQuery] = useState("");
  const [courseStatusView, setCourseStatusView] = useState<"active" | "inactive" | "all">("active");
  const [activeStudentTab, setActiveStudentTab] = useState(0);
  const [showSubsModal, setShowSubsModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showProficiencyModal, setShowProficiencyModal] = useState(false);
  const [proficiencyStudentTab, setProficiencyStudentTab] = useState(0);
  const [showEngagementModal, setShowEngagementModal] = useState(false);
  const [selectedAnalyticsMonth, setSelectedAnalyticsMonth] = useState<string>("all");
  const [analyticsPerspective, setAnalyticsPerspective] = useState<"family" | "individual">("family");
  const [selectedAnalyticsStudentKey, setSelectedAnalyticsStudentKey] = useState<string | null>(null);

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

  // Month options derived from session history, filtered by selected student
  const historyMonthOptions = useMemo(() => {
    const monthSet = new Set<string>();
    (sessionHistory || [])
      .filter((s) => {
        if (selectedHistoryStudent === "all") return true;
        const name = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim();
        return name === selectedHistoryStudent;
      })
      .forEach((s) => {
        const d = new Date(s.scheduledAt);
        if (!isNaN(d.getTime())) {
          monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }
      });
    const options = Array.from(monthSet)
      .sort((a, b) => b.localeCompare(a))
      .map((key) => {
        const [y, m] = key.split("-").map(Number);
        const d = new Date(y, m - 1, 1);
        return { value: key, label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
      });
    return [{ value: "all", label: "All time" }, ...options];
  }, [sessionHistory, selectedHistoryStudent]);

  // Course options derived from session history, filtered by selected student
  const historyCourseOptions = useMemo(() => {
    const set = new Set<string>();
    (sessionHistory || [])
      .filter((s) => {
        if (selectedHistoryStudent === "all") return true;
        const name = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim();
        return name === selectedHistoryStudent;
      })
      .forEach((s) => {
        if (s.courseTitle) set.add(s.courseTitle);
      });
    return Array.from(set);
  }, [sessionHistory, selectedHistoryStudent]);

  // Filtered history sessions
  const filteredHistorySessions = useMemo(() => {
    if (!sessionHistory) return [];

    return sessionHistory
      .filter((s) => s.status === "scheduled" || s.status === "completed" || s.status === "no_show")
      .filter((session) => {
        const studentName = [session.studentFirstName, session.studentLastName].filter(Boolean).join(" ").trim();
        const courseName = session.courseTitle || "";

        const matchesStudent = selectedHistoryStudent === "all" || studentName === selectedHistoryStudent;
        const matchesCourse = selectedHistoryCourse === "all" || courseName === selectedHistoryCourse;

        let matchesTime = true;
        if (selectedHistoryTime !== "all") {
          const [y, m] = selectedHistoryTime.split("-").map(Number);
          const sessionDate = new Date(session.scheduledAt);
          matchesTime = sessionDate.getFullYear() === y && sessionDate.getMonth() + 1 === m;
        }

        return matchesStudent && matchesCourse && matchesTime;
      })
      .sort((a, b) => b.scheduledAt - a.scheduledAt);
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
    (upcomingSessions || [])
      .filter((s) => {
        if (selectedSessionStudent === "all") return true;
        const name = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim();
        return name === selectedSessionStudent;
      })
      .forEach((s) => {
        if (s.courseTitle) set.add(s.courseTitle);
      });
    return Array.from(set);
  }, [upcomingSessions, selectedSessionStudent]);

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
        gradeLabel: group.grades.size === 1 ? `Grade ${Array.from(group.grades)[0]}` : null,
        items: [...group.items].sort((a, b) => {
          const priorityDiff = getStatusPriority(a.subscription) - getStatusPriority(b.subscription);
          if (priorityDiff !== 0) return priorityDiff;
          return (a.course?.title ?? "").localeCompare(b.course?.title ?? "");
        }),
      }));
  }, [activeSubscriptions]);

  const groupedInactiveSubscriptionsForTab = useMemo(() => {
    const groups = new Map<string, {
      studentName: string;
      grades: Set<string>;
      items: any[];
      activeCount: number;
      actionRequiredCount: number;
    }>();

    inactiveSubscriptions.forEach((entry: any) => {
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
      existing.items.push(entry);
      groups.set(studentName, existing);
    });

    return Array.from(groups.values())
      .sort((a, b) => a.studentName.localeCompare(b.studentName))
      .map((group) => ({
        ...group,
        gradeLabel: group.grades.size === 1 ? `Grade ${Array.from(group.grades)[0]}` : null,
        items: [...group.items].sort((a, b) =>
          (a.course?.title ?? "").localeCompare(b.course?.title ?? "")
        ),
      }));
  }, [inactiveSubscriptions]);

  const groupedAllSubscriptionsForTab = useMemo(() => {
    const allSubs = subscriptions || [];
    const groups = new Map<string, {
      studentName: string;
      grades: Set<string>;
      items: any[];
      activeCount: number;
      actionRequiredCount: number;
    }>();

    allSubs.forEach((entry: any) => {
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
        gradeLabel: group.grades.size === 1 ? `Grade ${Array.from(group.grades)[0]}` : null,
        items: [...group.items].sort((a, b) => {
          const priorityDiff = getStatusPriority(a.subscription) - getStatusPriority(b.subscription);
          if (priorityDiff !== 0) return priorityDiff;
          return (a.course?.title ?? "").localeCompare(b.course?.title ?? "");
        }),
      }));
  }, [subscriptions]);

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

  const filteredGroupedAllSubscriptionsForTab = useMemo(() => {
    const query = subscriptionSearchQuery.trim().toLowerCase();
    if (!query) return groupedAllSubscriptionsForTab;

    return groupedAllSubscriptionsForTab.flatMap((group) => {
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
  }, [groupedAllSubscriptionsForTab, subscriptionSearchQuery]);

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

  // Analytics month options (derived from session history + current month)
  const analyticsMonthOptions = useMemo(() => {
    const monthSet = new Set<string>();
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    monthSet.add(thisMonth);
    const addDate = (val: string | number | Date | null | undefined) => {
      if (!val) return;
      const d = new Date(val);
      if (isNaN(d.getTime())) return;
      monthSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };
    (sessionHistory || []).forEach(s => addDate(s.scheduledAt));
    (subscriptions || []).forEach(s => {
      addDate(s.subscription.startDate);
      addDate(s.subscription.createdAt);
    });
    (parentQuizzes || []).forEach(q => addDate(q.completedAt));
    (parentGrades || []).forEach(g => addDate(g.rubricGradedAt));
    const sorted = Array.from(monthSet).sort((a, b) => b.localeCompare(a));
    const options = sorted.map(key => {
      const [y, m] = key.split("-");
      const d = new Date(Number(y), Number(m) - 1, 1);
      return { value: key, label: d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) };
    });
    return [{ value: "all", label: "View all" }, ...options];
  }, [sessionHistory, subscriptions, parentQuizzes, parentGrades]);

  const analyticsViewModel = useMemo(() => buildParentAnalyticsViewModel({
    subscriptions: (subscriptions || []).filter((item: any) => !item?.subscription?.isMigrated),
    analyticsSessions: (sessionHistory || []).filter((s: any) => !s?.isMigrated),
    upcomingSessions: upcomingSessions || [],
    quizzes: parentQuizzes || [],
    grades: parentGrades || [],
    selectedMonth: selectedAnalyticsMonth,
    perspective: analyticsPerspective,
    selectedStudentKey: selectedAnalyticsStudentKey,
  }), [subscriptions, sessionHistory, upcomingSessions, parentQuizzes, parentGrades, selectedAnalyticsMonth, analyticsPerspective, selectedAnalyticsStudentKey]);

  const analyticsFilteredSubscriptions = analyticsViewModel.filteredSubscriptions;
  const analyticsFilteredSessions = analyticsViewModel.filteredSessions;
  const analyticsFilteredUpcomingSessions = analyticsViewModel.filteredUpcomingSessions;
  const analyticsFilteredQuizzes = analyticsViewModel.filteredQuizzes;
  const analyticsFilteredGrades = analyticsViewModel.filteredGrades;

  const analyticsStats = useMemo(() => ({
    totalCompleted: analyticsViewModel.totalCompleted,
    noShowCount: analyticsViewModel.noShowCount,
    cancelledCount: analyticsViewModel.cancelledCount,
    cancellationRate: analyticsViewModel.cancellationRate,
    attendanceRate: analyticsViewModel.attendanceRate,
    totalHours: analyticsViewModel.totalHours,
    studentBreakdown: analyticsViewModel.studentBreakdown,
    monthlyActivity: analyticsViewModel.monthlyActivity,
    completedQuizzes: analyticsViewModel.completedQuizzes,
    avgQuizScore: analyticsViewModel.avgQuizScore,
    avgRubricScore: analyticsViewModel.avgRubricScore,
    proficiencyLabel: analyticsViewModel.proficiency.label,
    proficiencySource: analyticsViewModel.proficiency.source,
    proficiencyScore: analyticsViewModel.proficiency.score,
  }), [analyticsViewModel]);

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
                <TabsTrigger className="whitespace-nowrap" value="sessions">Sessions</TabsTrigger>
                <TabsTrigger
                  className={`whitespace-nowrap ${historyPulse ? "ring-2 ring-primary/60 animate-pulse" : ""}`}
                  value="history"
                >
                  Notes
                </TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="bookings">My Bookings</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="schedule">Schedule</TabsTrigger>
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
                  <Select value={courseStatusView} onValueChange={(v) => setCourseStatusView(v as "active" | "inactive" | "all")}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active Courses ({activeSubscriptions.length})</SelectItem>
                      <SelectItem value="inactive">Inactive / Completed ({inactiveSubscriptions.length})</SelectItem>
                      <SelectItem value="all">All Courses ({(subscriptions || []).length})</SelectItem>
                    </SelectContent>
                  </Select>

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
              ) : (
                <div className="space-y-4">

                  {courseStatusView === "active" ? (
                  <>
                  {activeSubscriptions.length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <h3 className="text-base font-semibold">No Active Courses</h3>
                        <p className="mt-1 text-sm text-muted-foreground mb-4">Start your learning journey by finding a tutor</p>
                        <Button asChild size="sm"><Link href="/tutors">Browse Tutors</Link></Button>
                      </CardContent>
                    </Card>
                  ) : filteredGroupedSubscriptionsForTab.length === 0 ? (
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
                  </>
                  ) : courseStatusView === "all" ? (
                  <>
                  {(subscriptions || []).length === 0 ? (
                    <Card>
                      <CardContent className="py-10 text-center">
                        <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <h3 className="text-base font-semibold">No Courses Yet</h3>
                        <p className="mt-1 text-sm text-muted-foreground mb-4">Start your learning journey by finding a tutor</p>
                        <Button asChild size="sm"><Link href="/tutors">Browse Tutors</Link></Button>
                      </CardContent>
                    </Card>
                  ) : filteredGroupedAllSubscriptionsForTab.length === 0 ? (
                    <Card>
                      <CardContent className="py-14 text-center">
                        <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                        <h3 className="text-lg font-semibold">No matching subscriptions</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          No students or courses matched "{subscriptionSearchQuery.trim()}".
                        </p>
                      </CardContent>
                    </Card>
                  ) : filteredGroupedAllSubscriptionsForTab.map(({ studentName, gradeLabel, items, activeCount, actionRequiredCount }) => {
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
                            <span className="self-center text-xs text-muted-foreground">Scroll to view all</span>
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
                      <div className={cn(
                        useHorizontalScroll
                          ? "grid grid-flow-col auto-cols-[85%] gap-3 overflow-x-auto pb-2 pr-1 snap-x snap-mandatory [scrollbar-width:thin] sm:auto-cols-[calc((100%-0.75rem)/2)]"
                          : "grid gap-3 lg:grid-cols-2",
                      )}>
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
                                subscription.status !== "active" && "opacity-80",
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
                                <Button asChild variant="outline" size="sm" className="w-full">
                                  <Link href={`/course/${course.id}`}>View Course</Link>
                                </Button>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </section>
                    );
                  })}
                  </>
                  ) : (
                  <div className="space-y-6">
                        {groupedInactiveSubscriptionsForTab.map(({ studentName, gradeLabel, items }) => {
                          const useHorizontalScroll = items.length > 2;
                          return (
                            <section key={studentName} className="space-y-3">
                              <div className="flex flex-col gap-2 border-b border-border/70 pb-3 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                  <h3 className="text-lg font-semibold tracking-tight">{studentName}</h3>
                                  {gradeLabel && <p className="mt-0.5 text-sm text-muted-foreground">{gradeLabel}</p>}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {items.length} {items.length === 1 ? "course" : "courses"}
                                </p>
                              </div>
                              <div className={cn(
                                "grid gap-4",
                                useHorizontalScroll
                                  ? "flex snap-x snap-mandatory overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                                  : items.length === 1 ? "grid-cols-1 max-w-sm" : "grid-cols-1 sm:grid-cols-2"
                              )}>
                                {items.map(({ subscription, course, tutor }: any) => {
                                  const primaryStatus = getPrimaryStatusBadge(subscription);
                                  return (
                                    <Card
                                      key={subscription.id}
                                      className={cn(
                                        "flex h-full flex-col border-border/60 shadow-sm opacity-80",
                                        useHorizontalScroll && "snap-start flex-none w-[300px] sm:w-[340px]"
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
                                          <Badge variant="secondary" className={`text-[11px] ${primaryStatus.className}`}>
                                            {primaryStatus.label}
                                          </Badge>
                                        </div>
                                      </CardHeader>
                                      <CardContent className="flex flex-col gap-3 p-5 pt-0">
                                        <div className="flex gap-2">
                                          <Button asChild variant="outline" size="sm" className="flex-1">
                                            <Link href={`/course/${course.id}`}>View Course</Link>
                                          </Button>
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
                  )}
                </div>
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
                  <Select value={selectedSessionStudent} onValueChange={(v) => { setSelectedSessionStudent(v); setSelectedSessionCourse("all"); }}>
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
                  <Select value={selectedHistoryStudent} onValueChange={(v) => { setSelectedHistoryStudent(v); setSelectedHistoryTime("all"); setSelectedHistoryCourse("all"); setHistoryPage(1); }}>
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
                  <Select value={selectedHistoryTime} onValueChange={(v) => { setSelectedHistoryTime(v); setHistoryPage(1); }}>
                    <SelectTrigger id="history-time">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      {historyMonthOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="history-course">Course</Label>
                  <Select value={selectedHistoryCourse} onValueChange={(v) => { setSelectedHistoryCourse(v); setHistoryPage(1); }}>
                    <SelectTrigger id="history-course">
                      <SelectValue placeholder="All courses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All courses</SelectItem>
                      {historyCourseOptions.map((subject) => (
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
                    .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
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
                  {/* Pagination */}
                  {filteredHistorySessions.length > HISTORY_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-sm text-muted-foreground">
                        Showing {(historyPage - 1) * HISTORY_PAGE_SIZE + 1}–{Math.min(historyPage * HISTORY_PAGE_SIZE, filteredHistorySessions.length)} of {filteredHistorySessions.length} sessions
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          disabled={historyPage === 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </Button>
                        <span className="text-sm text-muted-foreground">
                          Page {historyPage} of {Math.ceil(filteredHistorySessions.length / HISTORY_PAGE_SIZE)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setHistoryPage((p) => Math.min(Math.ceil(filteredHistorySessions.length / HISTORY_PAGE_SIZE), p + 1))}
                          disabled={historyPage === Math.ceil(filteredHistorySessions.length / HISTORY_PAGE_SIZE)}
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
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
	                <div className="flex flex-col items-start sm:items-end gap-1.5 self-start sm:self-auto">
		                  <div className="flex flex-wrap items-end gap-2">
		                    <div className="flex flex-col gap-1">
		                      <Label className="text-xs text-muted-foreground">Time Period</Label>
		                      <Select value={selectedAnalyticsMonth} onValueChange={(v) => { setSelectedAnalyticsMonth(v); setActiveStudentTab(0); setProficiencyStudentTab(0); }}>
		                        <SelectTrigger className="h-8 text-xs w-36">
		                          <SelectValue />
		                        </SelectTrigger>
		                        <SelectContent>
		                          {analyticsMonthOptions.map(opt => (
		                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
		                          ))}
		                        </SelectContent>
		                      </Select>
		                    </div>
		                    <Select
		                      value={analyticsPerspective}
		                      onValueChange={(v: "family" | "individual") => {
		                        setAnalyticsPerspective(v);
	                        setActiveStudentTab(0);
	                        setProficiencyStudentTab(0);
		                        if (v === "family") setSelectedAnalyticsStudentKey(null);
		                      }}
		                    >
		                      <SelectTrigger className="h-8 text-xs w-36">
		                        <SelectValue />
		                      </SelectTrigger>
		                      <SelectContent>
		                        <SelectItem value="family">Grouped View</SelectItem>
		                        <SelectItem value="individual">Individual View</SelectItem>
		                      </SelectContent>
		                    </Select>
		                    {analyticsPerspective === "individual" && analyticsViewModel.studentOptions.length > 0 && (
		                      <Select
		                        value={analyticsViewModel.activeStudentKey ?? analyticsViewModel.studentOptions[0]?.key ?? ""}
	                        onValueChange={(v) => {
	                          setSelectedAnalyticsStudentKey(v);
	                          setActiveStudentTab(0);
	                          setProficiencyStudentTab(0);
	                        }}
	                      >
		                        <SelectTrigger className="h-8 text-xs w-44">
		                          <SelectValue placeholder="Select student" />
		                        </SelectTrigger>
	                        <SelectContent>
	                          {analyticsViewModel.studentOptions.map((student) => (
	                            <SelectItem key={student.key} value={student.key}>{student.label}</SelectItem>
	                          ))}
	                        </SelectContent>
	                      </Select>
	                    )}
	                  </div>
	                  {(previousLastSignedIn || user?.lastSignedIn) && (
	                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
	                      <LogIn className="w-3.5 h-3.5 shrink-0" />
	                      <span>Last login: <span className="font-medium text-foreground">{new Date(previousLastSignedIn ?? user!.lastSignedIn!).toLocaleString()}</span></span>
	                    </div>
                  )}
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-2">

                {/* Card 1 — Subscription Details */}
                {(() => {
                  const visibleSubscriptions = analyticsFilteredSubscriptions;

                  const groupedSubscriptions = visibleSubscriptions.reduce((acc, item) => {
                    const name = [item.subscription.studentFirstName, item.subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student";
                    if (!acc[name]) acc[name] = [];
                    acc[name].push(item);
                    return acc;
                  }, {} as Record<string, NonNullable<typeof subscriptions>>);
                  const studentGroups = Object.entries(groupedSubscriptions) as Array<[string, NonNullable<typeof subscriptions>]>;
                  const clampedTab = Math.min(activeStudentTab, Math.max(0, studentGroups.length - 1));
                  const activeGroup = studentGroups[clampedTab];
                  const activeStudentName = activeGroup?.[0] ?? "";
                  const firstItem = activeGroup?.[1]?.[0];
                  const totalCourses = activeGroup?.[1]?.length ?? 0;

                  const completedForStudent = analyticsFilteredSessions.filter(s =>
                    ([s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim() || "Student") === activeStudentName && s.status === "completed"
                  ).length;
	                  const scheduledForStudent = analyticsFilteredUpcomingSessions.filter(s =>
	                    ([s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim() || "Student") === activeStudentName && s.status === "scheduled"
	                  ).length;

                  return (
                    <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-md flex flex-col gap-2 h-[220px]">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wider opacity-80">Students</p>
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
                        <>
                          <p className="text-4xl font-bold">0</p>
                          <p className="text-xs opacity-70 -mt-1">no active students this month</p>
                        </>
                      ) : (
                        <>
                          <p className="text-4xl font-bold">{studentGroups.length}</p>
                          <p className="text-xs opacity-70 -mt-1">active student{studentGroups.length !== 1 ? "s" : ""}</p>
                          {/* Segmented student selector — only shown for multiple students */}
                          {studentGroups.length > 1 ? (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setActiveStudentTab((clampedTab - 1 + studentGroups.length) % studentGroups.length)}
                                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center shrink-0 transition-colors"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                              </button>
                              <div className="flex-1 text-center">
                                <p className="text-xs font-semibold truncate">
                                  {activeStudentName}
                                  {(() => {
                                    const grade = activeGroup?.[1]?.[0]?.subscription.studentGrade;
                                    return grade && grade !== "Not specified" && String(grade).length <= 4 ? ` · G${grade}` : "";
                                  })()}
                                  {" "}<span className="opacity-50 font-normal">({clampedTab + 1}/{studentGroups.length})</span>
                                </p>
                              </div>
                              <button
                                onClick={() => setActiveStudentTab((clampedTab + 1) % studentGroups.length)}
                                className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/35 flex items-center justify-center shrink-0 transition-colors"
                              >
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            // Single student — show name clearly
                            <p className="text-xs font-semibold opacity-90 truncate">
                              {activeStudentName}
                              {(() => {
                                const grade = firstItem?.subscription.studentGrade;
                                return grade && grade !== "Not specified" && String(grade).length <= 4 ? ` · G${grade}` : "";
                              })()}
                            </p>
                          )}
                          {/* Active student course box */}
                          {firstItem && (
                            <div className="rounded-xl bg-white/15 px-3 py-2 space-y-0.5 mt-auto">
                              <p className="text-sm font-semibold truncate">{firstItem.course?.title || "Course"}</p>
                              <p className="text-xs opacity-75">{completedForStudent} done · {scheduledForStudent} upcoming</p>
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
                  const activeSubs = analyticsFilteredSubscriptions.filter(s => s.subscription.status === "active");
                  const totalSpend = activeSubs.reduce((sum, s) => sum + getSubAmount(s), 0);
                  const totalSavings = analyticsFilteredSubscriptions.reduce((sum, s) => sum + Number(s.subscription.promoDiscountAmount ?? 0) + Number(s.subscription.discountAmount ?? 0), 0);
                  const hasSiblingDiscount = analyticsFilteredSubscriptions.some(s => s.subscription.siblingDiscountApplied);
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
                      <p className="text-4xl font-bold">{formatPrice(totalSpend)}</p>
                      <p className="text-xs opacity-70 -mt-2">across {activeSubs.length} active enrollment{activeSubs.length !== 1 ? "s" : ""}</p>
                      {totalSavings > 0 && (
                        <p className="text-xs opacity-90">Saved <span className="font-bold">{formatPrice(totalSavings)}</span> via discounts</p>
                      )}
                      {hasSiblingDiscount && (
                        <span className="self-start text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">Sibling discount applied</span>
                      )}
                    </div>
                  );
                })()}

	                {/* Card 3 — Learning Proficiency */}
	                {(() => {
	                  const { avgQuizScore, attendanceRate, avgRubricScore, proficiencyLabel, completedQuizzes, proficiencySource, proficiencyScore } = analyticsStats;
	                  const gradientClass = proficiencyScore == null
	                    ? "from-slate-500 to-slate-600"
	                    : proficiencyScore >= 84
	                    ? "from-teal-500 to-teal-600"
	                    : proficiencyScore >= 45
	                    ? "from-violet-500 to-violet-600"
	                    : "from-amber-400 to-amber-500";
	                  const ratedCount = analyticsFilteredSubscriptions.filter(s => s.subscription.progressStatus === "low" || s.subscription.progressStatus === "medium" || s.subscription.progressStatus === "high").length;
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
	                      <p className="text-4xl font-bold">{proficiencyScore != null ? `${proficiencyScore}%` : "—"}</p>
	                      <p className="text-xs opacity-70 -mt-2">
	                        {proficiencySource === "tutor_status"
	                          ? `tutor rating · ${ratedCount} rated`
	                          : `avg quiz score · ${completedQuizzes} taken`}
	                      </p>
	                      {proficiencyScore != null && <p className="text-xs opacity-90 font-medium">{proficiencyLabel}</p>}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs opacity-80">
                          <span>Attendance</span><span className="font-semibold">{attendanceRate}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/30 overflow-hidden">
                          <div className="h-1.5 rounded-full bg-white/80" style={{ width: `${attendanceRate}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Card 4 — Engagement Breakdown */}
                {(() => {
                  const quizzesCompleted = analyticsStats.completedQuizzes;
                  const sessionsAttended = analyticsStats.totalCompleted;
                  const recentThreshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
                  const hasRecentFeedback = analyticsFilteredSessions.some(s => s.feedbackFromTutor && new Date(s.scheduledAt).getTime() > recentThreshold);
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
	                        {analyticsFilteredUpcomingSessions.filter(s => s.status === "scheduled").length}
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
                        Cancelled Sessions
                      </div>
                      <span className="font-semibold text-violet-600 dark:text-violet-400">
                        {analyticsStats.cancelledCount}
                        {analyticsStats.cancellationRate != null ? ` (${analyticsStats.cancellationRate}%)` : ""}
                      </span>
                    </div>
                  </div>
                </div>
              </div>


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
                              {Number(s.promoDiscountAmount ?? 0) > 0 && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Promo −{formatPrice(Number(s.promoDiscountAmount))}</span>}
                              {Number(s.discountAmount ?? 0) > 0 && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Discount −{formatPrice(Number(s.discountAmount))}</span>}
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
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatPrice(totalSpend)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{activeSubs.length} active enrollment{activeSubs.length !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 p-4">
                    <p className="text-xs text-muted-foreground">Total Saved</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{formatPrice(totalSavings)}</p>
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
                            <p className="font-bold text-base shrink-0">{formatPrice(amount)}</p>
                          </div>
                          {item.nextBillingDate && (
                            <p className="text-xs text-muted-foreground">Next billing: {new Date(item.nextBillingDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
                          )}
                          {savings > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                              {Number(s.promoDiscountAmount ?? 0) > 0 && <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">Promo −{formatPrice(Number(s.promoDiscountAmount))}</span>}
                              {Number(s.discountAmount ?? 0) > 0 && <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full font-medium">Discount −{formatPrice(Number(s.discountAmount))}</span>}
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
      <Dialog open={showProficiencyModal} onOpenChange={(open) => { setShowProficiencyModal(open); if (!open) setProficiencyStudentTab(0); }}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col gap-0 p-0">
          <div className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" /> Learning Proficiency
            </DialogTitle>
            <DialogDescription className="mt-1">Detailed breakdown of quiz performance, attendance, and teaching quality</DialogDescription>
          </div>
          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {(() => {
              // Build per-student data from filtered sessions
              const sessionMap = new Map<number, { studentName: string; status: string }>();
              analyticsFilteredSessions.forEach(s => {
                const name = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim() || "Student";
                sessionMap.set(s.id, { studentName: name, status: s.status });
              });

	              const studentNames = Array.from(new Set([
	                ...(analyticsFilteredSessions.map(s => [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim() || "Student")),
	                ...(analyticsFilteredSubscriptions.map(s => [s.subscription.studentFirstName, s.subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student")),
	              ]));

	              const perStudent = studentNames.map(name => {
	                const studentSubs = analyticsFilteredSubscriptions.filter(s =>
	                  ([s.subscription.studentFirstName, s.subscription.studentLastName].filter(Boolean).join(" ").trim() || "Student") === name
	                );
	                const tutorNames = Array.from(new Set(
	                  studentSubs
	                    .map((s) => s.tutor?.name?.trim?.())
	                    .filter((value): value is string => Boolean(value))
	                ));
	                const tutorStatusScores = studentSubs
	                  .map((s) => statusToPercentScore(s.subscription.progressStatus))
	                  .filter((score): score is 33 | 66 | 100 => score != null);
	                const tutorProficiencyScore = tutorStatusScores.length > 0
	                  ? Math.round(tutorStatusScores.reduce((sum, score) => sum + score, 0) / tutorStatusScores.length)
	                  : null;
	                const tutorStatusLevel: "low" | "medium" | "high" | null =
	                  tutorProficiencyScore == null ? null : tutorProficiencyScore <= 44 ? "low" : tutorProficiencyScore <= 83 ? "medium" : "high";

	                const studentSessions = analyticsFilteredSessions.filter(s =>
	                  ([s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim() || "Student") === name
	                );
                const completed = studentSessions.filter(s => s.status === "completed").length;
                const noShows = studentSessions.filter(s => s.status === "no_show").length;
                const totalScheduled = studentSessions.filter(s => s.status === "completed" || s.status === "no_show" || s.status === "scheduled").length;
                const attendance = totalScheduled > 0 ? Math.round((completed / totalScheduled) * 100) : 0;

                const studentQuizzes = analyticsFilteredQuizzes.filter(q => {
                  const sess = q.sessionId != null ? sessionMap.get(q.sessionId) : undefined;
                  return sess?.studentName === name && q.status === "completed" && q.score != null;
                });
                const avgQuiz = studentQuizzes.length > 0
                  ? Math.round(studentQuizzes.reduce((sum, q) => sum + (q.score ?? 0), 0) / studentQuizzes.length)
                  : null;

                const studentGrades = analyticsFilteredGrades.filter(g => {
                  const sess = g.sessionId != null ? sessionMap.get(g.sessionId) : undefined;
                  return sess?.studentName === name && g.rubricOverallScore != null;
                });
                const avgRubric = studentGrades.length > 0
                  ? Math.round((studentGrades.reduce((sum, g) => sum + Number(g.rubricOverallScore!), 0) / studentGrades.length) * 10) / 10
                  : null;

	                let proficiency: "Above Average" | "On Track" | "Needs Attention" = "On Track";
	                let source: "tutor_status" | "quiz_attendance" | "unrated" = "unrated";
	                if (tutorProficiencyScore != null) {
	                  source = "tutor_status";
	                  if (tutorProficiencyScore >= 84) proficiency = "Above Average";
	                  else if (tutorProficiencyScore <= 44) proficiency = "Needs Attention";
	                } else if (avgQuiz != null) {
	                  source = "quiz_attendance";
	                  if (avgQuiz >= 70 && attendance >= 80) proficiency = "Above Average";
	                  else if (avgQuiz < 50 || attendance < 50) proficiency = "Needs Attention";
	                } else if (attendance < 50 && totalScheduled > 0) {
	                  source = "quiz_attendance";
	                  proficiency = "Needs Attention";
	                }

	                return { name, completed, noShows, attendance, totalScheduled, avgQuiz, avgRubric, quizCount: studentQuizzes.length, gradeCount: studentGrades.length, proficiency, source, tutorStatusLevel, tutorProficiencyScore, tutorNames };
	              });

              if (perStudent.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                    <Target className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No data for this period</p>
                  </div>
                );
              }

	              const clampedTab = Math.min(proficiencyStudentTab, Math.max(0, perStudent.length - 1));
	              const student = perStudent[clampedTab];
	              const { name, completed, noShows, attendance, avgQuiz, avgRubric, quizCount, gradeCount, proficiency, source, tutorStatusLevel, tutorProficiencyScore, tutorNames } = student;
	              const profColor = proficiency === "Above Average" ? "text-emerald-600 dark:text-emerald-400" : proficiency === "On Track" ? "text-blue-600 dark:text-blue-400" : "text-amber-500";
	              const profBg = proficiency === "Above Average" ? "bg-emerald-50 dark:bg-emerald-950/40" : proficiency === "On Track" ? "bg-blue-50 dark:bg-blue-950/40" : "bg-amber-50 dark:bg-amber-950/40";

              return (
                <div className="space-y-4">
                  {/* Student tabs — only shown when multiple students */}
                  {perStudent.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {perStudent.map(({ name: n, proficiency: p }, idx) => {
                        const isActive = clampedTab === idx;
                        const dotColor = p === "Above Average" ? "bg-emerald-500" : p === "On Track" ? "bg-blue-500" : "bg-amber-400";
                        return (
                          <button
                            key={n}
                            onClick={() => setProficiencyStudentTab(idx)}
                            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                              isActive
                                ? "bg-violet-600 text-white border-violet-600"
                                : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? "bg-white/70" : dotColor}`} />
                            {n.split(" ")[0]}
                          </button>
                        );
                      })}
                    </div>
                  )}

	                  {/* Proficiency label */}
	                  <div className={`rounded-xl px-4 py-3 ${profBg}`}>
	                    <p className={`text-base font-bold ${profColor}`}>{proficiency}</p>
	                    <p className="text-xs text-muted-foreground mt-0.5">{name} · Overall assessment based on {source === "tutor_status" ? "tutor rating" : "quiz score & attendance"}</p>
	                  </div>

	                  {/* Tutor Rating */}
	                  {tutorStatusLevel && tutorProficiencyScore != null && (
	                    <div className="rounded-xl border bg-card p-4 space-y-3">
	                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tutor Rating</p>
	                      <div className="flex items-end justify-between">
	                        <p className="text-3xl font-bold">{tutorProficiencyScore}%</p>
	                        <p className="text-xs text-muted-foreground">{statusLabel(tutorStatusLevel)}</p>
	                      </div>
	                      <div className="h-2 rounded-full bg-muted overflow-hidden">
	                        <div className="h-2 rounded-full bg-gradient-to-r from-teal-500 to-violet-500" style={{ width: `${tutorProficiencyScore}%` }} />
	                      </div>
	                    </div>
	                  )}

	                  {/* Quiz Performance */}
	                  <div className="rounded-xl border bg-card p-4 space-y-3">
	                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quiz Performance</p>
                    <div className="flex items-end justify-between">
                      <p className="text-3xl font-bold">{avgQuiz != null ? `${avgQuiz}%` : "—"}</p>
                      <p className="text-xs text-muted-foreground">{quizCount} quiz{quizCount !== 1 ? "zes" : ""} taken</p>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-2 rounded-full bg-gradient-to-r from-violet-500 to-blue-500" style={{ width: `${avgQuiz ?? 0}%` }} />
                    </div>
                  </div>

                  {/* Attendance */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attendance</p>
                    <div className="flex items-end justify-between">
                      <p className="text-3xl font-bold">{attendance}%</p>
                      <p className="text-xs text-muted-foreground">{completed} completed · {noShows} no-show</p>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${attendance}%` }} />
                    </div>
                  </div>

                  {/* Session Grading */}
                  {avgRubric != null && (() => {
                    const studentGradesModal = analyticsFilteredGrades.filter(g => {
                      const sess = g.sessionId != null ? sessionMap.get(g.sessionId) : undefined;
                      return sess?.studentName === name && g.rubricOverallScore != null;
                    });
                    const criteriaModal = [
                      { key: "rubricAcademicEfficiency", label: "Academic Focus" },
                      { key: "rubricInstructionalQuality", label: "Engagement" },
                      { key: "rubricStrategyInsight", label: "Problem Solving" },
                      { key: "rubricSynthesisBranding", label: "Takeaways" },
                    ] as const;
                    const avgForModal = (key: string) => {
                      const vals = studentGradesModal.map(g => (g as any)[key]).filter((v: any) => v != null) as number[];
                      return vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
                    };
	                    const scoreColorModal = (v: number | null) =>
	                      v == null ? "bg-muted" : v >= 3.5 ? "bg-emerald-500" : v >= 2.5 ? "bg-blue-500" : v >= 1.5 ? "bg-amber-400" : "bg-red-500";
	                    const scoreTextModal = (v: number | null) =>
	                      v == null ? "text-muted-foreground" : v >= 3.5 ? "text-emerald-600 dark:text-emerald-400" : v >= 2.5 ? "text-blue-600 dark:text-blue-400" : v >= 1.5 ? "text-amber-500" : "text-red-600 dark:text-red-400";
	                    const engagements = studentGradesModal
	                      .map(g => (g as any).rubricEngagementData)
	                      .filter(Boolean)
	                      .map((e: any) => (typeof e === "string" ? JSON.parse(e) : e));
	                    const parseParticipation = (value: unknown) => {
	                      const match = String(value ?? "").match(/(\d+(?:\.\d+)?)/);
	                      return match ? Number(match[1]) : null;
	                    };
	                    const averageParticipationValues = engagements
	                      .map((e: any) => parseParticipation(e?.studentParticipationRate))
	                      .filter((value): value is number => value != null && Number.isFinite(value));
	                    const averageParticipation = averageParticipationValues.length > 0
	                      ? Math.round(averageParticipationValues.reduce((sum, value) => sum + value, 0) / averageParticipationValues.length)
	                      : null;
	                    const normalizeCriticalThinking = (value: unknown): "High" | "Medium" | "Low" | null => {
	                      const text = String(value ?? "");
	                      if (/high/i.test(text)) return "High";
	                      if (/medium/i.test(text)) return "Medium";
	                      if (/low/i.test(text)) return "Low";
	                      return null;
	                    };
	                    const criticalThinkingLevels = engagements
	                      .map((e: any) => normalizeCriticalThinking(e?.studentCriticalThinking))
	                      .filter((value): value is "High" | "Medium" | "Low" => value != null);
	                    const criticalThinkingCounts = criticalThinkingLevels.reduce((acc, value) => {
	                      acc[value] = (acc[value] ?? 0) + 1;
	                      return acc;
	                    }, {} as Record<"High" | "Medium" | "Low", number>);
	                    const typicalCriticalThinking = criticalThinkingLevels.length > 0
	                      ? (Object.entries(criticalThinkingCounts).sort((a, b) => b[1] - a[1])[0]?.[0] as "High" | "Medium" | "Low")
	                      : null;
	                    const criteriaAverages = criteriaModal.reduce<Array<{ label: typeof criteriaModal[number]["label"]; avg: number }>>((acc, { key, label }) => {
	                      const avg = avgForModal(key);
	                      if (avg != null) acc.push({ label, avg });
	                      return acc;
	                    }, []);
	                    const strongestArea = criteriaAverages.length > 0
	                      ? criteriaAverages.reduce((best, item) => item.avg > best.avg ? item : best).label
	                      : null;
	                    const needsMostSupport = criteriaAverages.length > 0
	                      ? criteriaAverages.reduce((lowest, item) => item.avg < lowest.avg ? item : lowest).label
	                      : null;
	                    return (
	                      <div className="rounded-xl border bg-card p-4 space-y-3">
	                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session Grading</p>
                          <p className="text-xs text-muted-foreground">{gradeCount} session{gradeCount !== 1 ? "s" : ""} graded</p>
                        </div>
                        <div className="flex items-end gap-2">
                          <p className="text-3xl font-bold">{avgRubric}</p>
                          <span className="text-base font-normal text-muted-foreground mb-0.5">/4</span>
                        </div>
                        <div className="space-y-2">
                          {criteriaModal.map(({ key, label }) => {
                            const avg = avgForModal(key);
                            return (
                              <div key={key} className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
                                <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div className={`h-1.5 rounded-full ${scoreColorModal(avg)} transition-all`} style={{ width: avg ? `${(avg / 4) * 100}%` : "0%" }} />
                                </div>
                                <span className={`text-xs font-semibold w-8 text-right ${scoreTextModal(avg)}`}>{avg != null ? avg.toFixed(1) : "—"}</span>
                              </div>
	                            );
	                          })}
	                        </div>
	                        {(averageParticipation != null || typicalCriticalThinking || strongestArea || needsMostSupport) && (
	                          <div className="grid gap-2 pt-1 sm:grid-cols-2">
	                            <div className="rounded-lg bg-muted px-3 py-2">
	                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Average Participation</p>
	                              <p className="text-sm font-medium text-foreground">{averageParticipation != null ? `~${averageParticipation}%` : "—"}</p>
	                            </div>
	                            <div className="rounded-lg bg-muted px-3 py-2">
	                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Typical Critical Thinking</p>
	                              <p className="text-sm font-medium text-foreground">{typicalCriticalThinking ?? "—"}</p>
	                            </div>
	                            <div className="rounded-lg bg-muted px-3 py-2">
	                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Strongest Area</p>
	                              <p className="text-sm font-medium text-foreground">{strongestArea ?? "—"}</p>
	                            </div>
	                            <div className="rounded-lg bg-muted px-3 py-2">
	                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Needs Most Support</p>
	                              <p className="text-sm font-medium text-foreground">{needsMostSupport ?? "—"}</p>
	                            </div>
	                          </div>
	                        )}
	                      </div>
	                    );
                  })()}
                </div>
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
              const recentFeedbackSessions = analyticsFilteredSessions.filter(s => s.feedbackFromTutor && new Date(s.scheduledAt).getTime() > recentThreshold);
              const hasRecentFeedback = recentFeedbackSessions.length > 0;
              const totalScheduled = selectedAnalyticsMonth === "all"
                ? (upcomingSessions || []).length
                : analyticsFilteredSessions.filter(s => s.status === "scheduled").length;
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
                          else toast.error("Could not create payment session.");
                          setPaymentModalSub(null);
                        } catch {
                          toast.error("Failed to start monthly payment");
                        } finally {
                          setSetupLoadingId(null);
                        }
                      }}
                    >
                      <div className="font-semibold text-sm">Pay First Month & Set Up Billing</div>
                      {(siblingPct > 0 || promoAmt > 0) && (
                        <div className="text-xs text-amber-700 mt-1">
                          {[siblingPct > 0 && `${siblingPct}% sibling`, promoAmt > 0 && `$${promoAmt} promo`].filter(Boolean).join(" + ")} applied to monthly charges
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">Charges the first month now and saves your card for future billing based on completed sessions</div>
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
