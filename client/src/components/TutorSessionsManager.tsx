import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, ChevronDown, ChevronUp, FileText, Download, Sparkles, Search, X } from "lucide-react";
import { formatSessionTime } from "@/../../shared/timezone-utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface TutorSessionsManagerProps {
  upcomingSessions: any[];
  sessionNotes: Record<number, string>;
  setSessionNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  handleOpenCompletionDialog: (sessionId: number, feedbackFromTutor?: string | null, joinUrl?: string | null) => void;
  updateSessionMutation: any;
  canComplete: (session: any) => boolean;
  statusVariant: (status?: string | null) => "default" | "secondary" | "outline" | "destructive";
  tutorTimezone?: string;
}

export function TutorSessionsManager({
  upcomingSessions,
  sessionNotes,
  setSessionNotes,
  handleOpenCompletionDialog,
  updateSessionMutation,
  canComplete,
  statusVariant,
  tutorTimezone,
}: TutorSessionsManagerProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [fetchingTranscripts, setFetchingTranscripts] = useState<Record<number, boolean>>({});
  const [summarizingSessionId, setSummarizingSessionId] = useState<number | null>(null);
  const [studentFilter, setStudentFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [trialFilter, setTrialFilter] = useState<"all" | "trial" | "regular">("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "next7" | "month">("all");

  const summarizeMutation = trpc.ai.summarizeText.useMutation({
    onSuccess: (data) => {
      if (summarizingSessionId !== null) {
        setSessionNotes((prev) => ({
          ...prev,
          [summarizingSessionId]: data.summary,
        }));
      }
      setSummarizingSessionId(null);
      toast.success("Notes summarized successfully!");
    },
    onError: (error) => {
      setSummarizingSessionId(null);
      toast.error("Failed to summarize notes: " + error.message);
    },
  });

  // Use tutor's timezone or fallback to browser timezone
  const timezone = tutorTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Fetch transcript mutation
  const fetchTranscriptMutation = trpc.zoom.fetchTranscript.useMutation({
    onSuccess: (data, variables) => {
      toast.success("Transcript fetched successfully!");
      setFetchingTranscripts((prev) => ({ ...prev, [variables.sessionId || 0]: false }));
    },
    onError: (error, variables) => {
      const message = error.message || "Failed to fetch transcript";
      if (message.includes("No transcript available") || message.includes("not found")) {
        toast.warning("Transcript is still processing. Please try again in a few minutes.");
      } else {
        toast.error(message);
      }
      setFetchingTranscripts((prev) => ({ ...prev, [variables.sessionId || 0]: false }));
    },
  });

  const handleFetchTranscript = async (session: any) => {
    if (!session.joinUrl) {
      toast.error("No meeting URL found for this session");
      return;
    }

    // Extract meeting ID from joinUrl
    // Format: https://us05web.zoom.us/j/85648346210?pwd=...
    const urlMatch = session.joinUrl.match(/\/[js]\/(\d+)/);
    if (!urlMatch) {
      toast.error("Could not extract meeting ID from URL");
      return;
    }

    const meetingId = urlMatch[1];
    setFetchingTranscripts((prev) => ({ ...prev, [session.id]: true }));

    fetchTranscriptMutation.mutate({
      meetingId,
      sessionId: session.id,
      sessionScheduledAt: session.scheduledAt,
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

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

  // Group sessions by student
  const groupedSessions = useMemo(() => {
    const grouped: Record<string, { student: string; course: string; sessions: any[] }> = {};

    upcomingSessions.forEach((session) => {
      const studentName = [session.studentFirstName, session.studentLastName]
        .filter(Boolean)
        .join(" ")
        .trim() || "Unknown Student";
      const courseName = session.courseTitle || "Course";

      // For trial sessions, add "(Trial)" to distinguish them
      const displayCourseName = session.isTrial ? `${courseName} (Trial)` : courseName;

      // Create a unique key for student + course combination
      const key = session.isTrial
        ? `TRIAL_${studentName}|${courseName}`
        : `${studentName}|${courseName}`;

      if (!grouped[key]) {
        grouped[key] = {
          student: studentName,
          course: displayCourseName,
          sessions: [],
        };
      }

      grouped[key].sessions.push(session);
    });

    // Sort sessions within each group by date
    Object.values(grouped).forEach((group) => {
      group.sessions.sort((a, b) => a.scheduledAt - b.scheduledAt);
    });

    return grouped;
  }, [upcomingSessions]);

  const courseOptions = useMemo(() => {
    const titles = new Set(upcomingSessions.map((s) => s.courseTitle || "Course"));
    return Array.from(titles).sort();
  }, [upcomingSessions]);

  const filteredGroups = useMemo(() => {
    const now = Date.now();
    const tz = timezone;

    const getDateRange = (): [number, number] | null => {
      if (dateFilter === "all") return null;
      const d = new Date(now);
      const year = parseInt(formatSessionTime(now, tz, "yyyy"));
      const month = parseInt(formatSessionTime(now, tz, "M")) - 1;
      const day = parseInt(formatSessionTime(now, tz, "d"));
      const dow = d.getDay(); // 0=Sun

      if (dateFilter === "today") {
        const start = new Date(year, month, day, 0, 0, 0, 0).getTime();
        const end = new Date(year, month, day, 23, 59, 59, 999).getTime();
        return [start, end];
      }
      if (dateFilter === "week") {
        const diffToMon = (dow === 0 ? -6 : 1 - dow);
        const monStart = new Date(year, month, day + diffToMon, 0, 0, 0, 0).getTime();
        const sunEnd = monStart + 7 * 24 * 60 * 60 * 1000 - 1;
        return [monStart, sunEnd];
      }
      if (dateFilter === "next7") {
        const start = new Date(year, month, day, 0, 0, 0, 0).getTime();
        return [start, start + 7 * 24 * 60 * 60 * 1000 - 1];
      }
      if (dateFilter === "month") {
        const start = new Date(year, month, 1, 0, 0, 0, 0).getTime();
        const end = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
        return [start, end];
      }
      return null;
    };

    const dateRange = getDateRange();

    return Object.entries(groupedSessions).filter(([, group]) => {
      if (studentFilter.trim()) {
        const q = studentFilter.trim().toLowerCase();
        if (!group.student.toLowerCase().includes(q)) return false;
      }

      if (courseFilter !== "all") {
        const baseTitle = group.course.replace(/ \(Trial\)$/, "");
        if (baseTitle !== courseFilter) return false;
      }

      if (trialFilter !== "all") {
        const isGroupTrial = group.sessions[0]?.isTrial ?? false;
        if (trialFilter === "trial" && !isGroupTrial) return false;
        if (trialFilter === "regular" && isGroupTrial) return false;
      }

      if (dateRange) {
        const [start, end] = dateRange;
        const hasSessionInRange = group.sessions.some(
          (s) => s.scheduledAt >= start && s.scheduledAt <= end
        );
        if (!hasSessionInRange) return false;
      }

      return true;
    });
  }, [groupedSessions, studentFilter, courseFilter, trialFilter, dateFilter, timezone]);

  const hasActiveFilters =
    studentFilter.trim() !== "" ||
    courseFilter !== "all" ||
    trialFilter !== "all" ||
    dateFilter !== "all";

  const clearFilters = () => {
    setStudentFilter("");
    setCourseFilter("all");
    setTrialFilter("all");
    setDateFilter("all");
  };

  const formatDate = (timestamp: number) => {
    return formatSessionTime(timestamp, timezone, 'MMM d, yyyy');
  };

  const formatTime = (timestamp: number) => {
    return formatSessionTime(timestamp, timezone, 'h:mm a');
  };

  if (Object.keys(groupedSessions).length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-xl font-semibold mb-2">No Upcoming Sessions</h3>
          <p className="text-muted-foreground">
            Your scheduled sessions will appear here
          </p>
        </CardContent>
      </Card>
    );
  }

  const totalFilteredSessions = filteredGroups.reduce(
    (sum, [, g]) => sum + g.sessions.length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Student search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              placeholder="Search student..."
              className="pl-9"
            />
          </div>

          {/* Course dropdown */}
          <Select value={courseFilter} onValueChange={setCourseFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder="All courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All courses</SelectItem>
              {courseOptions.map((title) => (
                <SelectItem key={title} value={title}>
                  {title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Trial / Regular toggle */}
          <div className="flex rounded-md border overflow-hidden">
            {(["all", "trial", "regular"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setTrialFilter(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  trialFilter === v
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted text-muted-foreground"
                } ${v !== "all" ? "border-l" : ""}`}
              >
                {v === "all" ? "All" : v === "trial" ? "Trial" : "Regular"}
              </button>
            ))}
          </div>
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: "all", label: "All dates" },
              { value: "today", label: "Today" },
              { value: "week", label: "This Week" },
              { value: "next7", label: "Next 7 Days" },
              { value: "month", label: "This Month" },
            ] as const
          ).map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={dateFilter === value ? "default" : "outline"}
              onClick={() => setDateFilter(value)}
              className="text-xs h-7"
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Results count + clear */}
        {hasActiveFilters && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filteredGroups.length} {filteredGroups.length === 1 ? "group" : "groups"} &middot;{" "}
              {totalFilteredSessions} {totalFilteredSessions === 1 ? "session" : "sessions"}
            </span>
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* No match empty state */}
      {filteredGroups.length === 0 && hasActiveFilters && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-1">No sessions match your filters</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Try adjusting or clearing the filters above
            </p>
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scrollable session list */}
      <div className="max-h-[600px] overflow-y-auto pr-1 space-y-6">
      {filteredGroups.map(([key, group]) => {
        const isExpanded = expandedGroups[key];
        const firstSession = group.sessions[0];
        const lastSession = group.sessions[group.sessions.length - 1];

        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {group.course}
                    {group.sessions.length > 1 && (
                      <Badge variant="secondary">{group.sessions.length} sessions</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Student: {group.student}
                    {group.sessions[0]?.parentName && (
                      <> • Parent: {group.sessions[0].parentName}</>
                    )}
                  </CardDescription>
                  {group.sessions.length > 1 && !isExpanded && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatDate(firstSession.scheduledAt)} - {formatDate(lastSession.scheduledAt)}
                    </p>
                  )}
                </div>
                {group.sessions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroup(key)}
                    className="flex items-center gap-1"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Collapse
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Expand
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show only first session if collapsed and multiple sessions, otherwise show all */}
              {(group.sessions.length === 1 || isExpanded
                ? group.sessions
                : [group.sessions[0]]
              ).map((session) => {
                const noteValue = sessionNotes[session.id] ?? session.feedbackFromTutor ?? "";
                const saveNotes = () =>
                  updateSessionMutation.mutate({
                    id: session.id,
                    feedbackFromTutor: noteValue,
                  });

                return (
                  <div key={session.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Session info */}
                      <div className="flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium">{formatDate(session.scheduledAt)}</span>
                          <Badge variant={statusVariant(session.status)} className="text-xs">
                            {session.status === "no_show" ? "Completed (No Show)" : session.status}
                          </Badge>
                          {session.isTrial && (
                            <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/20">
                              Trial Lesson
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          <span>{formatTime(session.scheduledAt)}</span>
                          <span>•</span>
                          <span>{session.duration} min</span>
                        </div>
                      </div>

                      {/* Join button */}
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

                    {/* Complete button */}
                    {canComplete(session) && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenCompletionDialog(session.id, session.feedbackFromTutor, session.joinUrl)}
                        disabled={updateSessionMutation.isPending}
                      >
                        Complete Session
                      </Button>
                    )}

                    {/* Notes for completed sessions */}
                    {session.status === "completed" && (
                      <div className="space-y-2">
                        <Label>Session Notes (visible to parent)</Label>
                        <Textarea
                          value={noteValue}
                          onChange={(e) =>
                            setSessionNotes((prev) => ({
                              ...prev,
                              [session.id]: e.target.value,
                            }))
                          }
                          placeholder="Add notes/summary for the student"
                          className="min-h-[100px]"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            onClick={saveNotes}
                            disabled={updateSessionMutation.isPending}
                          >
                            Save notes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleFetchTranscript(session)}
                            disabled={fetchingTranscripts[session.id] || fetchTranscriptMutation.isPending}
                          >
                            {fetchingTranscripts[session.id] ? (
                              <>
                                <Download className="w-4 h-4 mr-2 animate-spin" />
                                Fetching...
                              </>
                            ) : (
                              <>
                                <FileText className="w-4 h-4 mr-2" />
                                Fetch Transcript
                              </>
                            )}
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
                                <Sparkles className="w-4 h-4 mr-2" />
                                Summarize with AI
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Notes for no-show sessions */}
                    {session.status === "no_show" && (
                      <div className="space-y-2">
                        <Label>No-Show Notes (visible to parent)</Label>
                        <Textarea
                          value={noteValue}
                          onChange={(e) =>
                            setSessionNotes((prev) => ({
                              ...prev,
                              [session.id]: e.target.value,
                            }))
                          }
                          placeholder="Add notes for the student (e.g., homework, materials to review)"
                          className="min-h-[100px]"
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
                                <Sparkles className="w-4 h-4 mr-2" />
                                Summarize with AI
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
      </div>
    </div>
  );
}
