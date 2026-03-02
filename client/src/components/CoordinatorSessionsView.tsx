import { useState, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Clock, FileText, Calendar } from "lucide-react";

interface Session {
  id: number;
  scheduledAt: number;
  duration: number;
  status: string;
  courseTitle?: string;
  tutorName?: string;
  studentFirstName?: string;
  studentLastName?: string;
  feedbackFromTutor?: string;
}

interface CoordinatorSessionsViewProps {
  upcomingSessions: Session[];
  sessionHistory: Session[];
  sessionsLoading: boolean;
  historyLoading: boolean;
}

export function CoordinatorSessionsView({
  upcomingSessions,
  sessionHistory,
  sessionsLoading,
  historyLoading,
}: CoordinatorSessionsViewProps) {
  // Filter states
  const [selectedStudent, setSelectedStudent] = useState("all");
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Extract unique students and courses for filter options
  const allSessions = [...upcomingSessions, ...sessionHistory];

  const studentOptions = useMemo(() => {
    const students = new Set<string>();
    allSessions.forEach((session) => {
      const name = [session.studentFirstName, session.studentLastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (name) students.add(name);
    });
    return Array.from(students).sort();
  }, [allSessions]);

  const courseOptions = useMemo(() => {
    const courses = new Set<string>();
    allSessions.forEach((session) => {
      if (session.courseTitle) courses.add(session.courseTitle);
    });
    return Array.from(courses).sort();
  }, [allSessions]);

  // Filter sessions based on selected filters
  const filterSessions = (sessions: Session[]) => {
    return sessions.filter((session) => {
      // Filter by student
      if (selectedStudent !== "all") {
        const studentName = [session.studentFirstName, session.studentLastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (studentName !== selectedStudent) return false;
      }

      // Filter by course
      if (selectedCourse !== "all") {
        if (session.courseTitle !== selectedCourse) return false;
      }

      // Filter by status
      if (selectedStatus !== "all") {
        if (session.status !== selectedStatus) return false;
      }

      return true;
    });
  };

  const filteredUpcoming = useMemo(
    () => filterSessions(upcomingSessions),
    [upcomingSessions, selectedStudent, selectedCourse, selectedStatus]
  );

  const filteredHistory = useMemo(
    () => filterSessions(sessionHistory),
    [sessionHistory, selectedStudent, selectedCourse, selectedStatus]
  );

  // Get status badge styling
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return { variant: "default" as const, className: "" };
      case "no_show":
        return {
          variant: "outline" as const,
          className:
            "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800",
        };
      case "cancelled":
        return {
          variant: "destructive" as const,
          className: "",
        };
      case "scheduled":
        return { variant: "secondary" as const, className: "" };
      default:
        return { variant: "outline" as const, className: "" };
    }
  };

  const renderSession = (session: Session) => {
    const statusBadge = getStatusBadge(session.status);
    const studentName = [session.studentFirstName, session.studentLastName]
      .filter(Boolean)
      .join(" ")
      .trim() || "Student";

    return (
      <Card key={session.id}>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <div className="text-sm text-muted-foreground">
                  {session.courseTitle || "Course"}
                </div>
                <p className="font-semibold">
                  {new Date(session.scheduledAt).toLocaleDateString()} •{" "}
                  {new Date(session.scheduledAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <Badge variant={statusBadge.variant} className={statusBadge.className}>
                  {session.status === "no_show"
                    ? "Completed (No Show)"
                    : session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {session.duration} minutes • Tutor: {session.tutorName || "Tutor"} •
                Student: {studentName}
              </p>
              {session.feedbackFromTutor && (
                <div className="mt-3 p-4 sm:p-5 rounded-xl border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <span className="text-base font-semibold text-blue-900 dark:text-blue-100">
                        Session Summary
                      </span>
                      <div className="pl-4 border-l-2 border-blue-300 dark:border-blue-700">
                        <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap break-words">
                          {session.feedbackFromTutor}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">Filter Sessions</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="filter-student">Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger id="filter-student">
                  <SelectValue placeholder="All students" />
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

            <div className="space-y-2">
              <Label htmlFor="filter-course">Course</Label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger id="filter-course">
                  <SelectValue placeholder="All courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All courses</SelectItem>
                  {courseOptions.map((course) => (
                    <SelectItem key={course} value={course}>
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="filter-status">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Upcoming vs History */}
      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upcoming">
            Upcoming Sessions ({filteredUpcoming.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Session History ({filteredHistory.length})
          </TabsTrigger>
        </TabsList>

        {/* Upcoming Sessions */}
        <TabsContent value="upcoming" className="mt-6">
          {sessionsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredUpcoming.length > 0 ? (
            <div className="space-y-4">{filteredUpcoming.map(renderSession)}</div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Upcoming Sessions</h3>
                <p className="text-muted-foreground">
                  {selectedStudent !== "all" ||
                  selectedCourse !== "all" ||
                  selectedStatus !== "all"
                    ? "No sessions match the selected filters"
                    : "No upcoming sessions scheduled"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Session History */}
        <TabsContent value="history" className="mt-6">
          {historyLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-4">
              {filteredHistory.slice(0, 20).map(renderSession)}
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No Session History</h3>
                <p className="text-muted-foreground">
                  {selectedStudent !== "all" ||
                  selectedCourse !== "all" ||
                  selectedStatus !== "all"
                    ? "No sessions match the selected filters"
                    : "No completed sessions yet"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
