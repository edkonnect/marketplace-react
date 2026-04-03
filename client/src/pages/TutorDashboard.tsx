import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link, useLocation } from "wouter";
import { BookOpen, Calendar, MessageSquare, DollarSign, Users, Edit, Clock, FileText, Plus, Filter, Search, X, Sparkles, Globe, ClipboardPaste, CheckCircle, HelpCircle, Download } from "lucide-react";
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { TimeBlockManager } from "@/components/TimeBlockManager";
import { VideoUploadManager } from "@/components/VideoUploadManager";
import { ZoomMeetingSetup } from "@/components/ZoomMeetingSetup";
import { TutorSessionsManager } from "@/components/TutorSessionsManager";
import { ReferralCouponPopup } from "@/components/ReferralCouponPopup";
import { useEffect, useMemo, useRef, useState } from "react";
import { LOGIN_PATH } from "@/const";
import { toast } from "sonner";
import { formatSessionTime, COMMON_TIMEZONES } from "@/../../shared/timezone-utils";
import Footer from "@/components/Footer";
import { statusLabel, statusToStep, stepToStatus, type ProgressStatus } from "@/lib/progressStatus";

type ProgressStatusValue = ProgressStatus;

function progressStatusToStep(v: ProgressStatusValue): number {
  return statusToStep(v);
}

function stepToProgressStatus(step: number): ProgressStatusValue {
  return stepToStatus(step);
}

function progressStatusLabel(v: ProgressStatusValue): string {
  return statusLabel(v);
}

function ProgressStatusMiniSlider({
  value,
  disabled,
  onCommit,
}: {
  value: ProgressStatusValue;
  disabled?: boolean;
  onCommit: (next: ProgressStatusValue) => void;
}) {
  const [internal, setInternal] = useState<number>(() => progressStatusToStep(value));

  useEffect(() => {
    setInternal(progressStatusToStep(value));
  }, [value]);

  const colorClass =
    internal === 3
      ? "[&_[data-slot=slider-range]]:bg-emerald-500 [&_[data-slot=slider-thumb]]:border-emerald-500"
      : internal === 2
        ? "[&_[data-slot=slider-range]]:bg-blue-500 [&_[data-slot=slider-thumb]]:border-blue-500"
        : internal === 1
          ? "[&_[data-slot=slider-range]]:bg-orange-500 [&_[data-slot=slider-thumb]]:border-orange-500"
          : "[&_[data-slot=slider-range]]:bg-muted-foreground/30 [&_[data-slot=slider-thumb]]:border-muted-foreground/40";

  return (
    <div className="flex items-center" title={`Progress Status: ${progressStatusLabel(stepToProgressStatus(internal))}`}>
      <span className="sr-only">Progress Status</span>
      <Slider
        value={[internal]}
        min={0}
        max={3}
        step={1}
        disabled={disabled}
        onValueChange={(v) => {
          const next = v?.[0] ?? 0;
          setInternal(next);
        }}
        onValueCommit={(v) => {
          const nextStep = v?.[0] ?? 0;
          const next = stepToProgressStatus(nextStep);
          if (next !== value) onCommit(next);
        }}
        className={[
          "w-36",
          "cursor-pointer",
          "[&_[data-slot=slider-track]]:h-2",
          "[&_[data-slot=slider-thumb]]:size-4",
          "[&_[data-slot=slider-thumb]]:bg-background",
          "[&_[data-slot=slider-thumb]]:shadow-sm",
          colorClass,
        ].join(" ")}
      />
    </div>
  );
}

function renderBoldMarkdown(text: string) {
  const html = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function AssignStudentsDialogContent({
  fileId, students, onClose, onSaved,
}: {
  fileId: number;
  students: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: existingAssignments = [], isLoading } = trpc.fileManagement.getFileParentAssignments.useQuery({ fileId });
  const assignMutation = trpc.fileManagement.assignFileToParents.useMutation({
    onSuccess: () => { toast.success("File assigned to students"); onSaved(); },
  });

  const [selectedSubscriptionIds, setSelectedSubscriptionIds] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Once existing assignments load, pre-select them (runs exactly once per mount)
  useEffect(() => {
    if (isLoading || initialized) return;
    const assignedSubscriptionIds = existingAssignments
      .map((a: any) => a.assignment.subscriptionId)
      .filter((id: any) => id !== null);
    setSelectedSubscriptionIds(assignedSubscriptionIds);
    setInitialized(true);
  }, [isLoading, initialized]);

  function toggle(subscriptionId: number) {
    setSelectedSubscriptionIds(prev =>
      prev.includes(subscriptionId) ? prev.filter(id => id !== subscriptionId) : [...prev, subscriptionId]
    );
  }

  const selectedSubscriptions = students.filter((s: any) => selectedSubscriptionIds.includes(s.subscriptionId))
    .map((s: any) => ({ subscriptionId: s.subscriptionId, parentId: s.parentId }));

  const studentsByCourse = students.reduce((acc: Record<string, any[]>, s: any) => {
    const key = s.courseName ?? "No Course";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Assign File to Students</DialogTitle>
        <DialogDescription>Select students enrolled in your courses. The file will be sent to their parent's account.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 max-h-96 overflow-y-auto py-2 pr-1">
        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : students.length === 0 ? (
          <p className="text-sm text-muted-foreground">No enrolled students found. Only students with a name on their enrollment will appear here.</p>
        ) : (
          Object.entries(studentsByCourse).map(([courseName, courseStudents]: [string, any[]]) => (
            <div key={courseName} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b pb-1">{courseName}</p>
              {courseStudents.map((s: any) => (
                <div key={s.subscriptionId} className="flex items-start gap-2 pl-1">
                  <Checkbox
                    id={`student-${s.subscriptionId}`}
                    checked={selectedSubscriptionIds.includes(s.subscriptionId)}
                    onCheckedChange={() => toggle(s.subscriptionId)}
                    className="mt-0.5"
                  />
                  <Label htmlFor={`student-${s.subscriptionId}`} className="cursor-pointer leading-snug">
                    <span className="font-medium">
                      {s.studentFirstName && s.studentLastName
                        ? `${s.studentFirstName} ${s.studentLastName}`
                        : `${s.parentFirstName} ${s.parentLastName}`}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Parent: {s.parentFirstName} {s.parentLastName} · {s.parentEmail}
                    </span>
                  </Label>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          disabled={assignMutation.isPending || isLoading}
          onClick={() => assignMutation.mutate({ fileId, subscriptions: selectedSubscriptions })}
        >
          {assignMutation.isPending ? "Saving..." : `Assign to ${selectedSubscriptionIds.length} student${selectedSubscriptionIds.length !== 1 ? "s" : ""}`}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TutorFilesPanel({ tutorId }: { tutorId: number }) {
  const { data: files = [], isLoading } = trpc.fileManagement.getMyFiles.useQuery();
  const { data: students = [] } = trpc.fileManagement.getMyStudents.useQuery();
  const utils = trpc.useUtils();

  const [assignDialogFileId, setAssignDialogFileId] = useState<number | null>(null);
  const [dialogKey, setDialogKey] = useState(0);

  function openPreview(fileId: number) {
    window.open(`/api/files/proxy/${fileId}`, "_blank");
  }

  function openAssignDialog(fileId: number) {
    setAssignDialogFileId(fileId);
    setDialogKey(k => k + 1);
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Files</h2>
      <p className="text-muted-foreground text-sm">Files assigned to you by the admin. You can share them with your students.</p>
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No files have been assigned to you yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {files.map((row: any) => (
            <Card key={row.file.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{row.file.title}</p>
                      {row.courseName && <p className="text-xs text-muted-foreground">{row.courseName}</p>}
                    </div>
                  </div>
                  <Badge variant="outline" className="flex-shrink-0 text-xs">{row.file.fileType.includes("pdf") ? "PDF" : "Word"}</Badge>
                </div>
                {row.file.description && <p className="text-sm text-muted-foreground line-clamp-2">{row.file.description}</p>}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatFileSize(row.file.fileSize)}</span>
                  <span>{new Date(row.assignment.assignedAt).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openPreview(row.file.id)}>
                    Preview
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openPreview(row.file.id)}>
                    <Download className="w-4 h-4 mr-1" /> Download
                  </Button>
                  <Button size="sm" variant="default" className="w-full" onClick={() => openAssignDialog(row.file.id)}>
                    Assign to Students
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Students Dialog — keyed so state resets on every open */}
      <Dialog open={assignDialogFileId !== null} onOpenChange={open => { if (!open) setAssignDialogFileId(null); }}>
        {assignDialogFileId !== null && (
          <AssignStudentsDialogContent
            key={dialogKey}
            fileId={assignDialogFileId}
            students={students}
            onClose={() => setAssignDialogFileId(null)}
            onSaved={() => {
              utils.fileManagement.getFileParentAssignments.invalidate({ fileId: assignDialogFileId });
              setAssignDialogFileId(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

export default function TutorDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const formatPrice = useFormatPrice();

  // Get tab from URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab') || 'courses';

  const tabContentClass =
    "space-y-6 w-full data-[state=inactive]:hidden";

  const { data: tutorProfile } = trpc.tutorProfile.getMy.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const { data: courses, isLoading: coursesLoading, refetch: refetchCourses } = trpc.course.myCoursesAsTutor.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const { data: coursePreferences, isLoading: preferencesLoading, refetch: refetchPreferences } =
    trpc.tutorCoursePreferences.getMine.useQuery(undefined, {
      enabled: isAuthenticated && (user?.role === "tutor" || user?.role === "admin"),
    });

  const { data: availableCourses, isLoading: availableCoursesLoading } =
    trpc.tutorCoursePreferences.availableCourses.useQuery(undefined, {
      enabled: isAuthenticated && (user?.role === "tutor" || user?.role === "admin"),
    });

  const { data: subscriptions, isLoading: subsLoading, refetch: refetchSubscriptions } = trpc.subscription.mySubscriptionsAsTutor.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const { data: upcomingSessions, refetch: refetchUpcoming } = trpc.session.myUpcoming.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const { data: historySessions, isLoading: historyLoading, refetch: refetchHistory } = trpc.session.myHistory.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  // Fetch all rubric grades for this tutor's sessions
  const { data: tutorGrades, refetch: refetchTutorGrades } = trpc.grades.getByTutor.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );
  const tutorGradeBySessionId = useMemo(() => {
    const map = new Map<number, NonNullable<typeof tutorGrades>[number]>();
    (tutorGrades || []).forEach((g) => { if (g.sessionId) map.set(g.sessionId, g); });
    return map;
  }, [tutorGrades]);

  const progressSuggestionBySubscriptionId = useMemo(() => {
    const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
    const parsePct = (rate?: string | null): number | null => {
      const match = rate?.match(/(\d+(?:\.\d+)?)/);
      if (!match) return null;
      const pct = Number(match[1]);
      if (!Number.isFinite(pct)) return null;
      return Math.max(0, Math.min(100, pct));
    };
    const ctNorm = (text?: string | null): { level: "High" | "Medium" | "Low" | null; norm: number | null } => {
      const level = (text?.split(".")[0]?.trim()?.split(/\s+/)[0] ?? "") as any;
      if (level === "High") return { level: "High", norm: 1.0 };
      if (level === "Medium") return { level: "Medium", norm: 0.6 };
      if (level === "Low") return { level: "Low", norm: 0.25 };
      return { level: null, norm: null };
    };

    const bySub = new Map<number, any[]>();
    (historySessions || []).forEach((s: any) => {
      const subId = s?.subscriptionId as number | null | undefined;
      if (!subId) return;
      if (s?.status !== "completed") return;
      const arr = bySub.get(subId) ?? [];
      arr.push(s);
      bySub.set(subId, arr);
    });

    const out = new Map<number, {
      suggested: Exclude<ProgressStatusValue, null> | null;
      confidence: "none" | "low" | "medium" | "high";
      usedCount: number;
      avgOverallScore: number | null;
      avgParticipationPct: number | null;
      ctMode: "High" | "Medium" | "Low" | null;
      sessions: Array<{
        sessionId: number;
        scheduledAt: number | null;
        overallScore: number | null;
        participationPct: number | null;
        criticalThinkingLevel: "High" | "Medium" | "Low" | null;
        combinedNorm: number;
      }>;
    }>();

    bySub.forEach((sessions, subId) => {
      sessions.sort((a: any, b: any) => Number(b?.scheduledAt ?? 0) - Number(a?.scheduledAt ?? 0));

      let used = 0;
      let combinedSum = 0;

      let scoreSum = 0;
      let scoreCount = 0;

      let partSum = 0;
      let partCount = 0;

      const ctCounts: Record<"High" | "Medium" | "Low", number> = { High: 0, Medium: 0, Low: 0 };
      const detailSessions: Array<{
        sessionId: number;
        scheduledAt: number | null;
        overallScore: number | null;
        participationPct: number | null;
        criticalThinkingLevel: "High" | "Medium" | "Low" | null;
        combinedNorm: number;
      }> = [];

      for (const s of sessions) {
        if (used >= 4) break;
        const g = tutorGradeBySessionId.get(Number(s?.id ?? 0)) as any;
        if (!g) continue;

        const overall = g?.rubricOverallScore as number | null | undefined;
        const eng = g?.rubricEngagementData as { studentParticipationRate?: string; studentCriticalThinking?: string } | null | undefined;

        const signals: Array<{ w: number; v: number }> = [];

        if (overall != null && Number.isFinite(Number(overall))) {
          const overallNum = Number(overall);
          const norm = clamp01((overallNum - 1) / 3);
          signals.push({ w: 0.7, v: norm });
          scoreSum += overallNum;
          scoreCount += 1;
        }

        const ct = ctNorm(eng?.studentCriticalThinking);
        if (ct.norm != null) {
          signals.push({ w: 0.2, v: ct.norm });
          if (ct.level) ctCounts[ct.level] += 1;
        }

        const pct = parsePct(eng?.studentParticipationRate);
        if (pct != null) {
          signals.push({ w: 0.1, v: clamp01(pct / 100) });
          partSum += pct;
          partCount += 1;
        }

        if (signals.length === 0) continue;

        const wSum = signals.reduce((sum, it) => sum + it.w, 0);
        const combined = wSum > 0 ? signals.reduce((sum, it) => sum + (it.w / wSum) * it.v, 0) : 0;

        combinedSum += combined;
        used += 1;
        detailSessions.push({
          sessionId: Number(s?.id ?? 0),
          scheduledAt: s?.scheduledAt != null ? Number(s.scheduledAt) : null,
          overallScore: overall != null && Number.isFinite(Number(overall)) ? Number(overall) : null,
          participationPct: pct,
          criticalThinkingLevel: ct.level,
          combinedNorm: combined,
        });
      }

      const confidence = used === 0 ? "none" : used === 1 ? "low" : used === 2 ? "medium" : "high";
      const avgCombined = used > 0 ? combinedSum / used : null;

      const suggested = avgCombined == null ? null : avgCombined < 0.45 ? "low" : avgCombined <= 0.7 ? "medium" : "high";

      const ctMode =
        ctCounts.High === 0 && ctCounts.Medium === 0 && ctCounts.Low === 0
          ? null
          : (Object.entries(ctCounts).sort((a, b) => b[1] - a[1])[0]![0] as "High" | "Medium" | "Low");

      out.set(subId, {
        suggested,
        confidence,
        usedCount: used,
        avgOverallScore: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
        avgParticipationPct: partCount > 0 ? Math.round(partSum / partCount) : null,
        ctMode,
        sessions: detailSessions,
      });
    });

    return out;
  }, [historySessions, tutorGradeBySessionId]);

  const [expandedGrades, setExpandedGrades] = useState<Set<number>>(new Set());
  const toggleGradeExpand = (id: number) => setExpandedGrades((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const [expandedEngagement, setExpandedEngagement] = useState<Set<number>>(new Set());
  const toggleEngagementExpand = (id: number) => setExpandedEngagement((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const [sessionNotes, setSessionNotes] = useState<Record<number, string>>({});
  const [summarizingSessionId, setSummarizingSessionId] = useState<number | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSessionJoinUrl, setSelectedSessionJoinUrl] = useState<string | null>(null);
  const [completionType, setCompletionType] = useState<"completed" | "no_show">("completed");
  const [completionNotes, setCompletionNotes] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [courseSubjectFilter, setCourseSubjectFilter] = useState<string>("all");
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [fetchingTranscripts, setFetchingTranscripts] = useState<Record<number, boolean>>({});
  type PreferenceState = { preferred: boolean; hourlyRate: string; approvalStatus?: string };
  const [preferenceState, setPreferenceState] = useState<Record<number, PreferenceState>>({});

  // Transcript processing state
  const [transcriptText, setTranscriptText] = useState<Record<number, string>>({});
  const [processingTranscript, setProcessingTranscript] = useState<number | null>(null);
  const [showTranscriptInput, setShowTranscriptInput] = useState<Record<number, boolean>>({});
  const [processedNotes, setProcessedNotes] = useState<Record<number, any>>({});
  const [aiProcessedSessions, setAiProcessedSessions] = useState<Set<number>>(new Set());


  // Transcript modal state
  type RubricGrade = { criterion: string; score: number; evidence: string };
  type TranscriptModalState = {
    sessionId: number;
    transcript: string;
    summary?: string;
    quizQuestions?: Array<{ id: string; question: string; options: string[]; correctAnswer: number }>;
    activeTab: "transcript" | "quiz";
    courseTitle: string;
    studentName: string;
    sessionDate?: string;
    courseId?: number;
    parentId?: number;
    quizEnabled?: boolean;
    editable?: boolean;
    grades?: RubricGrade[];
    overallScore?: number;
    overallNarrative?: string;
    transcriptQuality?: "high" | "medium" | "low";
    transcriptQualityReason?: string;
  };
  const [transcriptModal, setTranscriptModal] = useState<TranscriptModalState | null>(null);
  const [summarizingInModal, setSummarizingInModal] = useState(false);
  const summarizingInModalRef = useRef(false);
  const pendingGradeContextRef = useRef<{ transcript: string; sessionId: number; courseTitle: string; studentName: string } | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [gradingSession, setGradingSession] = useState(false);

  const savePreferencesMutation = trpc.tutorCoursePreferences.saveMine.useMutation({
    onSuccess: () => {
      toast.success("Preferences saved");
      refetchPreferences();
    },
    onError: (err) => toast.error(err.message || "Failed to save preferences"),
  });

  const updateSessionMutation = trpc.session.update.useMutation({
    onSuccess: () => {
      refetchUpcoming();
      refetchHistory();
      toast.success("Session updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update session"),
  });

  const updateProgressStatusMutation = trpc.subscription.updateProgressStatus.useMutation({
    onSuccess: () => {
      refetchSubscriptions();
      toast.success("Progress status updated");
    },
    onError: (err) => toast.error(err.message || "Failed to update progress status"),
  });
  const [progressSuggestionModal, setProgressSuggestionModal] = useState<null | { subscriptionId: number; studentName: string; courseTitle: string }>(null);

  const fetchTranscriptMutation = trpc.zoom.fetchTranscript.useMutation({
    onSuccess: (data, variables) => {
      const sessionId = variables.sessionId || 0;
      setFetchingTranscripts((prev) => ({ ...prev, [sessionId]: false }));
      if (!data.transcript || data.transcript.trim().length === 0) {
        toast.warning("No transcript text found for this session. Audio transcript may not be enabled on Zoom.");
        return;
      }
      const session = historySessions?.find((s) => s.id === sessionId);
      const studentName = [session?.studentFirstName, session?.studentLastName]
        .filter(Boolean).join(" ") || "Student";
      setTranscriptModal({
        sessionId,
        transcript: data.transcript,
        activeTab: "transcript",
        courseTitle: (session as any)?.courseTitle || (session as any)?.courseSubject || "Course",
        studentName,
        sessionDate: session?.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
        courseId: session?.courseId ?? undefined,
        parentId: session?.parentId ?? undefined,
        quizEnabled: ((session as any)?.courseQuizEnabled ?? false) && !((session as any)?.hasQuiz),
      });
      toast.success("Transcript loaded. Review it in the popup.");
    },
    onError: (error, variables) => {
      const sessionId = variables.sessionId || 0;
      const message = error.message || "Failed to fetch transcript";
      if (message.includes("No transcript found") || message.includes("No transcript available") || message.includes("not found")) {
        toast.warning("No transcript available for this session. Make sure cloud recording and audio transcript are enabled in Zoom.");
      } else {
        toast.error(message);
      }
      setFetchingTranscripts((prev) => ({ ...prev, [sessionId]: false }));
    },
  });

  const summarizeMutation = trpc.ai.summarizeText.useMutation({
    onSuccess: (data) => {
      if (summarizingSessionId !== null) {
        // Regular in-page summarize (not from modal)
        setSessionNotes((prev) => ({
          ...prev,
          [summarizingSessionId]: data.summary,
        }));
        setSummarizingSessionId(null);
        toast.success("Notes summarized successfully!");
      } else if (summarizingInModalRef.current) {
        // Modal summarize — store in modal state and auto-grade in background
        const gradeCtx = pendingGradeContextRef.current;
        pendingGradeContextRef.current = null;
        summarizingInModalRef.current = false;
        setSummarizingInModal(false);
        setTranscriptModal((prev) => prev ? { ...prev, summary: data.summary } : prev);
        toast.success("Summary generated!");
        // Auto-grade silently if transcript was long enough
        if (gradeCtx) {
          setGradingSession(true);
          gradeSessionMutation.mutate({
            transcript: gradeCtx.transcript,
            sessionId: gradeCtx.sessionId,
            courseName: gradeCtx.courseTitle,
            studentName: gradeCtx.studentName,
          });
        }
      }
    },
    onError: (error) => {
      setSummarizingSessionId(null);
      summarizingInModalRef.current = false;
      setSummarizingInModal(false);
      toast.error("Failed to summarize: " + error.message);
    },
  });

  const generateQuizMutation = trpc.ai.generateQuiz.useMutation({
    onSuccess: (data) => {
      setTranscriptModal((prev) => prev ? { ...prev, quizQuestions: data.questions } : prev);
      setGeneratingQuiz(false);
      toast.success("Quiz generated! Review the questions below.");
    },
    onError: (error) => {
      setGeneratingQuiz(false);
      toast.error("Failed to generate quiz: " + error.message);
    },
  });

  // Load existing grade when transcript modal is open
  const existingGradeQuery = trpc.grades.getBySession.useQuery(
    { sessionId: transcriptModal?.sessionId ?? 0 },
    { enabled: !!transcriptModal?.sessionId }
  );
  useEffect(() => {
    const data = existingGradeQuery.data;
    if (!data) return;
    const evidence = data.rubricEvidence;
    if (Array.isArray(evidence) && evidence.length > 0 && !transcriptModal?.grades) {
      setTranscriptModal((prev) => prev ? {
        ...prev,
        grades: evidence as { criterion: string; score: number; evidence: string }[],
        overallScore: data.rubricOverallScore != null ? Number(data.rubricOverallScore) : undefined,
        transcriptQuality: data.rubricTranscriptQuality as "high" | "medium" | "low" | undefined,
        transcriptQualityReason: data.rubricTranscriptQualityReason ?? undefined,
      } : prev);
    }
  }, [existingGradeQuery.data]);

  const gradeSessionMutation = trpc.ai.gradeSession.useMutation({
    onSuccess: (data) => {
      setTranscriptModal((prev) => prev ? {
        ...prev,
        grades: data.grades as { criterion: string; score: number; evidence: string }[],
        overallScore: data.overallScore,
        overallNarrative: data.overallNarrative,
        transcriptQuality: data.transcriptQuality as "high" | "medium" | "low",
        transcriptQualityReason: data.transcriptQualityReason,
      } : prev);
      setGradingSession(false);
      refetchTutorGrades();
    },
    onError: (error) => {
      setGradingSession(false);
      console.error("Auto-grading failed:", error.message);
      if (!error.message.includes("too short")) {
        toast.error("Session grading failed: " + error.message);
      }
    },
  });

  const approveQuizMutation = trpc.quiz.create.useMutation({
    onSuccess: () => {
      setTranscriptModal(null);
      toast.success("Quiz approved and sent to parent!");
      refetchHistory();
    },
    onError: (error) => {
      toast.error("Failed to save quiz: " + error.message);
    },
  });

  const toggleCourseQuizMutation = trpc.quiz.toggleCourseQuiz.useMutation({
    onSuccess: (_, variables) => {
      toast.success(`Quiz generation ${variables.enabled ? "enabled" : "disabled"} for this course.`);
      refetchCourses();
    },
    onError: (error) => {
      toast.error("Failed to update course: " + error.message);
    },
  });

  const handleSummarize = (sessionId: number, text: string) => {
    if (!text || text.trim().length < 10) {
      toast.error("Please add more content before summarizing");
      return;
    }
    setSummarizingSessionId(sessionId);
    summarizeMutation.mutate({
      text,
      maxLength: 150
    });
  };

  // Transcript processing mutations
  const processTranscriptMutation = trpc.ai.processTranscript.useMutation({
    onSuccess: (data, variables) => {
      setProcessedNotes((prev) => ({
        ...prev,
        [variables.sessionId]: data,
      }));
      setProcessingTranscript(null);
      toast.success("Transcript processed! Review and save the generated notes.");
    },
    onError: (error) => {
      setProcessingTranscript(null);
      toast.error("Failed to process transcript: " + error.message);
    },
  });

  const handleProcessTranscript = (sessionId: number, studentName: string, courseName: string) => {
    const transcript = transcriptText[sessionId];
    if (!transcript || transcript.trim().length < 50) {
      toast.error("Please enter a valid transcript (at least 50 characters)");
      return;
    }

    setProcessingTranscript(sessionId);
    processTranscriptMutation.mutate({
      transcript,
      sessionId,
      studentName,
      courseName,
    });
  };

  const saveProcessedNotesMutation = trpc.sessionNotes.createFromTranscript.useMutation({
    onSuccess: (data, variables) => {
      toast.success("Session notes saved successfully!");

      // Update the manual session notes field with a formatted version of the AI-generated content
      const processedData = processedNotes[variables.sessionId];
      if (processedData) {
        const formattedNotes = [
          `📝 Progress Summary:\n${processedData.progressSummary}`,
          processedData.topicsCovered && processedData.topicsCovered.length > 0
            ? `\n\n📌 Topics Covered:\n${processedData.topicsCovered.map((topic: string) => `• ${topic}`).join('\n')}`
            : '',
          processedData.challenges ? `\n\n⚠️ Challenges:\n${processedData.challenges}` : '',
          processedData.homework ? `\n\n📚 Homework:\n${processedData.homework}` : '',
          processedData.nextSteps ? `\n\n💡 Next Steps:\n${processedData.nextSteps}` : '',
        ].filter(Boolean).join('');

        // Update the feedbackFromTutor field so it appears in manual notes
        updateSessionMutation.mutate({
          id: variables.sessionId,
          feedbackFromTutor: formattedNotes
        });

        // Also update the local session notes state
        setSessionNotes((prev) => ({
          ...prev,
          [variables.sessionId]: formattedNotes,
        }));
      }

      // Mark this session as AI-processed to hide Summarize button
      setAiProcessedSessions((prev) => new Set(prev).add(variables.sessionId));

      refetchHistory();

      // Clear processed notes and transcript for this session
      setProcessedNotes((prev) => {
        const updated = { ...prev };
        delete updated[variables.sessionId];
        return updated;
      });
      setTranscriptText((prev) => {
        const updated = { ...prev };
        delete updated[variables.sessionId];
        return updated;
      });
      setShowTranscriptInput((prev) => {
        const updated = { ...prev };
        delete updated[variables.sessionId];
        return updated;
      });
    },
    onError: (error) => {
      toast.error("Failed to save notes: " + error.message);
    },
  });

  const { data: earnings } = trpc.payment.myEarnings.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const createProfileMutation = trpc.tutorProfile.create.useMutation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = LOGIN_PATH;
    }
    if (!loading && user?.role !== "tutor" && user?.role !== "admin") {
      setLocation("/"); // Redirect to home if not a tutor
    }
  }, [loading, isAuthenticated, user, setLocation]);

  const activeSubscriptions = subscriptions?.filter(s => s.subscription.status === "active") || [];
  const activeCourses = courses?.filter(c => c.isActive) || [];
  const uniqueActiveStudents = useMemo(() => {
    const keys = activeSubscriptions.map((s) => {
      const first = (s.subscription.studentFirstName || "").trim().toLowerCase();
      const last = (s.subscription.studentLastName || "").trim().toLowerCase();
      // Fallback to parentId when student name is missing to avoid undercounting
      return `${s.subscription.parentId}-${first}-${last}`;
    });
    return new Set(keys).size;
  }, [activeSubscriptions]);

  // Get tutor's timezone for displaying session times correctly
  const tutorTimezone = tutorProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Get friendly timezone label
  const timezoneFriendlyName = useMemo(() => {
    const found = COMMON_TIMEZONES.find(tz => tz.value === tutorTimezone);
    return found ? found.label : tutorTimezone;
  }, [tutorTimezone]);

  // Get timezone abbreviation
  const timezoneAbbr = useMemo(() => {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: tutorTimezone,
      timeZoneName: 'short'
    }).split(' ').pop();
  }, [tutorTimezone]);

  // Helper function to format session date and time in tutor's timezone
  const formatSessionDateTime = (scheduledAt: number) => {
    const date = formatSessionTime(scheduledAt, tutorTimezone, 'PPP'); // e.g., "April 29, 2023"
    const time = formatSessionTime(scheduledAt, tutorTimezone, 'p'); // e.g., "9:00 AM"
    return { date, time };
  };

  // Generate available years from subscriptions based on enrollment date
  const availableYears = useMemo(() => {
    if (!subscriptions) return [];
    const years = new Set<number>();
    subscriptions.forEach(({ subscription }) => {
      const enrollDate = subscription.startDate || subscription.createdAt;
      if (enrollDate) {
        const year = new Date(enrollDate).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  }, [subscriptions]);

  // Filter subscriptions by selected year
  const filteredSubscriptions = useMemo(() => {
    if (!subscriptions || selectedYear === "all") return subscriptions;

    return subscriptions.filter(({ subscription }) => {
      const enrollDate = subscription.startDate || subscription.createdAt;
      if (!enrollDate) return false;
      const enrollYear = new Date(enrollDate).getFullYear();
      return enrollYear.toString() === selectedYear;
    });
  }, [subscriptions, selectedYear]);

  // Extract unique subjects from available courses
  const availableSubjects = useMemo(() => {
    if (!availableCourses) return [];
    const subjects = new Set<string>();
    availableCourses.forEach((course: any) => {
      if (course.subject) {
        subjects.add(course.subject);
      }
    });
    return Array.from(subjects).sort();
  }, [availableCourses]);

  // Filter courses based on search, subject, and selection
  const filteredCourses = useMemo(() => {
    if (!availableCourses) return [];

    return availableCourses.filter((course: any) => {
      // Search filter
      if (courseSearchQuery) {
        const query = courseSearchQuery.toLowerCase();
        const matchesTitle = course.title?.toLowerCase().includes(query);
        const matchesSubject = course.subject?.toLowerCase().includes(query);
        const matchesGrade = course.gradeLevel?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesSubject && !matchesGrade) {
          return false;
        }
      }

      // Subject filter
      if (courseSubjectFilter !== "all" && course.subject !== courseSubjectFilter) {
        return false;
      }

      // Show only selected filter
      if (showOnlySelected) {
        const pref = preferenceState[course.id];
        if (!pref || !pref.preferred) {
          return false;
        }
      }

      return true;
    });
  }, [availableCourses, courseSearchQuery, courseSubjectFilter, showOnlySelected, preferenceState]);

  // Helpers for session actions
  const canComplete = (session: any) =>
    session.status === "scheduled" && session.scheduledAt <= Date.now();

  const statusVariant = (status?: string | null) => {
    switch (status) {
      case "cancelled":
        return "destructive";
      case "no_show":
        return "outline";
      case "completed":
        return "secondary";
      default:
        return "default";
    }
  };

  const handleOpenCompletionDialog = (sessionId: number, existingNotes?: string | null, joinUrl?: string | null) => {
    setSelectedSessionId(sessionId);
    setSelectedSessionJoinUrl(joinUrl || null);
    setCompletionNotes(existingNotes || "");
    setCompletionType("completed");
    setCompletionDialogOpen(true);
  };

  const handleCompleteSession = () => {
    if (!selectedSessionId) return;

    const sessionId = selectedSessionId;
    const joinUrl = selectedSessionJoinUrl;

    updateSessionMutation.mutate({
      id: sessionId,
      status: completionType as "completed" | "no_show",
      feedbackFromTutor: completionNotes || undefined,
    }, {
      onSuccess: () => {
        setCompletionDialogOpen(false);
        setSelectedSessionId(null);
        setSelectedSessionJoinUrl(null);
        setCompletionNotes("");
        setCompletionType("completed");

        // Auto-fetch transcript after session is marked complete
        if (completionType === "completed" && joinUrl) {
          setSessionNotes((prev) => ({
            ...prev,
            [sessionId]: "Transcript being fetched to process...",
          }));
          handleFetchTranscript(sessionId, joinUrl);
        }
      }
    });
  };

  const handleFetchTranscript = (sessionId: number, joinUrl: string | null) => {
    if (!joinUrl) {
      toast.error("No Zoom meeting URL found for this session");
      return;
    }

    console.log("Attempting to extract meeting ID from:", joinUrl);

    // Extract meeting ID from Zoom URL
    // Support multiple formats:
    // - https://zoom.us/j/85648346210
    // - https://us05web.zoom.us/j/85648346210
    // - https://us05web.zoom.us/s/85648346210 (start URL format)
    // - https://zoom.us/j/85648346210?pwd=...
    // - https://us05web.zoom.us/wc/join/85648346210
    let meetingId: string | null = null;

    // Try pattern 1: /j/NUMBER (join URL)
    const pattern1 = joinUrl.match(/\/j\/(\d+)/);
    if (pattern1) {
      meetingId = pattern1[1];
    }

    // Try pattern 2: /s/NUMBER (start/host URL)
    if (!meetingId) {
      const pattern2 = joinUrl.match(/\/s\/(\d+)/);
      if (pattern2) {
        meetingId = pattern2[1];
      }
    }

    // Try pattern 3: /join/NUMBER
    if (!meetingId) {
      const pattern3 = joinUrl.match(/\/join\/(\d+)/);
      if (pattern3) {
        meetingId = pattern3[1];
      }
    }

    // Try pattern 4: Meeting ID in query params
    if (!meetingId) {
      const pattern4 = joinUrl.match(/[?&]confno=(\d+)/);
      if (pattern4) {
        meetingId = pattern4[1];
      }
    }

    if (!meetingId) {
      console.error("Failed to extract meeting ID from URL:", joinUrl);
      toast.error(`Could not extract meeting ID from URL: ${joinUrl}`);
      return;
    }

    console.log("Extracted meeting ID:", meetingId);
    setFetchingTranscripts((prev) => ({ ...prev, [sessionId]: true }));

    fetchTranscriptMutation.mutate({
      meetingId,
      sessionId,
    });
  };

  const handlePasteTranscript = (sessionId: number) => {
    const session = historySessions?.find((s) => s.id === sessionId);
    const studentName = [session?.studentFirstName, session?.studentLastName]
      .filter(Boolean).join(" ") || "Student";
    setTranscriptModal({
      sessionId,
      transcript: "",
      activeTab: "transcript",
      courseTitle: (session as any)?.courseTitle || (session as any)?.courseSubject || "Course",
      studentName,
      sessionDate: session?.scheduledAt ? new Date(session.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : undefined,
      courseId: session?.courseId ?? undefined,
      parentId: session?.parentId ?? undefined,
      quizEnabled: !!(session as any)?.courseQuizEnabled && !(session as any)?.hasQuiz,
      editable: true,
    });
  };

  const handleModalSummarize = () => {
    if (!transcriptModal?.transcript) return;
    summarizingInModalRef.current = true;
    setSummarizingInModal(true);
    // Capture grading context now (before async completes) so onSuccess can use it safely
    const wordCount = transcriptModal.transcript.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 300) {
      pendingGradeContextRef.current = {
        transcript: transcriptModal.transcript,
        sessionId: transcriptModal.sessionId,
        courseTitle: transcriptModal.courseTitle,
        studentName: transcriptModal.studentName,
      };
    } else {
      pendingGradeContextRef.current = null;
    }
    summarizeMutation.mutate({ text: transcriptModal.transcript, maxLength: 200, sessionDate: transcriptModal.sessionDate });
  };

  const handleUseThisSummary = () => {
    if (!transcriptModal?.summary) return;
    const { sessionId, summary } = transcriptModal;
    setSessionNotes((prev) => ({
      ...prev,
      [sessionId]: summary,
    }));
    setTranscriptModal(null);
    toast.success("Summary saved to session notes. Don't forget to save!");
  };

  const hiddenStorageKey = user ? `tutor_hidden_sessions_${user.id}` : "tutor_hidden_sessions";
  const [hiddenHistory, setHiddenHistory] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem(hiddenStorageKey);
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        return new Set(ids);
      }
    } catch (e) {
      console.warn("Failed to parse hidden sessions", e);
    }
    return new Set();
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(hiddenStorageKey);
      if (stored) {
        const ids = JSON.parse(stored) as number[];
        setHiddenHistory(new Set(ids));
      } else {
        setHiddenHistory(new Set());
      }
    } catch (e) {
      console.warn("Failed to load hidden sessions", e);
      setHiddenHistory(new Set());
    }
  }, [hiddenStorageKey]);

  const [historyTimePeriod, setHistoryTimePeriod] = useState<string>("all");
  const [historyStudentQuery, setHistoryStudentQuery] = useState("");
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 8;

  const historyMonthOptions = useMemo(() => {
    const monthSet = new Set<string>();
    (historySessions || []).forEach((s) => {
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
  }, [historySessions]);

  const filteredHistorySessions = useMemo(() => {
    const normalizedQuery = historyStudentQuery.trim().toLowerCase();
    const startMs = historyStartDate ? new Date(`${historyStartDate}T00:00:00`).getTime() : null;
    const endMs = historyEndDate ? new Date(`${historyEndDate}T23:59:59.999`).getTime() : null;
    const base = (historySessions || [])
      .filter((s) => !hiddenHistory.has(s.id))
      .filter((s) => s.scheduledAt <= Date.now())
      .filter((s) => {
        if (!normalizedQuery) return true;
        const studentName = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ").trim().toLowerCase();
        return studentName.includes(normalizedQuery);
      })
      .sort((a, b) => b.scheduledAt - a.scheduledAt);
    const rangeFiltered = base.filter((s) => {
      const scheduledAt = Number(s.scheduledAt);
      if (startMs != null && scheduledAt < startMs) return false;
      if (endMs != null && scheduledAt > endMs) return false;
      return true;
    });
    if (historyTimePeriod === "all") return rangeFiltered;
    const [y, m] = historyTimePeriod.split("-").map(Number);
    return rangeFiltered.filter((s) => {
      const d = new Date(s.scheduledAt);
      return d.getFullYear() === y && d.getMonth() + 1 === m;
    });
  }, [historySessions, hiddenHistory, historyStudentQuery, historyStartDate, historyEndDate, historyTimePeriod]);

  useEffect(() => {
    if (!availableCourses) return;
    const mapped: Record<number, PreferenceState> = {};
    for (const course of availableCourses) {
      const existing = coursePreferences?.find((p: any) => p.courseId === course.id);
      mapped[course.id] = {
        preferred: !!existing,
        hourlyRate: existing?.hourlyRate?.toString?.() ?? "",
        approvalStatus: existing?.approvalStatus,
      };
    }
    setPreferenceState(mapped);
  }, [availableCourses, coursePreferences]);

  const togglePreference = (courseId: number, preferred: boolean) => {
    setPreferenceState((prev) => {
      const current = prev[courseId] || { preferred: false, hourlyRate: "" };
      return {
        ...prev,
        [courseId]: {
          ...current,
          preferred,
          hourlyRate: preferred ? current.hourlyRate : "",
        },
      };
    });
  };

  const updateHourlyRate = (courseId: number, value: string) => {
    setPreferenceState((prev) => ({
      ...prev,
      [courseId]: {
        ...(prev[courseId] || { preferred: true, hourlyRate: "" }),
        hourlyRate: value,
      },
    }));
  };

  const handleSavePreferences = () => {
    const selected = Object.entries(preferenceState)
      .filter(([, pref]) => pref?.preferred)
      .map(([courseId, pref]) => ({
        courseId: Number(courseId),
        hourlyRate: Number(pref.hourlyRate || 0),
      }));

    const invalid = selected.find((p) => !p.hourlyRate || p.hourlyRate <= 0);
    if (invalid) {
      toast.error("Please enter an hourly rate greater than 0 for selected courses.");
      return;
    }

    savePreferencesMutation.mutate({ preferences: selected });
  };

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

      <div className="flex-1 mt-20">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-b border-border">
          <div className="container py-8">
            <h1 className="text-3xl font-bold mb-2">Tutor Dashboard</h1>
            <p className="text-muted-foreground">Manage your courses, students, and earnings</p>
          </div>
        </div>

        <div className="container py-8">
          {/* Check if tutor profile exists */}
          {!tutorProfile ? (
            <Card className="mb-8">
              <CardContent className="py-12 text-center">
                <h3 className="text-xl font-semibold mb-2">Complete Your Tutor Profile</h3>
                <p className="text-muted-foreground mb-6">
                  Create your profile to start offering courses
                </p>
                <Button onClick={() => {
                  // Create basic profile
                  createProfileMutation.mutate({
                    subjects: JSON.stringify([]),
                    gradeLevels: JSON.stringify([]),
                    hourlyRate: "0",
                  });
                  toast.success("Profile created! Please update your details.");
                }}>
                  Create Profile
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Overview Cards */}
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Active Courses</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-3xl font-bold">{activeCourses.length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Active Students</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Users className="w-5 h-5 text-accent" />
                      </div>
                      <span className="text-3xl font-bold">{uniqueActiveStudents}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Upcoming Sessions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-success" />
                      </div>
                      <span className="text-3xl font-bold">{upcomingSessions?.length || 0}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation("/session-notes")}>
                  <CardHeader className="pb-3">
                    <CardDescription>Session Notes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-purple-600" />
                      </div>
                      <span className="text-sm font-medium text-muted-foreground">View All Notes</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Main Content */}
              <Tabs defaultValue={tabFromUrl} className="space-y-6">
                <div className="overflow-x-auto">
              <TabsList className="inline-flex min-w-max gap-2 sm:w-full sm:flex-wrap sm:justify-start">
                <TabsTrigger className="whitespace-nowrap" value="courses">Courses</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="course-preferences">Course Preferences</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="students">Students</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="sessions">Sessions</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="history">History</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="my-files">My Files</TabsTrigger>
              </TabsList>
                </div>

                <div className="pt-6">
                {/* Courses Tab */}
                <TabsContent value="courses" forceMount className={tabContentClass}>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">My Courses</h2>
                  </div>

                  {coursesLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map(i => <Skeleton key={i} className="h-48 w-full" />)}
                    </div>
                  ) : courses && courses.length > 0 ? (
                    <div className="grid md:grid-cols-2 gap-6">
                      {courses.map((course) => (
                        <Card key={course.id} className="hover:shadow-elegant transition-all">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg mb-2">{course.title}</CardTitle>
                                <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                              </div>
                              <Badge variant={course.isActive ? "default" : "secondary"}>
                                {course.isActive ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="flex gap-2">
                              <Badge variant="secondary">{course.subject}</Badge>
                              {course.gradeLevel && <Badge variant="outline">{course.gradeLevel}</Badge>}
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Price</p>
                                <p className="font-semibold text-lg">{formatPrice(course.price)}</p>
                              </div>
                              {course.duration && (
                                <div>
                                  <p className="text-muted-foreground">Duration</p>
                                  <p className="font-medium">{course.duration} min</p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                              <div>
                                <p className="text-sm font-medium">Quiz Generation</p>
                                <p className="text-xs text-muted-foreground">Allow quiz creation from transcripts</p>
                              </div>
                              <Checkbox
                                checked={course.quizEnabled ?? false}
                                onCheckedChange={(checked) =>
                                  toggleCourseQuizMutation.mutate({ courseId: course.id, enabled: !!checked })
                                }
                                disabled={toggleCourseQuizMutation.isPending}
                              />
                            </div>

                            <Button asChild variant="outline" size="sm" className="w-full">
                              <Link href={`/course/${course.id}`}>
                                View Course
                              </Link>
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-6">
                      No courses available yet. Please check back later.
                    </div>
                  )}
                </TabsContent>

                {/* Course Preferences Tab */}
                <TabsContent value="course-preferences" forceMount className={tabContentClass}>
                  <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
                    <h2 className="text-2xl font-bold">My Course Preferences</h2>
                    <Button
                      onClick={handleSavePreferences}
                      disabled={savePreferencesMutation.isPending || preferencesLoading || availableCoursesLoading}
                    >
                      {savePreferencesMutation.isPending ? "Saving..." : "Save Preferences"}
                    </Button>
                  </div>

                  <Card>
                    <CardContent className="pt-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Select the courses you want to teach and set your hourly rate for each selected course.
                        New or updated preferences will be reviewed by an admin.
                      </p>

                      {/* Search and Filter Controls */}
                      {availableCourses && availableCourses.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row gap-3">
                            {/* Search Bar */}
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="Search courses by title, subject, or grade..."
                                value={courseSearchQuery}
                                onChange={(e) => setCourseSearchQuery(e.target.value)}
                                className="pl-9 pr-9"
                              />
                              {courseSearchQuery && (
                                <button
                                  onClick={() => setCourseSearchQuery("")}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>

                            {/* Subject Filter */}
                            <Select value={courseSubjectFilter} onValueChange={setCourseSubjectFilter}>
                              <SelectTrigger className="w-full sm:w-[200px]">
                                <SelectValue placeholder="Filter by subject" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {availableSubjects.map((subject) => (
                                  <SelectItem key={subject} value={subject}>
                                    {subject}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Show Only Selected Toggle */}
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id="show-only-selected"
                              checked={showOnlySelected}
                              onCheckedChange={(checked) => setShowOnlySelected(Boolean(checked))}
                            />
                            <Label htmlFor="show-only-selected" className="text-sm font-normal cursor-pointer">
                              Show only selected courses
                            </Label>
                          </div>

                          {/* Results count */}
                          <div className="text-sm text-muted-foreground">
                            Showing {filteredCourses.length} of {availableCourses.length} courses
                          </div>
                        </div>
                      )}

                      {preferencesLoading || availableCoursesLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : filteredCourses && filteredCourses.length > 0 ? (
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                          {filteredCourses.map((course: any) => {
                            const pref = preferenceState[course.id] || { preferred: false, hourlyRate: "" };
                            const status = pref.approvalStatus || "PENDING";
                            const statusVariant =
                              status === "APPROVED" ? "default" : status === "REJECTED" ? "destructive" : "secondary";

                            return (
                              <div
                                key={course.id}
                                className="grid gap-4 md:grid-cols-12 items-start border rounded-lg p-3"
                              >
                                <div className="md:col-span-5 flex items-start gap-3 min-w-0">
                                  <Checkbox
                                    checked={pref.preferred}
                                    onCheckedChange={(checked) => togglePreference(course.id, Boolean(checked))}
                                  />
                                  <div>
                                    <p className="font-semibold leading-tight break-words">{course.title}</p>
                                    <p className="text-sm text-muted-foreground break-words">
                                      {course.subject}
                                      {course.gradeLevel ? ` • ${course.gradeLevel}` : ""}
                                    </p>
                                  </div>
                                </div>

                                <div className="md:col-span-3">
                                  <Label className="text-xs text-muted-foreground">Hourly Rate (USD)</Label>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={pref.hourlyRate}
                                    disabled={!pref.preferred}
                                    onChange={(e) => updateHourlyRate(course.id, e.target.value)}
                                  />
                                </div>

                                <div className="md:col-span-2">
                                  {pref.preferred && (
                                    <div className="flex items-center gap-2">
                                      <Badge variant={statusVariant as any}>{status}</Badge>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : availableCourses && availableCourses.length > 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <p className="mb-4">No courses match your current filters.</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {courseSearchQuery && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCourseSearchQuery("")}
                              >
                                Clear search
                              </Button>
                            )}
                            {courseSubjectFilter !== "all" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCourseSubjectFilter("all")}
                              >
                                Clear subject filter
                              </Button>
                            )}
                            {showOnlySelected && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowOnlySelected(false)}
                              >
                                Show all courses
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-6">
                          No courses available yet. Please check back later.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Students Tab */}
                <TabsContent value="students" forceMount className={tabContentClass}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <h2 className="text-2xl font-bold">My Students</h2>

                    {/* Year Filter Dropdown */}
                    {availableYears.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by year" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Years</SelectItem>
                            {availableYears.map((year) => (
                              <SelectItem key={year} value={year.toString()}>
                                {year}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {subsLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                    </div>
                  ) : filteredSubscriptions && filteredSubscriptions.length > 0 ? (
                    <div className="space-y-4">
                      {filteredSubscriptions.map(({ subscription, course, parent, sessionStats }) => {
                        // Calculate course duration and progress
                        const totalSessions = course.totalSessions || 0;
                        const sessionsPerWeek = course.sessionsPerWeek || 1;
                        const completedCount = sessionStats?.completedCount || 0;
                        const scheduledCount = sessionStats?.scheduledCount || 0;
                        const remainingSessions = totalSessions - completedCount - scheduledCount;

                        // Course start date: first session date or subscription created date
                        const startDate = sessionStats?.firstSessionDate
                          ? new Date(sessionStats.firstSessionDate)
                          : subscription.createdAt ? new Date(subscription.createdAt) : null;

                        // Calculate tentative end date based on sessionsPerWeek
                        let tentativeEndDate = null;
                        let isTentative = true;
                        if (startDate && totalSessions > 0) {
                          const weeksNeeded = Math.ceil(totalSessions / sessionsPerWeek);
                          tentativeEndDate = new Date(startDate);
                          tentativeEndDate.setDate(tentativeEndDate.getDate() + (weeksNeeded * 7));
                        }

                        // If all sessions are scheduled, use last scheduled date as actual end
                        if (sessionStats?.lastScheduledDate && remainingSessions <= 0) {
                          tentativeEndDate = new Date(sessionStats.lastScheduledDate);
                          isTentative = false;
                        }

                        // Format dates
                        const formatDate = (date: Date | null) => {
                          if (!date) return "N/A";
                          return date.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          });
                        };

                        // Determine status badge
                        let statusBadge = null;
                        if (remainingSessions > 0 && completedCount === 0 && scheduledCount === 0) {
                          statusBadge = <Badge variant="outline">Pending Sessions</Badge>;
                        } else if (remainingSessions === 0 && scheduledCount === 0) {
                          statusBadge = <Badge variant="default">Completed</Badge>;
                        } else {
                          statusBadge = <Badge variant="secondary">In Progress</Badge>;
                        }

                        // Calculate enrollment year for badge
                        const enrollDate = subscription.startDate || subscription.createdAt;
                        const enrollYear = enrollDate ? new Date(enrollDate).getFullYear() : null;
                        const progressValue = (subscription.progressStatus as ProgressStatusValue) ?? null;
                        const progressSuggestion = progressSuggestionBySubscriptionId.get(subscription.id) ?? null;
                        const studentNameForModal = subscription.studentFirstName || subscription.studentLastName
                          ? `${subscription.studentFirstName ?? ""} ${subscription.studentLastName ?? ""}`.trim()
                          : "Student";

                        return (
                          <Card key={subscription.id}>
                            <CardContent className="pt-6">
                              <div className="flex flex-col gap-4">
                                {/* Student info and status */}
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="font-semibold">
                                        {subscription.studentFirstName || subscription.studentLastName
                                          ? `${subscription.studentFirstName ?? ""} ${subscription.studentLastName ?? ""}`.trim()
                                          : "Student"}
                                      </p>
                                      {enrollYear && (
                                        <Badge variant="outline" className="text-xs">
                                          Enrolled {enrollYear}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">{course.title}</p>
                                  </div>
                                  <div className="flex items-center gap-3 flex-wrap justify-end">
                                    {statusBadge}
                                    <Button asChild variant="outline" size="sm">
                                      <Link href="/messages" className="flex items-center gap-2">
                                        <MessageSquare className="w-4 h-4" />
                                        Message
                                      </Link>
                                    </Button>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                  <div className="space-y-4">
                                    {/* Course duration */}
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">Duration:</span>
                                        <span>
                                          {formatDate(startDate)} - {formatDate(tentativeEndDate)}
                                          {isTentative && tentativeEndDate && (
                                            <span className="text-xs text-muted-foreground ml-1">(tentative)</span>
                                          )}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="text-sm text-muted-foreground">
                                      Progress: {completedCount} completed, {scheduledCount} scheduled
                                      {remainingSessions > 0 && `, ${remainingSessions} remaining`}
                                      {totalSessions > 0 && ` (${completedCount + scheduledCount}/${totalSessions})`}
                                    </div>
                                  </div>
                                  <div className="w-full lg:w-auto lg:min-w-[420px] rounded-2xl border bg-slate-50/80 px-3 py-2 shadow-sm">
                                    <div className="flex flex-col items-end gap-2">
                                      <div className="w-full space-y-0.5 text-right">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600">Progress Status</p>
                                        <p className="text-[11px] text-muted-foreground">Drag to update the parent-facing proficiency status.</p>
                                      </div>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div>
                                            <ProgressStatusMiniSlider
                                              value={progressValue}
                                              disabled={updateProgressStatusMutation.isPending}
                                              onCommit={(next) => {
                                                updateProgressStatusMutation.mutate({
                                                  id: subscription.id,
                                                  progressStatus: next,
                                                });
                                              }}
                                            />
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" sideOffset={8} className="max-w-72 space-y-1.5">
                                          <p>Use this slider to set the student&apos;s shared progress status.</p>
                                          <p className="font-semibold">
                                            Suggested: {progressSuggestion?.suggested ? progressStatusLabel(progressSuggestion.suggested) : "Not enough data"}
                                          </p>
                                          <p>
                                            Current: {progressStatusLabel(progressValue)}
                                          </p>
                                          {progressSuggestion?.suggested ? (
                                            <>
                                              <p>
                                                Avg score {progressSuggestion.avgOverallScore != null ? `${progressSuggestion.avgOverallScore}/4` : "n/a"} • Participation {progressSuggestion.avgParticipationPct != null ? `~${progressSuggestion.avgParticipationPct}%` : "n/a"}
                                              </p>
                                              <p>
                                                Critical thinking {progressSuggestion.ctMode ?? "n/a"} • Last {progressSuggestion.usedCount} completed session{progressSuggestion.usedCount === 1 ? "" : "s"}
                                              </p>
                                            </>
                                          ) : (
                                            <p>Need completed sessions with grading or engagement data to suggest a status.</p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex justify-end w-full">
                                            <Button
                                              type="button"
                                              size="sm"
                                              className={[
                                                "h-9 max-w-full justify-between rounded-xl px-3 text-[12px] font-semibold shadow-sm transition-colors",
                                                progressSuggestion?.suggested
                                                  ? "border border-blue-200 bg-blue-600 text-white hover:bg-blue-700"
                                                  : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                                              ].join(" ")}
                                              disabled={updateProgressStatusMutation.isPending}
                                              onClick={() => {
                                                setProgressSuggestionModal({
                                                  subscriptionId: subscription.id,
                                                  studentName: studentNameForModal,
                                                  courseTitle: course.title,
                                                });
                                              }}
                                            >
                                              <span className="flex items-center">
                                                <Sparkles className="w-3.5 h-3.5 mr-2" />
                                                {progressSuggestion?.suggested ? `Review Suggested: ${progressStatusLabel(progressSuggestion.suggested)}` : "Review Suggested Status"}
                                              </span>
                                              <span className="text-[11px] opacity-90">Details</span>
                                            </Button>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" sideOffset={8} className="max-w-72 space-y-1.5">
                                          <p className="font-semibold">
                                            {progressSuggestion?.suggested ? `View details for ${progressStatusLabel(progressSuggestion.suggested)}` : "Suggested status unavailable"}
                                          </p>
                                          {progressSuggestion?.suggested ? (
                                            <>
                                              <p>Open the modal to review the evidence and apply the suggested status.</p>
                                              <p>
                                                Avg score {progressSuggestion.avgOverallScore != null ? `${progressSuggestion.avgOverallScore}/4` : "n/a"} • Participation {progressSuggestion.avgParticipationPct != null ? `~${progressSuggestion.avgParticipationPct}%` : "n/a"}
                                              </p>
                                              <p>
                                                Critical thinking {progressSuggestion.ctMode ?? "n/a"} • Last {progressSuggestion.usedCount} completed session{progressSuggestion.usedCount === 1 ? "" : "s"}
                                              </p>
                                            </>
                                          ) : (
                                            <p>Need completed sessions with grading or engagement data to generate a suggestion.</p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mb-2">
                          {selectedYear !== "all" && subscriptions && subscriptions.length > 0
                            ? `No Students Enrolled in ${selectedYear}`
                            : "No Students Yet"}
                        </h3>
                        <p className="text-muted-foreground">
                          {selectedYear !== "all" && subscriptions && subscriptions.length > 0
                            ? `No students enrolled in ${selectedYear}. Try selecting a different year or "All Years".`
                            : "Students who enroll in your courses will appear here"}
                        </p>
                        {selectedYear !== "all" && subscriptions && subscriptions.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedYear("all")}
                            className="mt-4"
                          >
                            View All Years
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Sessions Tab */}
                <TabsContent value="sessions" forceMount className={tabContentClass}>
                  <div className="mb-6">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-4">Upcoming Sessions</h2>

                    {/* Timezone Indicator Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-sm bg-blue-50/50 dark:bg-blue-950/20 rounded-md p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <span className="font-semibold text-blue-900 dark:text-blue-100">Your Time Zone:</span>
                      </div>
                      <span className="text-blue-800 dark:text-blue-200 font-medium ml-7 sm:ml-0">
                        {timezoneFriendlyName} ({timezoneAbbr})
                      </span>
                      <span className="text-xs text-blue-700/70 dark:text-blue-300/70 ml-7 sm:ml-auto">
                        All times shown in your local timezone
                      </span>
                    </div>
                  </div>

                  <TutorSessionsManager
                    upcomingSessions={upcomingSessions || []}
                    sessionNotes={sessionNotes}
                    setSessionNotes={setSessionNotes}
                    handleOpenCompletionDialog={handleOpenCompletionDialog}
                    updateSessionMutation={updateSessionMutation}
                    canComplete={canComplete}
                    statusVariant={statusVariant}
                    tutorTimezone={tutorTimezone}
                  />
                </TabsContent>

                {/* History Tab */}
                <TabsContent value="history" forceMount className={tabContentClass}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                    <h2 className="text-2xl font-bold">Session History</h2>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="relative">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                          value={historyStudentQuery}
                          onChange={(e) => { setHistoryStudentQuery(e.target.value); setHistoryPage(1); }}
                          placeholder="Search student name"
                          className="w-full sm:w-52 pl-9"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="tutor-history-time" className="text-sm whitespace-nowrap">Time Period</Label>
                        <Select value={historyTimePeriod} onValueChange={(v) => { setHistoryTimePeriod(v); setHistoryPage(1); }}>
                          <SelectTrigger id="tutor-history-time" className="w-44">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {historyMonthOptions.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        type="date"
                        value={historyStartDate}
                        onChange={(e) => { setHistoryStartDate(e.target.value); setHistoryPage(1); }}
                        className="w-full sm:w-40"
                        aria-label="History start date"
                      />
                      <Input
                        type="date"
                        value={historyEndDate}
                        onChange={(e) => { setHistoryEndDate(e.target.value); setHistoryPage(1); }}
                        className="w-full sm:w-40"
                        aria-label="History end date"
                      />
                      {(historyStudentQuery || historyStartDate || historyEndDate || historyTimePeriod !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setHistoryStudentQuery("");
                            setHistoryStartDate("");
                            setHistoryEndDate("");
                            setHistoryTimePeriod("all");
                            setHistoryPage(1);
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>

                  {historyLoading ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                    </div>
                  ) : filteredHistorySessions.length > 0 ? (
                    <div className="space-y-4">
                      {filteredHistorySessions
                        .slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE)
                        .map((session) => {
                          const noteRaw =
                            sessionNotes[session.id] ?? session.feedbackFromTutor ?? "";
                          const noteValue = noteRaw.replace(/\*\*(.+?)\*\*/g, '$1');
                          const markComplete = () =>
                            updateSessionMutation.mutate({ id: session.id, status: "completed" });
                          const saveNotes = () =>
                            updateSessionMutation.mutate({ id: session.id, feedbackFromTutor: noteRaw });

                          return (
                            <Card key={session.id}>
                              <CardContent className="pt-4 sm:pt-6 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="font-semibold text-sm sm:text-base truncate">
                                        {session.courseTitle || session.courseSubject || "Course"}
                                      </p>
                                      <p className="text-xs sm:text-sm text-muted-foreground">
                                        {(() => {
                                          const { date, time } = formatSessionDateTime(session.scheduledAt);
                                          return `${date} • ${time} • ${session.duration} min`;
                                        })()}
                                      </p>
                                      <p className="text-xs sm:text-sm text-muted-foreground">
                                        {(session.studentFirstName || session.studentLastName)
                                          ? `Student: ${[session.studentFirstName, session.studentLastName].filter(Boolean).join(" ")}`
                                          : null}
                                        {(session.studentFirstName || session.studentLastName) && session.parentName ? " • " : null}
                                        {session.parentName ? `Parent: ${session.parentName}` : null}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-2">
                                    <Badge variant={statusVariant(session.status)} className="text-xs">
                                      {session.status === "no_show" ? "No Show" : session.status}
                                    </Badge>
                                    {session.isTrial && (
                                      <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/20">
                                        Trial Lesson
                                      </Badge>
                                    )}
                                    {tutorGradeBySessionId.has(session.id) && (() => {
                                      const g = tutorGradeBySessionId.get(session.id)!;
                                      const score = g.rubricOverallScore != null ? Number(g.rubricOverallScore) : null;
                                      const label = score == null ? "Graded" : score >= 3.5 ? "Excellent" : score >= 2.5 ? "Proficient" : score >= 1.5 ? "Developing" : "Needs Support";
                                      const color = score == null ? "bg-muted text-muted-foreground" : score >= 3.5 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : score >= 2.5 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : score >= 1.5 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300";
                                      return (
                                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
                                          <Sparkles className="w-2.5 h-2.5 shrink-0" />
                                          {score != null ? `${score.toFixed(1)}/4` : ""} {label}
                                        </span>
                                      );
                                    })()}
                                    {session.status !== "cancelled" && session.status !== "completed" && session.status !== "no_show" && (
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
                                    )}
                                  </div>
                                </div>

                                {canComplete(session) && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenCompletionDialog(session.id, session.feedbackFromTutor, session.joinUrl)}
                                    disabled={updateSessionMutation.isPending}
                                  >
                                    Complete Session
                                  </Button>
                                )}

                                {session.status === "completed" && (
                                  <>
                                    {/* Session Notes Section */}
                                    <div className="mt-4 p-3 sm:p-4 rounded-lg border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                                      <div className="flex items-start gap-3">
                                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                        <div className="flex-1 space-y-2">
                                          <Label className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                                            Session Notes
                                          </Label>
                                        <Textarea
                                          value={noteValue}
                                          onChange={(e) =>
                                            setSessionNotes((prev) => ({
                                              ...prev,
                                              [session.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="What did you cover today? How did the student perform? Any homework assigned?"
                                          className="bg-white dark:bg-gray-900 min-h-[100px] text-sm"
                                        />
                                        <div className="flex flex-wrap gap-2">
                                          <Button size="sm" onClick={saveNotes} disabled={updateSessionMutation.isPending}>
                                            <FileText className="w-3 h-3 mr-1" />
                                            Save Notes
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleFetchTranscript(session.id, session.joinUrl)}
                                            disabled={fetchingTranscripts[session.id] || false}
                                          >
                                            <FileText className="w-3 h-3 mr-1" />
                                            {fetchingTranscripts[session.id] ? "Fetching..." : "Fetch Transcript"}
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handlePasteTranscript(session.id)}
                                          >
                                            <ClipboardPaste className="w-3 h-3 mr-1" />
                                            Paste Transcript
                                          </Button>
                                          {/* Only show Summarize button if session hasn't been AI-processed */}
                                          {!aiProcessedSessions.has(session.id) && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleSummarize(session.id, noteValue)}
                                              disabled={summarizingSessionId === session.id || !noteValue || noteValue.trim().length < 10}
                                            >
                                              {summarizingSessionId === session.id ? (
                                                <>
                                                  <span className="animate-spin mr-2">⚡</span>
                                                  Summarizing...
                                                </>
                                              ) : (
                                                <>
                                                  <Sparkles className="w-3 h-3 mr-1" />
                                                  Summarize
                                                </>
                                              )}
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  </>
                                )}

                                {session.status === "no_show" && (
                                  <div className="mt-4 p-3 sm:p-4 rounded-lg border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                                    <div className="flex items-start gap-3">
                                      <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                      <div className="flex-1 space-y-2">
                                        <Label className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                          No-Show Notes
                                        </Label>
                                        <p className="text-xs text-amber-700 dark:text-amber-300">
                                          These notes are visible to the parent and student
                                        </p>
                                        <Textarea
                                          value={noteValue}
                                          onChange={(e) =>
                                            setSessionNotes((prev) => ({
                                              ...prev,
                                              [session.id]: e.target.value,
                                            }))
                                          }
                                          placeholder="Add notes for the student (e.g., homework, materials to review)"
                                          className="bg-white dark:bg-gray-900 min-h-[100px] text-sm"
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={saveNotes}
                                            disabled={
                                              updateSessionMutation.isPending ||
                                              noteValue === (session.feedbackFromTutor ?? "")
                                            }
                                          >
                                            <FileText className="w-3 h-3 mr-1" />
                                            Save Notes
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleSummarize(session.id, noteValue)}
                                            disabled={summarizingSessionId === session.id || !noteValue || noteValue.trim().length < 10}
                                          >
                                            {summarizingSessionId === session.id ? (
                                              <>
                                                <span className="animate-spin mr-2">⚡</span>
                                                Summarizing...
                                              </>
                                            ) : (
                                              <>
                                                <Sparkles className="w-3 h-3 mr-1" />
                                                Summarize
                                              </>
                                            )}
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {(session as any).hasQuiz && (
                                  <div className="mt-2">
                                    {(session as any).quizStatus === "completed" ? (
                                      <div className={`flex items-center gap-1.5 text-sm ${(session as any).quizScore == null || (session as any).quizScore >= 70 ? "text-green-600 dark:text-green-400" : (session as any).quizScore >= 40 ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400"}`}>
                                        <CheckCircle className="w-4 h-4" />
                                        <span>Quiz completed</span>
                                        {(session as any).quizScore != null && (
                                          <span className="font-semibold">
                                            · {(session as any).quizScore}% ({(session as any).quizCorrectCount}/{(session as any).quizTotalCount})
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
                                        <HelpCircle className="w-4 h-4" />
                                        <span>Quiz assigned — pending</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Engagement Breakdown */}
                                {tutorGradeBySessionId.has(session.id) && (() => {
                                  const gEng = tutorGradeBySessionId.get(session.id)!;
                                  const eng = (gEng as any).rubricEngagementData as {
                                    studentParticipationRate?: string;
                                    studentRole?: string;
                                    studentCriticalThinking?: string;
                                    tutorParticipationRate?: string;
                                    tutorRole?: string;
                                    tutorInstructionalStyle?: string;
                                  } | null;
                                  if (!eng) return null;
                                  const isEngExpanded = expandedEngagement.has(session.id);
                                  const studentName = (session as any).studentFirstName || "Student";
                                  const tutorNameLabel = (session as any).tutorName || "Tutor";
                                  const ctLevel = eng.studentCriticalThinking?.split(".")[0]?.trim() || "";
                                  const ctBadge = ctLevel === "High" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : ctLevel === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : ctLevel === "Low" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-muted text-muted-foreground";
                                  const parseParticipationPct = (rate?: string) => { const match = rate?.match(/(\d+(?:\.\d+)?)/); return match ? parseFloat(match[1]) : null; };
                                  const extractPctDisplay = (rate?: string) => { const match = rate?.match(/~?\d+(?:\.\d+)?%/); return match ? match[0] : rate; };
                                  const studentPct = parseParticipationPct(eng.studentParticipationRate);
                                  const tutorPct = parseParticipationPct(eng.tutorParticipationRate);
                                  return (
                                    <div className="mt-3 rounded-xl border border-border/60 overflow-hidden shadow-sm">
                                      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                          <svg className="w-3.5 h-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                                          <span className="text-xs font-semibold text-sky-700 dark:text-sky-300 uppercase tracking-wide">Engagement Breakdown</span>
                                        </div>
                                        <button onClick={() => toggleEngagementExpand(session.id)} className="flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-200 font-medium transition-colors">
                                          {isEngExpanded ? "Hide" : "View"}
                                          <svg className={`w-3 h-3 transition-transform ${isEngExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                      </div>
                                      {isEngExpanded && (
                                        <div className="px-4 py-3 space-y-4 bg-background divide-y divide-border/40">
                                          <div className="space-y-2.5">
                                            <p className="text-xs font-semibold text-foreground">Student Engagement · {studentName}</p>
                                            {eng.studentParticipationRate && (
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-muted-foreground">Participation</span>
                                                  <span className="text-xs font-medium">{eng.studentParticipationRate}</span>
                                                </div>
                                                {studentPct !== null && <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-sky-400 transition-all" style={{ width: `${Math.min(studentPct, 100)}%` }} /></div>}
                                              </div>
                                            )}
                                            {eng.studentRole && <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Role</p><p className="text-xs text-foreground/80 leading-relaxed">{eng.studentRole}</p></div>}
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
                                          <div className="space-y-2.5 pt-3">
                                            <p className="text-xs font-semibold text-foreground">Tutor Engagement · {tutorNameLabel}</p>
                                            {eng.tutorParticipationRate && (
                                              <div className="space-y-1">
                                                <div className="flex items-center justify-between">
                                                  <span className="text-xs text-muted-foreground">Participation</span>
                                                  <span className="text-xs font-medium">{eng.tutorParticipationRate}</span>
                                                </div>
                                                {tutorPct !== null && <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden"><div className="h-1.5 rounded-full bg-violet-400 transition-all" style={{ width: `${Math.min(tutorPct, 100)}%` }} /></div>}
                                              </div>
                                            )}
                                            {eng.tutorRole && <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Role</p><p className="text-xs text-foreground/80 leading-relaxed">{eng.tutorRole}</p></div>}
                                            {eng.tutorInstructionalStyle && <div><p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Instructional Style</p><p className="text-xs text-foreground/80 leading-relaxed">{eng.tutorInstructionalStyle}</p></div>}
                                          </div>
                                        </div>
                                      )}
                                      {!isEngExpanded && (
                                        <div className="px-4 py-2.5 bg-background flex items-center gap-4">
                                          {eng.studentParticipationRate && <span className="text-xs text-muted-foreground">{studentName}: <span className="font-medium text-sky-600 dark:text-sky-400">{extractPctDisplay(eng.studentParticipationRate)}</span></span>}
                                          {eng.tutorParticipationRate && <span className="text-xs text-muted-foreground">{tutorNameLabel}: <span className="font-medium text-violet-600 dark:text-violet-400">{extractPctDisplay(eng.tutorParticipationRate)}</span></span>}
                                          {ctLevel && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-auto ${ctBadge}`}>{ctLevel} Critical Thinking</span>}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}

                                {/* Rubric Grade Detail */}
                                {tutorGradeBySessionId.has(session.id) && (() => {
                                  const g = tutorGradeBySessionId.get(session.id)!;
                                  const score = g.rubricOverallScore != null ? Number(g.rubricOverallScore) : null;
                                  const isExpanded = expandedGrades.has(session.id);
                                  const evidence: { criterion: string; score: number; evidence: string }[] = Array.isArray(g.rubricEvidence) ? g.rubricEvidence as any : [];
                                  if (score == null && evidence.length === 0) return null;
                                  const scoreLabel = score == null ? null : score >= 3.5 ? "Excellent" : score >= 2.5 ? "Proficient" : score >= 1.5 ? "Developing" : "Needs Support";
                                  const scoreText = score == null ? "text-muted-foreground" : score >= 3.5 ? "text-emerald-600 dark:text-emerald-400" : score >= 2.5 ? "text-blue-600 dark:text-blue-400" : score >= 1.5 ? "text-amber-500 dark:text-amber-400" : "text-red-500 dark:text-red-400";
                                  return (
                                    <div className="mt-4 rounded-xl border border-border/60 overflow-hidden shadow-sm">
                                      {/* Header */}
                                      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                                          <span className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wide">Session Grade</span>
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
                                        {/* Overall score row */}
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
                                          {/* Mini pills */}
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

                                        {/* Expanded criterion detail */}
                                        {isExpanded && evidence.length > 0 && (
                                          <div className="space-y-2.5 pt-1 border-t border-border/40">
                                            {evidence.map((e) => {
                                              const bar = e.score === 4 ? "bg-emerald-500" : e.score === 3 ? "bg-blue-500" : e.score === 2 ? "bg-amber-400" : "bg-red-500";
                                              const label = e.score === 4 ? "Exceeds" : e.score === 3 ? "Proficient" : e.score === 2 ? "Developing" : "Support";
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
                                                    <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 leading-relaxed">"{e.evidence}"</p>
                                                  )}
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {/* Transcript quality warning */}
                                        {g.rubricTranscriptQuality === "low" && (
                                          <div className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5">
                                            <span className="text-amber-500 shrink-0 text-xs mt-0.5">⚠️</span>
                                            <p className="text-xs text-amber-700 dark:text-amber-400">Grade may be inaccurate — {g.rubricTranscriptQualityReason || "transcript had audio gaps"}</p>
                                          </div>
                                        )}

                                        <p className="text-[10px] text-muted-foreground/70 italic border-t border-border/30 pt-2">
                                          AI-assisted quality signal based on session transcript.
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })()}

                                {(session.status === "cancelled" || session.status === "completed" || session.status === "no_show") && (
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setHiddenHistory((prev) => {
                                          const next = new Set(prev);
                                          next.add(session.id);
                                          try {
                                            localStorage.setItem(hiddenStorageKey, JSON.stringify(Array.from(next)));
                                          } catch (e) {
                                            console.warn("Failed to persist hidden sessions", e);
                                          }
                                          return next;
                                        });
                                      }}
                                    >
                                      Remove from history
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          );
                        })}
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
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mb-2">No Past Sessions</h3>
                        <p className="text-muted-foreground">
                          Completed or past sessions will appear here.
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* My Files Tab */}
                <TabsContent value="my-files" forceMount className={tabContentClass}>
                  <TutorFilesPanel tutorId={tutorProfile?.userId ?? 0} />
                </TabsContent>

                </div>
              </Tabs>
            </>
          )}
        </div>
      </div>

      {/* Session Completion Dialog */}
      <Dialog open={completionDialogOpen} onOpenChange={setCompletionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Complete Session</DialogTitle>
            <DialogDescription>
              Mark this session as completed or record if the student did not show up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Completion Type Selection */}
            <RadioGroup value={completionType} onValueChange={(value: any) => setCompletionType(value)}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <RadioGroupItem value="completed" id="completed" />
                <Label htmlFor="completed" className="flex-1 cursor-pointer">
                  <div className="font-medium">Session Completed Successfully</div>
                  <div className="text-sm text-muted-foreground">Student attended and session was conducted</div>
                </Label>
              </div>

              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent cursor-pointer">
                <RadioGroupItem value="no_show" id="no_show" />
                <Label htmlFor="no_show" className="flex-1 cursor-pointer">
                  <div className="font-medium">Student No-Show</div>
                  <div className="text-sm text-muted-foreground">Student did not attend the session</div>
                </Label>
              </div>
            </RadioGroup>

            {/* Session Notes - Shown for both completed and no-show */}
            <div className="space-y-2">
              <Label htmlFor="notes">
                {completionType === "completed" ? "Session Notes" : "No-Show Notes (Optional)"}
              </Label>
              <p className="text-sm text-muted-foreground">
                {completionType === "completed"
                  ? "These notes will be visible to the parent"
                  : "Add any notes about the no-show (e.g., homework for next session, materials to review)"}
              </p>
              <Textarea
                id="notes"
                placeholder={
                  completionType === "completed"
                    ? "Add notes or summary about the session..."
                    : "E.g., Please complete Chapter 5 exercises before the next session..."
                }
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* No-show information */}
            {completionType === "no_show" && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  <strong>Note:</strong> Parents will be notified of the no-show. Any notes you add will be included in the notification email.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompleteSession} disabled={updateSessionMutation.isPending}>
              {completionType === "completed" ? "Mark as Completed" : "Record No-Show"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReferralCouponPopup />

      {transcriptModal && (
        <Dialog open={true} onOpenChange={() => setTranscriptModal(null)}>
          <DialogContent className="w-full max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden p-0 mx-2 sm:mx-auto">
            <div className="shrink-0 px-4 sm:px-6 pt-5 sm:pt-6 pb-0">
            <DialogHeader className="mb-1">
              <DialogTitle className="text-lg sm:text-xl leading-tight">Session Transcript</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mt-1 mb-4 leading-snug">
              {transcriptModal.courseTitle} &bull; {transcriptModal.studentName}
            </p>
            </div>
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden px-4 sm:px-6 pb-0">

            <Tabs
              value={transcriptModal.activeTab}
              onValueChange={(v) =>
                setTranscriptModal((prev) => prev ? { ...prev, activeTab: v as "transcript" | "quiz" } : prev)
              }
              className="flex-1 flex flex-col min-h-0"
            >
              <TabsList className="w-full shrink-0 h-auto flex-wrap gap-1 sm:flex-nowrap">
                <TabsTrigger value="transcript" className="flex-1 text-xs sm:text-sm py-1.5 min-w-0">Transcript / Summary</TabsTrigger>
                {transcriptModal.quizEnabled && (
                  <TabsTrigger value="quiz" className="flex-1 text-xs sm:text-sm py-1.5 min-w-0">Quiz</TabsTrigger>
                )}
              </TabsList>

              {/* Transcript Tab */}
              <TabsContent value="transcript" className="flex-1 flex flex-col gap-4 min-h-0 mt-4 overflow-y-auto pr-1">
                {transcriptModal.editable ? (
                  <Textarea
                    value={transcriptModal.transcript}
                    onChange={(e) => setTranscriptModal((prev) => prev ? { ...prev, transcript: e.target.value } : prev)}
                    placeholder="Paste your transcript here..."
                    className="flex-1 min-h-[200px] text-sm font-mono resize-none"
                  />
                ) : (
                  <div className="overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-48">
                    {transcriptModal.transcript || "No transcript content."}
                  </div>
                )}

                {!transcriptModal.summary ? (
                  <Button
                    onClick={handleModalSummarize}
                    disabled={summarizingInModal}
                    variant="outline"
                    className="self-start shrink-0"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {summarizingInModal ? "Summarizing..." : "Summarize"}
                  </Button>
                ) : (
                  <div className="space-y-3 shrink-0">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground mb-1 block">Summary</Label>
                      <div className="overflow-y-auto rounded-md border bg-primary/5 p-3 text-sm max-h-48 whitespace-pre-wrap">
                        {renderBoldMarkdown(transcriptModal.summary)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleUseThisSummary} size="sm">
                        Save to Notes
                      </Button>
                      <Button
                        onClick={handleModalSummarize}
                        disabled={summarizingInModal}
                        variant="outline"
                        size="sm"
                      >
                        {summarizingInModal ? "Regenerating..." : "Regenerate"}
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Quiz Tab */}
              {transcriptModal.quizEnabled && (
                <TabsContent value="quiz" className="flex-1 flex flex-col gap-4 min-h-0 mt-4 overflow-y-auto">
                  {!transcriptModal.quizQuestions ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-3">
                      <p className="text-sm text-muted-foreground text-center">
                        Generate an MCQ quiz based on this session's transcript.
                      </p>
                      <Button
                        onClick={() => {
                          setGeneratingQuiz(true);
                          generateQuizMutation.mutate({
                            transcript: transcriptModal.transcript,
                            sessionId: transcriptModal.sessionId,
                            courseName: transcriptModal.courseTitle,
                            studentName: transcriptModal.studentName,
                          });
                        }}
                        disabled={generatingQuiz}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        {generatingQuiz ? "Generating..." : "Generate Quiz"}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {transcriptModal.quizQuestions.map((q, idx) => (
                        <div key={q.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-bold text-muted-foreground mt-1">{idx + 1}.</span>
                            <Input
                              value={q.question}
                              onChange={(e) => {
                                const updated = [...transcriptModal.quizQuestions!];
                                updated[idx] = { ...updated[idx], question: e.target.value };
                                setTranscriptModal((prev) => prev ? { ...prev, quizQuestions: updated } : prev);
                              }}
                              className="text-sm font-medium"
                            />
                          </div>
                          <div className="space-y-2 pl-5">
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <RadioGroup
                                  value={q.correctAnswer.toString()}
                                  onValueChange={(val) => {
                                    const updated = [...transcriptModal.quizQuestions!];
                                    updated[idx] = { ...updated[idx], correctAnswer: parseInt(val) as 0|1|2|3 };
                                    setTranscriptModal((prev) => prev ? { ...prev, quizQuestions: updated } : prev);
                                  }}
                                >
                                  <div className="flex items-center gap-2">
                                    <RadioGroupItem value={optIdx.toString()} id={`q${idx}-opt${optIdx}`} />
                                  </div>
                                </RadioGroup>
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    const updated = [...transcriptModal.quizQuestions!];
                                    const newOptions = [...updated[idx].options] as [string,string,string,string];
                                    newOptions[optIdx] = e.target.value;
                                    updated[idx] = { ...updated[idx], options: newOptions };
                                    setTranscriptModal((prev) => prev ? { ...prev, quizQuestions: updated } : prev);
                                  }}
                                  className={`text-sm flex-1 ${q.correctAnswer === optIdx ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""}`}
                                />
                                {q.correctAnswer === optIdx && (
                                  <span className="text-xs text-green-600 font-medium whitespace-nowrap">Correct</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}

                      <div className="flex gap-2 pt-2">
                        <Button
                          onClick={() => {
                            if (!transcriptModal.quizQuestions || !transcriptModal.parentId) return;
                            approveQuizMutation.mutate({
                              sessionId: transcriptModal.sessionId,
                              courseId: transcriptModal.courseId,
                              parentId: transcriptModal.parentId,
                              questions: transcriptModal.quizQuestions,
                            });
                          }}
                          disabled={approveQuizMutation.isPending || !transcriptModal.parentId}
                        >
                          {approveQuizMutation.isPending ? "Saving..." : "Approve & Assign to Parent"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setGeneratingQuiz(true);
                            generateQuizMutation.mutate({
                              transcript: transcriptModal.transcript,
                              sessionId: transcriptModal.sessionId,
                              courseName: transcriptModal.courseTitle,
                              studentName: transcriptModal.studentName,
                            });
                          }}
                          disabled={generatingQuiz}
                        >
                          {generatingQuiz ? "Regenerating..." : "Regenerate"}
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>
              )}

            </Tabs>
            </div>

            <DialogFooter className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 border-t">
              <Button variant="outline" onClick={() => setTranscriptModal(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
	        </Dialog>
	      )}
	      {progressSuggestionModal && (
	        <Dialog
	          open={!!progressSuggestionModal}
	          onOpenChange={(open) => {
	            if (!open) setProgressSuggestionModal(null);
	          }}
	        >
	          <DialogContent className="max-w-lg">
	            <DialogHeader>
	              <DialogTitle>Progress Status Suggestion</DialogTitle>
	              <DialogDescription className="mt-1">
	                {progressSuggestionModal.studentName} · {progressSuggestionModal.courseTitle}
	              </DialogDescription>
	            </DialogHeader>
	            {(() => {
	              const s = progressSuggestionBySubscriptionId.get(progressSuggestionModal.subscriptionId) ?? null;
	              const current =
	                (subscriptions || []).find((x: any) => x?.subscription?.id === progressSuggestionModal.subscriptionId)
	                  ?.subscription?.progressStatus as ProgressStatusValue | undefined;
	              const currentValue: ProgressStatusValue = current ?? null;
	              if (!s || !s.suggested) {
	                return (
	                  <div className="space-y-2">
	                    <p className="text-sm">
	                      Current: <span className="font-semibold">{progressStatusLabel(currentValue)}</span>
	                    </p>
	                    <p className="text-sm text-muted-foreground">
	                      No grading or engagement data is available yet for this student.
	                    </p>
	                  </div>
	                );
	              }
	              return (
	                <div className="space-y-3">
	                  <div className="space-y-1">
	                    <p className="text-sm">
	                      Current: <span className="font-semibold">{progressStatusLabel(currentValue)}</span>
	                    </p>
	                    <p className="text-sm">
	                      Suggested: <span className="font-semibold">{progressStatusLabel(s.suggested)}</span>
	                    </p>
	                    <p className="text-xs text-muted-foreground">
	                      Based on the last {s.usedCount} completed session{s.usedCount === 1 ? "" : "s"}
	                      {s.avgOverallScore != null ? ` · avg score ${s.avgOverallScore}/4` : ""}
	                      {s.avgParticipationPct != null ? ` · participation ~${s.avgParticipationPct}%` : ""}
	                      {s.ctMode ? ` · critical thinking ${s.ctMode}` : ""}
	                    </p>
	                  </div>
	                  <div className="rounded-md border">
	                    <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
	                      Sessions Used
	                    </div>
	                    <div className="divide-y">
	                      {s.sessions.map((row) => (
	                        <div key={row.sessionId} className="px-3 py-2 text-sm flex items-start justify-between gap-3">
	                          <div className="min-w-0">
	                            <p className="font-medium truncate">
	                              {row.scheduledAt ? new Date(row.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Session"}
	                            </p>
	                            <p className="text-xs text-muted-foreground">
	                              {row.overallScore != null ? `Score ${row.overallScore}/4` : "Score n/a"}
	                              {row.participationPct != null ? ` · Participation ~${Math.round(row.participationPct)}%` : ""}
	                              {row.criticalThinkingLevel ? ` · Critical Thinking ${row.criticalThinkingLevel}` : ""}
	                            </p>
	                          </div>
	                          <div className="text-xs text-muted-foreground shrink-0">
	                            {Math.round(row.combinedNorm * 100)}%
	                          </div>
	                        </div>
	                      ))}
	                    </div>
	                  </div>
	                </div>
	              );
	            })()}
	            <DialogFooter>
	              <Button variant="outline" onClick={() => setProgressSuggestionModal(null)}>
	                Close
	              </Button>
	              {(() => {
	                const s = progressSuggestionBySubscriptionId.get(progressSuggestionModal.subscriptionId) ?? null;
	                if (!s || !s.suggested) return null;
	                return (
	                  <Button
	                    onClick={() => {
	                      updateProgressStatusMutation.mutate({
	                        id: progressSuggestionModal.subscriptionId,
	                        progressStatus: s.suggested,
	                      });
	                      setProgressSuggestionModal(null);
	                    }}
	                    disabled={updateProgressStatusMutation.isPending}
	                  >
	                    Set To Suggested
	                  </Button>
	                );
	              })()}
	            </DialogFooter>
	          </DialogContent>
	        </Dialog>
	      )}
	      <Footer />
	    </div>
	  );
}
