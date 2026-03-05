import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, ChevronDown, ChevronUp, FileText, Download } from "lucide-react";
import { formatSessionTime } from "@/../../shared/timezone-utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface TutorSessionsManagerProps {
  upcomingSessions: any[];
  sessionNotes: Record<number, string>;
  setSessionNotes: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  handleOpenCompletionDialog: (sessionId: number, feedbackFromTutor?: string | null) => void;
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
    const urlMatch = session.joinUrl.match(/\/j\/(\d+)/);
    if (!urlMatch) {
      toast.error("Could not extract meeting ID from URL");
      return;
    }

    const meetingId = urlMatch[1];
    setFetchingTranscripts((prev) => ({ ...prev, [session.id]: true }));

    fetchTranscriptMutation.mutate({
      meetingId,
      sessionId: session.id,
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
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

  return (
    <div className="space-y-6">
      {Object.entries(groupedSessions).map(([key, group]) => {
        const scheduledSessions = group.sessions.filter((s) => s.status === "scheduled");
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
                          {session.isTrial ? (
                            <Badge variant="outline" className="text-xs border-blue-500 text-blue-700 bg-blue-50 dark:bg-blue-950/20">
                              Trial Lesson
                            </Badge>
                          ) : (
                            <Badge variant={statusVariant(session.status)} className="text-xs">
                              {session.status === "no_show" ? "Completed (No Show)" : session.status}
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
                        onClick={() => handleOpenCompletionDialog(session.id, session.feedbackFromTutor)}
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
  );
}
