import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link, useLocation } from "wouter";
import { BookOpen, Calendar, MessageSquare, DollarSign, Users, Edit, Clock, FileText, Plus } from "lucide-react";
import { AvailabilityManager } from "@/components/AvailabilityManager";
import { TimeBlockManager } from "@/components/TimeBlockManager";
import { VideoUploadManager } from "@/components/VideoUploadManager";
import { useEffect, useMemo, useState } from "react";
import { LOGIN_PATH } from "@/const";
import { toast } from "sonner";

export default function TutorDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const tabContentClass =
    "space-y-6 absolute inset-0 w-full transition-all duration-300 data-[state=active]:opacity-100 data-[state=active]:translate-x-0 data-[state=inactive]:opacity-0 data-[state=inactive]:translate-x-4 data-[state=inactive]:pointer-events-none [&[hidden]]:block [&[hidden]]:opacity-0";

  const { data: tutorProfile } = trpc.tutorProfile.getMy.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "tutor" }
  );

  const { data: courses, isLoading: coursesLoading } = trpc.course.myCoursesAsTutor.useQuery(
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

  const { data: subscriptions, isLoading: subsLoading } = trpc.subscription.mySubscriptionsAsTutor.useQuery(
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

  const [sessionNotes, setSessionNotes] = useState<Record<number, string>>({});
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [completionType, setCompletionType] = useState<"completed" | "no_show">("completed");
  const [completionNotes, setCompletionNotes] = useState("");
  type PreferenceState = { preferred: boolean; hourlyRate: string; approvalStatus?: string };
  const [preferenceState, setPreferenceState] = useState<Record<number, PreferenceState>>({});

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

  // Helpers for session actions
  const canComplete = (session: any) =>
    session.status === "scheduled" && session.scheduledAt <= Date.now();

  const statusVariant = (status: string) => {
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

  const handleOpenCompletionDialog = (sessionId: number, existingNotes?: string) => {
    setSelectedSessionId(sessionId);
    setCompletionNotes(existingNotes || "");
    setCompletionType("completed");
    setCompletionDialogOpen(true);
  };

  const handleCompleteSession = () => {
    if (!selectedSessionId) return;

    const finalNotes = completionType === "no_show"
      ? "Student did not attend the session."
      : completionNotes;

    updateSessionMutation.mutate({
      id: selectedSessionId,
      status: completionType,
      feedbackFromTutor: finalNotes || undefined,
    }, {
      onSuccess: () => {
        setCompletionDialogOpen(false);
        setSelectedSessionId(null);
        setCompletionNotes("");
        setCompletionType("completed");
      }
    });
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

      <div className="flex-1">
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

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Earnings</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <DollarSign className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-3xl font-bold">${earnings?.completed.toFixed(0) || 0}</span>
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
              <Tabs defaultValue="courses" className="space-y-6">
                <div className="overflow-x-auto">
              <TabsList className="inline-flex min-w-max gap-2 sm:w-full sm:flex-wrap sm:justify-start">
                <TabsTrigger className="whitespace-nowrap" value="profile">Profile</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="courses">Courses</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="course-preferences">Course Preferences</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="students">Students</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="sessions">Sessions</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="history">History</TabsTrigger>
                <TabsTrigger className="whitespace-nowrap" value="availability">Availability</TabsTrigger>
              </TabsList>
                </div>

                <div className="relative min-h-[540px]">
                {/* Profile Tab */}
                <TabsContent value="profile" forceMount className={tabContentClass}>
                  <h2 className="text-2xl font-bold">Profile Settings</h2>
                  <VideoUploadManager 
                    currentVideoUrl={(tutorProfile as any)?.introVideoUrl}
                  />
                </TabsContent>

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
                                <p className="font-semibold text-lg">${parseFloat(course.price)}</p>
                              </div>
                              {course.duration && (
                                <div>
                                  <p className="text-muted-foreground">Duration</p>
                                  <p className="font-medium">{course.duration} min</p>
                                </div>
                              )}
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
                  <div className="flex items-center justify-between gap-4 flex-wrap">
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

                      {preferencesLoading || availableCoursesLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map((i) => (
                            <Skeleton key={i} className="h-16 w-full" />
                          ))}
                        </div>
                      ) : availableCourses && availableCourses.length > 0 ? (
                        <div className="space-y-3">
                          {availableCourses.map((course: any) => {
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
                  <h2 className="text-2xl font-bold">My Students</h2>

                  {subsLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                    </div>
                  ) : subscriptions && subscriptions.length > 0 ? (
                    <div className="space-y-4">
                      {subscriptions.map(({ subscription, course, parent }) => (
                        <Card key={subscription.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-semibold">
                                  {subscription.studentFirstName || subscription.studentLastName
                                    ? `${subscription.studentFirstName ?? ""} ${subscription.studentLastName ?? ""}`.trim()
                                    : "Student"}
                                </p>
                                <p className="text-sm text-muted-foreground">{course.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {subscription.sessionsCompleted || 0} sessions completed
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                                  {subscription.status}
                                </Badge>
                                <Button asChild variant="outline" size="sm">
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
                        <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mb-2">No Students Yet</h3>
                        <p className="text-muted-foreground">
                          Students who enroll in your courses will appear here
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Sessions Tab */}
                <TabsContent value="sessions" forceMount className={tabContentClass}>
                  <h2 className="text-2xl font-bold">Upcoming Sessions</h2>

                  {upcomingSessions && upcomingSessions.length > 0 ? (
                    <div className="space-y-4">
                      {upcomingSessions.map((session) => {
                        const noteValue =
                          sessionNotes[session.id] ?? session.feedbackFromTutor ?? "";
                        const markComplete = () =>
                          updateSessionMutation.mutate({ id: session.id, status: "completed" });
                        const saveNotes = () =>
                          updateSessionMutation.mutate({ id: session.id, feedbackFromTutor: noteValue });

                        return (
                          <Card key={session.id}>
                            <CardContent className="pt-6 space-y-4">
                              <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-semibold">
                                      {session.courseTitle || "Course"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(session.scheduledAt).toLocaleDateString()} • {new Date(session.scheduledAt).toLocaleTimeString()} • {session.duration} min
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {session.studentFirstName || session.studentLastName
                                        ? `Student: ${[session.studentFirstName, session.studentLastName].filter(Boolean).join(" ")}`
                                        : null}
                                      {(session.studentFirstName || session.studentLastName) && session.parentName ? " • " : null}
                                      {session.parentName ? `Parent: ${session.parentName}` : null}
                                    </p>
                                </div>
                              </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={statusVariant(session.status)}>
                                    {session.status === "no_show" ? "No Show" : session.status}
                                  </Badge>
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
                                    >
                                      Join meeting
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {canComplete(session) && (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenCompletionDialog(session.id, session.feedbackFromTutor)}
                                  disabled={updateSessionMutation.isPending}
                                >
                                  Complete Session
                                </Button>
                              )}

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
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={saveNotes} disabled={updateSessionMutation.isPending}>
                                      Save notes
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {session.status === "no_show" && session.feedbackFromTutor && (
                                <div className="p-3 bg-muted rounded-lg">
                                  <p className="text-sm font-medium text-muted-foreground mb-1">No-Show Note:</p>
                                  <p className="text-sm">{session.feedbackFromTutor}</p>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ) : (
                    <Card>
                      <CardContent className="py-16 text-center">
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-xl font-semibold mb-2">No Upcoming Sessions</h3>
                        <p className="text-muted-foreground">
                          Your scheduled sessions will appear here
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
                  ) : historySessions && historySessions.length > 0 ? (
                    <div className="space-y-4">
                      {historySessions
                        .filter((s) => !hiddenHistory.has(s.id))
                        .filter(s => s.scheduledAt <= Date.now())
                        .sort((a, b) => b.scheduledAt - a.scheduledAt)
                        .map((session) => {
                          const noteValue =
                            sessionNotes[session.id] ?? session.feedbackFromTutor ?? "";
                          const markComplete = () =>
                            updateSessionMutation.mutate({ id: session.id, status: "completed" });
                          const saveNotes = () =>
                            updateSessionMutation.mutate({ id: session.id, feedbackFromTutor: noteValue });

                          return (
                            <Card key={session.id}>
                              <CardContent className="pt-6 space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <Calendar className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                      <p className="font-semibold">
                                        {session.courseTitle || session.courseSubject || "Course"}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {new Date(session.scheduledAt).toLocaleDateString()} • {new Date(session.scheduledAt).toLocaleTimeString()} • {session.duration} min
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {(session.studentFirstName || session.studentLastName)
                                          ? `Student: ${[session.studentFirstName, session.studentLastName].filter(Boolean).join(" ")}`
                                          : null}
                                        {(session.studentFirstName || session.studentLastName) && session.parentName ? " • " : null}
                                        {session.parentName ? `Parent: ${session.parentName}` : null}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={statusVariant(session.status)}>
                                      {session.status === "no_show" ? "No Show" : session.status}
                                    </Badge>
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
                                      >
                                        Join meeting
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {canComplete(session) && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenCompletionDialog(session.id, session.feedbackFromTutor)}
                                    disabled={updateSessionMutation.isPending}
                                  >
                                    Complete Session
                                  </Button>
                                )}

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
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={saveNotes} disabled={updateSessionMutation.isPending}>
                                        Save notes
                                      </Button>
                                    </div>
                                  </div>
                                )}

                                {session.status === "no_show" && session.feedbackFromTutor && (
                                  <div className="p-3 bg-muted rounded-lg">
                                    <p className="text-sm font-medium text-muted-foreground mb-1">No-Show Note:</p>
                                    <p className="text-sm">{session.feedbackFromTutor}</p>
                                  </div>
                                )}

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

                {/* Availability Tab */}
                <TabsContent value="availability" forceMount className={tabContentClass}>
                  <div className="flex items-center gap-2 mb-6">
                    <Clock className="h-6 w-6" />
                    <h2 className="text-2xl font-bold">Manage Availability</h2>
                  </div>
                  <p className="text-muted-foreground mb-6">
                    Set your regular weekly schedule and block out time for vacations or appointments.
                    Parents will only be able to book sessions during your available hours.
                  </p>
                  <div className="space-y-6">
                    <AvailabilityManager />
                    <TimeBlockManager />
                  </div>
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

            {/* Session Notes - Only shown for completed sessions */}
            {completionType === "completed" && (
              <div className="space-y-2">
                <Label htmlFor="notes">Session Notes</Label>
                <p className="text-sm text-muted-foreground">
                  These notes will be visible to the parent
                </p>
                <Textarea
                  id="notes"
                  placeholder="Add notes or summary about the session..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* No-show information */}
            {completionType === "no_show" && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Note:</strong> This session will be marked with "Student did not attend the session."
                  Parents will be notified of the no-show.
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
    </div>
  );
}
