import Navigation from "@/components/Navigation";
import { CoursePrice } from "@/components/CoursePrice";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Star, BookOpen, Clock, DollarSign, MessageSquare, Calendar as CalendarIcon, Mail } from "lucide-react";
import { VideoPlayerWithRecommendations } from "@/components/VideoPlayerWithRecommendations";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import TutorAvailabilityDisplay from "@/components/TutorAvailabilityDisplay";

// Convert a HH:MM time string from tutorTz to the viewer's local timezone.
// Returns { time: "HH:MM", dayOffset: -1|0|1 } — dayOffset indicates if the
// converted time falls on the previous (-1) or next (+1) day.
function convertSlotToViewerTz(
  timeStr: string,
  dayOfWeek: number,
  tutorTz: string
): { time: string; dayOfWeek: number } {
  try {
    const [hour, minute] = timeStr.split(":").map(Number);
    // Use an arbitrary reference week starting on Sunday 2024-01-07
    const refSunday = new Date("2024-01-07T00:00:00");
    const refDate = new Date(refSunday);
    refDate.setDate(refSunday.getDate() + dayOfWeek);

    // Build an ISO string representing this time in the tutor's timezone
    // by formatting the date in tutor tz and replacing the time portion
    const isoDatePart = refDate.toISOString().substring(0, 10);
    const paddedHour = String(hour).padStart(2, "0");
    const paddedMin = String(minute).padStart(2, "0");

    // Create a Date that represents the wall-clock time in tutorTz
    const localStr = `${isoDatePart}T${paddedHour}:${paddedMin}:00`;
    const tutorDate = new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tutorTz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
        .format(new Date(localStr))
        .replace(/\//g, "-") + `T${paddedHour}:${paddedMin}:00`
    );

    // Convert to viewer's local timezone using Intl
    const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: viewerTz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "long",
    });
    const parts = formatter.formatToParts(tutorDate);
    const timePart = parts.find(p => p.type === "hour")!.value + ":" + parts.find(p => p.type === "minute")!.value;
    const weekdayPart = parts.find(p => p.type === "weekday")!.value;
    const weekdayMap: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };
    return { time: timePart, dayOfWeek: weekdayMap[weekdayPart] ?? dayOfWeek };
  } catch {
    return { time: timeStr, dayOfWeek };
  }
}

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
  const [, navigate] = useLocation();
  const [showAllCourses, setShowAllCourses] = useState(false);
  const COURSES_PREVIEW = 3;

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

  const tutorTz = (tutorProfile as any).businessTimezone || (tutorProfile as any).timezone || null;
  const viewerTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const viewerTzAbbr = new Intl.DateTimeFormat("en-US", { timeZone: viewerTz, timeZoneName: "short" })
    .formatToParts(new Date())
    .find(p => p.type === "timeZoneName")?.value ?? viewerTz;
  const tzConversionAvailable = !!tutorTz && tutorTz !== viewerTz;

  // Re-map availability slots to viewer's timezone when conversion is possible
  const convertedAvailability = availability && tzConversionAvailable
    ? availability
        .filter(slot => slot.isActive)
        .map(slot => {
          const start = convertSlotToViewerTz(slot.startTime, slot.dayOfWeek, tutorTz);
          const end = convertSlotToViewerTz(slot.endTime, slot.dayOfWeek, tutorTz);
          return { ...slot, startTime: start.time, endTime: end.time, dayOfWeek: start.dayOfWeek };
        })
    : availability?.filter(slot => slot.isActive) ?? [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1">
        {/* Profile Header */}
        <div className="bg-background border-b border-border pt-24 pb-16">
          <div className="container">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              {/* Profile Image */}
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center text-5xl font-bold text-primary flex-shrink-0 overflow-hidden">
                {tutorProfile.profileImageUrl ? (
                  <img src={tutorProfile.profileImageUrl} alt={tutorProfile.name || "Tutor"} className="w-full h-full object-cover" />
                ) : (
                  <span>{(tutorProfile.name || "T").charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Name and Quick Info */}
              <div className="flex-1">
                <h1 className="text-4xl font-bold mb-2">{tutorProfile.name || "Tutor Profile"}</h1>
                <div className="flex flex-wrap gap-4 text-muted-foreground">
                  {tutorProfile.yearsOfExperience && (
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4" />
                      <span>{tutorProfile.yearsOfExperience} years experience</span>
                    </div>
                  )}
                  {hourlyRate > 0 && (
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      <span>${hourlyRate}/hour</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {rating > 0 ? (
                      <span>{rating.toFixed(1)} ({tutorProfile.totalReviews || 0} reviews)</span>
                    ) : (
                      <span className="text-muted-foreground/60">No reviews yet</span>
                    )}
                  </div>
                </div>

                {/* Subjects & Grade Levels */}
                {(subjects.length > 0 || gradeLevels.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {subjects.map((subject: string, idx: number) => (
                      <Badge key={idx} variant="secondary">{subject}</Badge>
                    ))}
                    {gradeLevels.map((level: string, idx: number) => (
                      <Badge key={idx} variant="outline">{level}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Button */}
              <div className="flex-shrink-0">
                {isAuthenticated && user?.role === "parent" && (
                  <Button size="lg" className="gap-2" onClick={() => navigate("/messages")}>
                    <Mail className="w-4 h-4" />
                    Contact Tutor
                  </Button>
                )}
                {!isAuthenticated && (
                  <Button size="lg" asChild>
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

              {/* Qualifications */}
              {tutorProfile.qualifications && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Qualifications & Education
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {tutorProfile.qualifications}
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
                      {(showAllCourses ? displayCourses : displayCourses.slice(0, COURSES_PREVIEW)).map(course => (
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
                              <div className="ml-4">
                                <CoursePrice price={course.price} region={course.region ?? "global"} priceClassName="text-xl font-semibold text-primary" />
                                {course.duration && (
                                  <div className="text-xs text-muted-foreground text-right">
                                    {course.duration} min/session
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center justify-between">
                              <div className="flex gap-2 flex-wrap">
                                <Badge variant="secondary">{course.subject}</Badge>
                                {course.gradeLevel && (
                                  <Badge variant="outline">{course.gradeLevel}</Badge>
                                )}
                                {course.aiPowered && (
                                  <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">
                                    ✦ AI Powered
                                  </Badge>
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
                      {displayCourses.length > COURSES_PREVIEW && (
                        <Button
                          variant="outline"
                          className="w-full gap-2"
                          onClick={() => setShowAllCourses(prev => !prev)}
                        >
                          {showAllCourses ? (
                            <><ChevronUp className="w-4 h-4" /> Show less</>
                          ) : (
                            <><ChevronDown className="w-4 h-4" /> Show {displayCourses.length - COURSES_PREVIEW} more course{displayCourses.length - COURSES_PREVIEW !== 1 ? "s" : ""}</>
                          )}
                        </Button>
                      )}
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
                      {tzConversionAvailable
                        ? `Times shown in your timezone (${viewerTzAbbr})`
                        : tutorTz
                          ? `Times in tutor's timezone (${tutorTz})`
                          : tutorProfile.name ? `${tutorProfile.name}'s usual weekly schedule` : "Usual weekly schedule"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {DAYS_OF_WEEK.map(day => {
                        const daySlots = convertedAvailability.filter(slot => slot.dayOfWeek === day.value);
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

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
