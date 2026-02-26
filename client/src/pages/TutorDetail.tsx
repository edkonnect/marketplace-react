import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useParams, Link } from "wouter";
import { Star, BookOpen, Clock, DollarSign, MessageSquare, Calendar as CalendarIcon } from "lucide-react";
import { VideoPlayerWithRecommendations } from "@/components/VideoPlayerWithRecommendations";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import TutorAvailabilityDisplay from "@/components/TutorAvailabilityDisplay";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export default function TutorDetail() {
  const { id } = useParams();
  const tutorId = Number(id);
  const hasValidId = Number.isFinite(tutorId) && tutorId > 0;
  const { user, isAuthenticated } = useAuth();

  const { data: tutorProfile, isLoading: profileLoading } = trpc.tutorProfile.get.useQuery(
    { userId: tutorId },
    { enabled: hasValidId }
  );
  const { isLoading: coursesLoading } = trpc.course.myCoursesAsTutor.useQuery(undefined, {
    enabled: false, // We'll fetch via a different approach
  });
  
  // Fetch tutor's availability schedule
  const { data: availability } = trpc.tutorAvailability.getByTutorId.useQuery(
    { tutorId },
    { enabled: !!tutorId }
  );
  
  // Fetch courses by tutor ID using the tutorProfile router
  const { data: coursesData } = trpc.tutorProfile.getCourses.useQuery({ tutorId }, {
    enabled: hasValidId,
  });
  
  const displayCourses = coursesData || [];

  const parseSubjects = (subjects: string | null) => {
    if (!subjects) return [];
    try {
      return JSON.parse(subjects);
    } catch {
      return [];
    }
  };

  const parseGradeLevels = (levels: string | null) => {
    if (!levels) return [];
    try {
      return JSON.parse(levels);
    } catch {
      return [];
    }
  };

  if (!hasValidId) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Tutor Not Found</h1>
          <Button asChild>
            <Link href="/tutors">Back to Tutors</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="container py-12">
          <Skeleton className="h-64 w-full mb-8" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!tutorProfile) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="container py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Tutor Not Found</h1>
          <Button asChild>
            <Link href="/tutors">Back to Tutors</Link>
          </Button>
        </div>
      </div>
    );
  }

  const subjects = parseSubjects(tutorProfile.subjects);
  const gradeLevels = parseGradeLevels(tutorProfile.gradeLevels);
  const rating = tutorProfile.rating ? parseFloat(tutorProfile.rating) : 0;
  const hourlyRate = tutorProfile.hourlyRate ? parseFloat(tutorProfile.hourlyRate) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1">
        {/* Profile Header */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-b border-border">
          <div className="container py-12">
            <div className="flex flex-col md:flex-row gap-8 items-start">
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-bold text-primary flex-shrink-0">
                {tutorProfile.userId}
              </div>

              <div className="flex-1">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-4xl font-bold mb-2">{tutorProfile.name || "Tutor Profile"}</h1>
                    {tutorProfile.yearsOfExperience && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{tutorProfile.yearsOfExperience} years of experience</span>
                      </div>
                    )}
                  </div>
                  {rating > 0 && (
                    <div className="flex items-center gap-2 bg-card px-4 py-2 rounded-lg border border-border">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="text-xl font-semibold">{rating.toFixed(1)}</span>
                      <span className="text-sm text-muted-foreground">({tutorProfile.totalReviews} reviews)</span>
                    </div>
                  )}
                </div>

                {hourlyRate > 0 && (
                  <div className="flex items-center gap-2 text-2xl font-semibold text-primary mb-4">
                    <DollarSign className="w-6 h-6" />
                    <span>{hourlyRate}</span>
                    <span className="text-base text-muted-foreground font-normal">/hour</span>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 mb-6">
                  {subjects.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Subjects</p>
                      <div className="flex flex-wrap gap-2">
                        {subjects.map((subject: string, idx: number) => (
                          <Badge key={idx} variant="secondary">{subject}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {gradeLevels.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">Grade Levels</p>
                      <div className="flex flex-wrap gap-2">
                        {gradeLevels.map((level: string, idx: number) => (
                          <Badge key={idx} variant="outline">{level}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {isAuthenticated && user?.role === "parent" && (
                  <Button size="lg" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Contact Tutor
                  </Button>
                )}
                {!isAuthenticated && (
                  <Button asChild size="lg">
                    <a href={LOGIN_PATH}>Sign In to Contact</a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Introduction Video */}
              {(tutorProfile as any).introVideoUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle>Introduction Video</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <VideoPlayerWithRecommendations
                      videoUrl={(tutorProfile as any).introVideoUrl}
                      tutorId={tutorId}
                      tutorName={tutorProfile.name || "Tutor"}
                    />
                  </CardContent>
                </Card>
              )}

              {/* About */}
              {tutorProfile.bio && (
                <Card>
                  <CardHeader>
                    <CardTitle>About</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {tutorProfile.bio}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Courses */}
              <Card>
                <CardHeader>
                  <CardTitle>Available Courses</CardTitle>
                  <CardDescription>
                    Tutoring packages and courses offered
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {coursesLoading ? (
                    <div className="space-y-4">
                      {[1, 2].map(i => <Skeleton key={i} className="h-32 w-full" />)}
                    </div>
                  ) : displayCourses && displayCourses.length > 0 ? (
                    <div className="space-y-4">
                      {displayCourses.map(course => (
                        <Card key={course.id} className="hover:border-primary/50 transition-colors">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg">{course.title}</CardTitle>
                                {course.description && (
                                  <CardDescription className="mt-2 line-clamp-2">
                                    {course.description}
                                  </CardDescription>
                                )}
                              </div>
                              <div className="text-right ml-4">
                                <div className="text-xl font-semibold text-primary">
                                  ${parseFloat(course.price)}
                                </div>
                                {course.duration && (
                                  <div className="text-xs text-muted-foreground">
                                    {course.duration} min/session
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between">
                              <div className="flex gap-2">
                                <Badge variant="secondary">{course.subject}</Badge>
                                {course.gradeLevel && (
                                  <Badge variant="outline">{course.gradeLevel}</Badge>
                                )}
                              </div>
                              <Button asChild size="sm">
                                <Link href={`/course/${course.id}`}>
                                  View Details
                                </Link>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No courses available at the moment
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Available Slots (Next 7 Days) */}
              {availability && availability.length > 0 && (
                <TutorAvailabilityDisplay availability={availability} tutorId={tutorId} />
              )}

              {/* General Weekly Availability */}
              {availability && availability.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5" />
                      General Availability
                    </CardTitle>
                    <CardDescription>
                      {tutorProfile.name ? `${tutorProfile.name}'s usual weekly schedule` : "Usual weekly schedule"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {DAYS_OF_WEEK.map(day => {
                        const daySlots = availability.filter(slot => slot.dayOfWeek === day.value && slot.isActive);
                        return (
                          <div
                            key={day.value}
                            className={`flex items-start gap-4 p-3 rounded-lg border transition-colors ${
                              daySlots.length > 0
                                ? "bg-primary/5 border-primary/20"
                                : "bg-muted/30 border-border"
                            }`}
                          >
                            <div className="min-w-[80px]">
                              <p className={`text-sm font-medium ${daySlots.length > 0 ? "text-foreground" : "text-muted-foreground"}`}>
                                {day.label}
                              </p>
                            </div>
                            <div className="flex-1">
                              {daySlots.length > 0 ? (
                                <div className="space-y-1">
                                  {daySlots.map(slot => (
                                    <div key={slot.id} className="flex items-center gap-2 text-sm">
                                      <Clock className="w-3 h-3 text-primary" />
                                      <span>{slot.startTime} - {slot.endTime}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">Not available</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Qualifications */}
              {tutorProfile.qualifications && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Qualifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {tutorProfile.qualifications}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
