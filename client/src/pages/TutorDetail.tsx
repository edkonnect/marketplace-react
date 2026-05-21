import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import { CoursePrice } from "@/components/CoursePrice";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { Star, BookOpen, Clock, Calendar as CalendarIcon, Mail } from "lucide-react";
import { VideoPlayerWithRecommendations } from "@/components/VideoPlayerWithRecommendations";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import TutorAvailabilityDisplay from "@/components/TutorAvailabilityDisplay";
import {
  convertFromUTC,
  createTimestamp,
  detectUserTimezone,
  formatSessionTime,
} from "@/../../shared/timezone-utils";

type AvailabilitySlot = {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
};

type DisplayAvailabilitySlot = AvailabilitySlot & {
  key: string;
  sortKey: number;
};

function convertWeeklyAvailabilityToTimezone(
  availability: AvailabilitySlot[],
  tutorTimezone: string,
  viewerTimezone: string
): DisplayAvailabilitySlot[] {
  const convertedSlots: DisplayAvailabilitySlot[] = [];

  for (const slot of availability) {
    if (!slot.isActive) continue;

    const [startHour, startMinute] = slot.startTime.split(":").map(Number);
    const [endHour, endMinute] = slot.endTime.split(":").map(Number);

    const startUTC = createTimestamp(2024, 0, 7 + slot.dayOfWeek, startHour, startMinute, tutorTimezone);
    let endUTC = createTimestamp(2024, 0, 7 + slot.dayOfWeek, endHour, endMinute, tutorTimezone);

    if (endUTC <= startUTC) {
      endUTC += 24 * 60 * 60 * 1000;
    }

    const viewerStart = convertFromUTC(startUTC, viewerTimezone);
    const viewerEnd = convertFromUTC(endUTC, viewerTimezone);
    const startDayOfWeek = viewerStart.getDay();
    const endDayOfWeek = viewerEnd.getDay();
    const startLabel = formatSessionTime(startUTC, viewerTimezone, "HH:mm");
    const endLabel = formatSessionTime(endUTC, viewerTimezone, "HH:mm");
    const startSortKey = viewerStart.getHours() * 60 + viewerStart.getMinutes();

    if (startDayOfWeek === endDayOfWeek) {
      convertedSlots.push({
        ...slot,
        key: `${slot.id}-${startDayOfWeek}-${startLabel}-${endLabel}`,
        dayOfWeek: startDayOfWeek,
        startTime: startLabel,
        endTime: endLabel,
        sortKey: startSortKey,
      });
      continue;
    }

    const endOfStartDayUTC = createTimestamp(
      viewerStart.getFullYear(),
      viewerStart.getMonth(),
      viewerStart.getDate(),
      23,
      59,
      viewerTimezone
    );
    const startOfEndDayUTC = createTimestamp(
      viewerEnd.getFullYear(),
      viewerEnd.getMonth(),
      viewerEnd.getDate(),
      0,
      0,
      viewerTimezone
    );

    convertedSlots.push({
      ...slot,
      key: `${slot.id}-${startDayOfWeek}-${startLabel}-split-start`,
      dayOfWeek: startDayOfWeek,
      startTime: startLabel,
      endTime: formatSessionTime(endOfStartDayUTC, viewerTimezone, "HH:mm"),
      sortKey: startSortKey,
    });
    convertedSlots.push({
      ...slot,
      key: `${slot.id}-${endDayOfWeek}-${endLabel}-split-end`,
      dayOfWeek: endDayOfWeek,
      startTime: formatSessionTime(startOfEndDayUTC, viewerTimezone, "HH:mm"),
      endTime: endLabel,
      sortKey: 0,
    });
  }

  return convertedSlots.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    return a.sortKey - b.sortKey;
  });
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
  const tutorTz = tutorProfile ? ((tutorProfile as any).businessTimezone || (tutorProfile as any).timezone || null) : null;
  const [selectedViewerTz, setSelectedViewerTz] = useState<string>(() => user?.timezone || detectUserTimezone());
const convertedAvailability = useMemo(() => {
    const activeAvailability = (availability ?? []).filter((slot) => slot.isActive);
    if (!activeAvailability.length) return [];
    if (!tutorTz) {
      return activeAvailability.map((slot) => ({
        ...slot,
        key: `${slot.id}-${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`,
        sortKey: Number.parseInt(slot.startTime.slice(0, 2), 10) * 60 + Number.parseInt(slot.startTime.slice(3, 5), 10),
      }));
    }
    return convertWeeklyAvailabilityToTimezone(activeAvailability, tutorTz, selectedViewerTz);
  }, [availability, tutorTz, selectedViewerTz]);

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1">
        {/* Profile Header */}
        <div className="bg-background border-b border-border pt-24 pb-16">
          <div className="container">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1.5" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
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
                  <Button
                    size="lg"
                    className="gap-2"
                    onClick={() => navigate(`/messages?inquiryTutorId=${tutorId}`)}
                  >
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
                                <CoursePrice price={course.price} priceInr={course.priceInr} region={course.region ?? "global"} priceClassName="text-xl font-semibold text-primary" />
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
                <TutorAvailabilityDisplay
                  availability={availability}
                  tutorId={tutorId}
                  tutorTimezone={tutorTz}
                  viewerTimezone={selectedViewerTz}
                  onViewerTimezoneChange={setSelectedViewerTz}
                />
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
                      {tutorTz && tutorTz !== selectedViewerTz
                        ? `Tutor's schedule is in ${tutorTz}. Times converted to:`
                        : `Times shown in:`}
                    </CardDescription>
                    <TimezoneSelector
                      value={selectedViewerTz}
                      onChange={setSelectedViewerTz}
                      showDetected={false}
                      label=""
                      className="mt-1"
                    />
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
                                    <div key={slot.key} className="flex items-center gap-2 text-sm">
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
      <Footer />
    </div>
  );
}
