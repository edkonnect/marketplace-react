import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionNotesView } from "@/components/SessionNotesView";
import { FileText, Calendar, Clock3, BookOpen } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { LOGIN_PATH } from "@/const";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

export default function SessionNotesHistory() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: tutorHistory, isLoading: tutorHistoryLoading } = trpc.session.myHistory.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const { data: tutorNotesRaw, isLoading: tutorNotesLoading } = trpc.sessionNotes.getMyNotes.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const { data: parentNotes, isLoading: parentNotesLoading } = trpc.sessionNotes.getParentNotes.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );

  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<string>("all");

  const tutorNotesWithFeedback = useMemo(() => {
    const fromSessions = (tutorHistory || [])
      .filter((s) => s.feedbackFromTutor)
      .map((s) => ({
        id: s.id,
        sessionId: s.id,
        progressSummary: s.feedbackFromTutor as string,
        createdAt: s.updatedAt || s.scheduledAt,
        scheduledAt: s.scheduledAt,
        courseTitle: s.courseTitle || s.courseSubject || "Course",
        courseSubject: s.courseSubject,
        studentName: [s.studentFirstName, s.studentLastName].filter(Boolean).join(" "),
        parentName: s.parentName || "",
        tutorName: s.tutorName || "",
        duration: s.duration,
        source: "session" as const,
      }));

    const fromNotes = (tutorNotesRaw || []).map((n) => ({
      id: n.id,
      sessionId: n.sessionId,
      progressSummary: n.progressSummary,
      createdAt: n.createdAt,
      scheduledAt: n.scheduledAt,
      courseTitle: n.courseTitle || n.courseSubject || "Course",
      courseSubject: n.courseSubject,
      studentName: [n.studentFirstName, n.studentLastName].filter(Boolean).join(" "),
      parentName: n.parentName || "",
      tutorName: n.tutorName || "",
      duration: undefined,
      source: "note" as const,
    }));

    // Prefer session-sourced records (carry more up-to-date feedback) when same sessionId
    const bySession = new Map<number, typeof fromSessions[number]>();
    fromNotes.forEach((n) => {
      if (n.sessionId != null) bySession.set(n.sessionId, n);
    });
    fromSessions.forEach((s) => {
      if (s.sessionId != null) bySession.set(s.sessionId, s);
    });

    return Array.from(bySession.values());
  }, [tutorHistory, tutorNotesRaw]);

  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    tutorNotesWithFeedback.forEach((n) => set.add(n.courseTitle));
    return Array.from(set);
  }, [tutorNotesWithFeedback]);

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    tutorNotesWithFeedback.forEach((n) => set.add(new Date(n.scheduledAt).getFullYear().toString()));
    return Array.from(set);
  }, [tutorNotesWithFeedback]);

  const filteredTutorNotes = useMemo(() => {
    return tutorNotesWithFeedback.filter((n) => {
      const yearMatch = selectedYear === "all" || new Date(n.scheduledAt).getFullYear().toString() === selectedYear;
      const courseMatch = selectedCourse === "all" || n.courseTitle === selectedCourse;
      return yearMatch && courseMatch;
    });
  }, [tutorNotesWithFeedback, selectedCourse, selectedYear]);

  const groupedByMonth = useMemo(() => {
    const map = new Map<string, typeof filteredTutorNotes>();
    filteredTutorNotes.forEach((n) => {
      const key = format(new Date(n.scheduledAt), "MMMM yyyy");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    });
    return Array.from(map.entries()).sort(
      (a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [filteredTutorNotes]);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      window.location.href = LOGIN_PATH;
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-12 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const notes = user.role === "tutor" ? filteredTutorNotes : parentNotes;
  const isLoading = user.role === "tutor" ? (tutorHistoryLoading || tutorNotesLoading) : parentNotesLoading;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Session Notes History</h1>
          </div>
          <p className="text-muted-foreground">
            {user.role === "tutor" 
              ? "View all session notes you've created for your students"
              : "View all session notes from your child's tutoring sessions"}
          </p>
        </div>

        {user.role === "tutor" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6">
            <div className="space-y-2">
              <Label htmlFor="course-filter">Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger id="course-filter">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {courseOptions.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="year-filter">Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger id="year-filter">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        ) : user.role === "tutor" ? (
          notes && notes.length > 0 ? (
            <div className="space-y-6">
              {groupedByMonth.map(([month, monthNotes]) => (
                <div key={month} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h3 className="text-lg font-semibold">{month}</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {monthNotes.map((note) => (
                      <Card key={note.id} className="h-full">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{note.courseTitle}</CardTitle>
                            <Badge variant="secondary">Session</Badge>
                          </div>
                          <CardDescription>
                            {note.studentName && `Student: ${note.studentName}`}{" "}
                            {note.parentName && `• Parent: ${note.parentName}`}
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock3 className="h-4 w-4" />
                            <span>{format(new Date(note.scheduledAt), "PPP p")}</span>
                          </div>
                          {note.courseSubject && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <BookOpen className="h-4 w-4" />
                              <span>{note.courseSubject}</span>
                            </div>
                          )}
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {note.progressSummary}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No Session Notes Yet</CardTitle>
                <CardDescription>
                  Notes you add in completed sessions will appear here with course and student details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href={"/tutor-dashboard"}>
                  <a className="text-primary hover:underline">
                    Go to Dashboard
                  </a>
                </Link>
              </CardContent>
            </Card>
          )
        ) : notes && notes.length > 0 ? (
          <div className="space-y-6">
            {notes.map((note) => (
              <div key={note.id}>
                <SessionNotesView note={note} />
              </div>
            ))}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Session Notes Yet</CardTitle>
              <CardDescription>
                {user.role === "tutor"
                  ? "You haven't created any session notes yet. Add notes after completing a session to share feedback with parents."
                  : "Your tutor hasn't added any session notes yet. Notes will appear here after each completed session."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={user.role === "tutor" ? "/tutor-dashboard" : "/parent-dashboard"}>
                <a className="text-primary hover:underline">
                  Go to Dashboard
                </a>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
