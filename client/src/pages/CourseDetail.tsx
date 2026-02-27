import React from "react";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useParams, Link, useLocation } from "wouter";
import { Clock, DollarSign, BookOpen, Calendar, Users, Download } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { toast } from "sonner";
import { BookableCalendar } from "@/components/BookableCalendar";
import { TutorAvailabilityModal } from "@/components/TutorAvailabilityModal";

export default function CourseDetail() {
  const { id } = useParams();
  const courseId = parseInt(id || "0");
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = React.useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = React.useState(false);
  const [selectedTutorId, setSelectedTutorId] = React.useState<number | null>(null);
  const [studentFirstName, setStudentFirstName] = React.useState("");
  const [studentLastName, setStudentLastName] = React.useState("");
  const [studentGrade, setStudentGrade] = React.useState("");
  const [availabilityModalOpen, setAvailabilityModalOpen] = React.useState(false);
  const [selectedTutorForAvailability, setSelectedTutorForAvailability] = React.useState<{
    id: number;
    name: string;
  } | null>(null);

  const { data: course, isLoading } = trpc.course.get.useQuery({ id: courseId });

  // Fetch availability for selected tutor
  const { data: tutorAvailability = [] } = trpc.tutorAvailability.getByTutorId.useQuery(
    { tutorId: selectedTutorForAvailability?.id || 0 },
    { enabled: !!selectedTutorForAvailability?.id && availabilityModalOpen }
  );
  const { data: tutorsWithAvailability = [] } = trpc.course.getTutorsWithAvailability.useQuery(
    { courseId },
    { enabled: courseId > 0 }
  );
  const { data: mySubscriptionsData = [] } = trpc.subscription.mySubscriptions.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "parent" }
  );
  const createCheckoutMutation = trpc.course.createCheckoutSession.useMutation();
  const enrollWithoutPaymentMutation = trpc.course.enrollWithoutPayment.useMutation();
  const enrollWithInstallmentMutation = trpc.course.enrollWithInstallment.useMutation();

  // Trial lesson state
  const [isTrialDialogOpen, setIsTrialDialogOpen] = React.useState(false);
  const [selectedTrialTutorId, setSelectedTrialTutorId] = React.useState<number | null>(null);
  const [trialStudentFirstName, setTrialStudentFirstName] = React.useState("");
  const [trialStudentLastName, setTrialStudentLastName] = React.useState("");
  const [trialStudentGrade, setTrialStudentGrade] = React.useState("");
  const [selectedTrialTime, setSelectedTrialTime] = React.useState<number | null>(null);

  // Check trial eligibility
  const { data: trialEligibility } = trpc.trialLesson.checkEligibility.useQuery(
    { courseId },
    { enabled: isAuthenticated && user?.role === 'parent' }
  );

  // Book trial lesson directly (Stripe integration disabled for now)
  const bookTrialMutation = trpc.trialLesson.book.useMutation({
    onSuccess: (data) => {
      toast.success(`Trial lesson booked successfully! ${data.trialsRemaining} trial(s) remaining.`);
      setIsTrialDialogOpen(false);
      setSelectedTrialTutorId(null);
      setTrialStudentFirstName("");
      setTrialStudentLastName("");
      setTrialStudentGrade("");
      setSelectedTrialTime(null);
      setLocation("/parent/dashboard");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Extract unique students from existing subscriptions
  const existingStudents = React.useMemo(() => {
    const students = mySubscriptionsData
      .filter((sub: any) => sub.subscription.studentFirstName && sub.subscription.studentLastName)
      .map((sub: any) => ({
        firstName: sub.subscription.studentFirstName!,
        lastName: sub.subscription.studentLastName!,
        grade: sub.subscription.studentGrade || "",
        fullName: `${sub.subscription.studentFirstName} ${sub.subscription.studentLastName}`,
      }));
    
    // Remove duplicates based on full name
    const uniqueStudents = students.filter((student: any, index: number, self: any[]) =>
      index === self.findIndex((s: any) => s.fullName === student.fullName)
    );
    
    return uniqueStudents;
  }, [mySubscriptionsData]);

  const handleSelectExistingStudent = (fullName: string) => {
    const student = existingStudents.find(s => s.fullName === fullName);
    if (student) {
      setStudentFirstName(student.firstName);
      setStudentLastName(student.lastName);
      setStudentGrade(student.grade);
    }
  };

  const handleEnrollClick = () => {
    if (!isAuthenticated) {
      window.location.href = LOGIN_PATH;
      return;
    }

    if (user?.role !== "parent") {
      toast.error("Only parents can enroll in courses");
      return;
    }

    setIsEnrollDialogOpen(true);
  };

  const handleEnroll = async () => {
    if (!studentFirstName || !studentLastName) {
      toast.error("Please provide student's first and last name");
      return;
    }

    try {
      const result = await createCheckoutMutation.mutateAsync({
        courseId,
        preferredTutorId: selectedTutorId || undefined,
        studentFirstName,
        studentLastName,
        studentGrade: studentGrade || "Not specified",
      });

      if (result?.success) {
        setIsEnrollDialogOpen(false);
        toast.success("Enrollment completed and payment marked as paid.");
        setLocation("/parent/dashboard");
      } else {
        toast.error("Enrollment failed. Please try again.");
      }
    } catch (error) {
      toast.error("Failed to process enrollment");
    }
  };

  const handlePayLater = async () => {
    if (!studentFirstName || !studentLastName) {
      toast.error("Please provide student's first and last name");
      return;
    }

    try {
      await enrollWithoutPaymentMutation.mutateAsync({
        courseId,
        studentFirstName,
        studentLastName,
        studentGrade: studentGrade || "Not specified",
        preferredTutorId: selectedTutorId || undefined,
      });

      setIsEnrollDialogOpen(false);
      
      // If tutor is selected, offer to book first session
      if (selectedTutorId) {
        toast.success("Enrolled successfully! Would you like to book your first session?", {
          action: {
            label: "Book Now",
            onClick: () => setIsBookingDialogOpen(true),
          },
        });
      } else {
        toast.success("Enrolled successfully! You can pay later from your dashboard.");
      }
      setLocation("/parent/dashboard");
    } catch (error) {
      toast.error("Failed to enroll");
    }
  };

  const handleInstallmentPayment = async () => {
    if (!studentFirstName || !studentLastName) {
      toast.error("Please provide student's first and last name");
      return;
    }

    try {
      const { checkoutUrl } = await enrollWithInstallmentMutation.mutateAsync({
        courseId,
        preferredTutorId: selectedTutorId || undefined,
        studentFirstName,
        studentLastName,
        studentGrade: studentGrade || "Not specified",
      });

      if (checkoutUrl) {
        setIsEnrollDialogOpen(false);
        toast.success("Redirecting to payment for first installment...");
        window.open(checkoutUrl, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to process installment enrollment");
    }
  };

  const handleBookTrial = (tutorId: number) => {
    if (!isAuthenticated) {
      window.location.href = LOGIN_PATH;
      return;
    }

    if (user?.role !== 'parent') {
      toast.error("Only parents can book trial lessons");
      return;
    }

    // Check if eligible
    if (!trialEligibility?.eligible) {
      toast.error("You have used all your trial lessons. Please enroll in the course.");
      return;
    }

    setSelectedTrialTutorId(tutorId);
    setIsTrialDialogOpen(true);
  };

  const handleTrialBookingComplete = (scheduledAt: number) => {
    if (!selectedTrialTutorId || !scheduledAt) {
      toast.error("Please select a time slot");
      return;
    }

    if (!trialStudentFirstName || !trialStudentLastName) {
      toast.error("Please provide student's first and last name");
      return;
    }

    // Book trial lesson directly (Stripe integration disabled)
    bookTrialMutation.mutate({
      courseId,
      tutorId: selectedTrialTutorId,
      scheduledAt,
      duration: 60,
      studentFirstName: trialStudentFirstName,
      studentLastName: trialStudentLastName,
      studentGrade: trialStudentGrade,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="container py-12 mt-20">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="container py-12 text-center mt-20">
          <h1 className="text-2xl font-bold mb-4">Course Not Found</h1>
          <Button asChild>
            <Link href="/tutors">Back to Tutors</Link>
          </Button>
        </div>
      </div>
    );
  }

  const price = parseFloat(course.price);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 mt-20">
        {/* Course Header */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-b border-border">
          <div className="container py-12">
            <div className="max-w-4xl">
              <div className="flex gap-2 mb-4">
                <Badge variant="secondary">{course.subject}</Badge>
                {course.gradeLevel && (
                  <Badge variant="outline">{course.gradeLevel}</Badge>
                )}
              </div>
              <h1 className="text-4xl font-bold mb-4">{course.title}</h1>
              {course.description && (
                <p className="text-lg text-muted-foreground leading-relaxed">
                  {course.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container py-12">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Course Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    {course.duration && (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Session Duration</p>
                          <p className="text-sm text-muted-foreground">{course.duration} minutes</p>
                        </div>
                      </div>
                    )}

                    {course.sessionsPerWeek && (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Sessions Per Week</p>
                          <p className="text-sm text-muted-foreground">{course.sessionsPerWeek} sessions</p>
                        </div>
                      </div>
                    )}

                    {course.totalSessions && (
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">Total Sessions</p>
                          <p className="text-sm text-muted-foreground">{course.totalSessions} sessions</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Format</p>
                        <p className="text-sm text-muted-foreground">One-on-one tutoring</p>
                      </div>
                    </div>
                  </div>

                  {course.description && (
                    <div className="pt-6 border-t border-border">
                      <h3 className="font-semibold mb-3">About This Course</h3>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {course.description}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>



              {course.curriculum && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Curriculum Details</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(`/api/pdf/curriculum/${courseId}`, '_blank');
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <div className="whitespace-pre-wrap text-muted-foreground leading-relaxed">
                        {course.curriculum}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar - Enrollment Card */}
            <div>
              <Card className="sticky top-24 border-2 z-20 bg-background">
                <CardHeader>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-4xl font-bold text-primary">${price}</span>
                    {course.totalSessions && (
                      <span className="text-sm text-muted-foreground">
                        / {course.totalSessions} sessions
                      </span>
                    )}
                  </div>
                  <CardDescription>
                    {course.totalSessions 
                      ? `$${(price / course.totalSessions).toFixed(2)} per session`
                      : "Course package pricing"
                    }
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isAuthenticated ? (
                    user?.role === "parent" ? (
                      <>
                      <Dialog open={isEnrollDialogOpen} onOpenChange={setIsEnrollDialogOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full" size="lg" onClick={handleEnrollClick}>
                            Enroll Now
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Student Information</DialogTitle>
                            <DialogDescription>
                              Please provide information about the student who will be taking this course.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            {/* Tutor Selection */}
                            {tutorsWithAvailability.length > 0 && (
                              <div className="space-y-3">
                                <Label>Select Preferred Tutor (Optional)</Label>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Choose your preferred tutor. You can schedule sessions after enrollment.
                                </p>
                                <Select value={selectedTutorId?.toString() || ""} onValueChange={(value) => setSelectedTutorId(value ? parseInt(value) : null)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a tutor (optional)" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {tutorsWithAvailability.map((tutor: any) => (
                                      <SelectItem key={tutor.user.id} value={tutor.user.id.toString()}>
                                        {tutor.user.name} {tutor.profile?.hourlyRate && `- $${tutor.profile.hourlyRate}/hr`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            {existingStudents.length > 0 && (
                              <div className="space-y-2">
                                <Label htmlFor="existing-student">Select Existing Student (Optional)</Label>
                                <Select onValueChange={handleSelectExistingStudent}>
                                  <SelectTrigger id="existing-student">
                                    <SelectValue placeholder="Choose a student or enter new" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {existingStudents.map((student) => (
                                      <SelectItem key={student.fullName} value={student.fullName}>
                                        {student.fullName} {student.grade && `(${student.grade})`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label htmlFor="firstName">First Name *</Label>
                                <Input
                                  id="firstName"
                                  value={studentFirstName}
                                  onChange={(e) => setStudentFirstName(e.target.value)}
                                  placeholder="John"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="lastName">Last Name *</Label>
                                <Input
                                  id="lastName"
                                  value={studentLastName}
                                  onChange={(e) => setStudentLastName(e.target.value)}
                                  placeholder="Doe"
                                  required
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="grade">Grade (Optional)</Label>
                              <Select value={studentGrade} onValueChange={setStudentGrade}>
                                <SelectTrigger id="grade">
                                  <SelectValue placeholder="Select grade level" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Kindergarten">Kindergarten</SelectItem>
                                  <SelectItem value="1st Grade">1st Grade</SelectItem>
                                  <SelectItem value="2nd Grade">2nd Grade</SelectItem>
                                  <SelectItem value="3rd Grade">3rd Grade</SelectItem>
                                  <SelectItem value="4th Grade">4th Grade</SelectItem>
                                  <SelectItem value="5th Grade">5th Grade</SelectItem>
                                  <SelectItem value="6th Grade">6th Grade</SelectItem>
                                  <SelectItem value="7th Grade">7th Grade</SelectItem>
                                  <SelectItem value="8th Grade">8th Grade</SelectItem>
                                  <SelectItem value="9th Grade">9th Grade</SelectItem>
                                  <SelectItem value="10th Grade">10th Grade</SelectItem>
                                  <SelectItem value="11th Grade">11th Grade</SelectItem>
                                  <SelectItem value="12th Grade">12th Grade</SelectItem>
                                  <SelectItem value="College">College</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-3">
                            {price > 500 && (
                              <div className="bg-accent/10 border border-accent/20 rounded-lg p-4">
                                <p className="text-sm font-medium mb-2">💳 Installment Plan Available</p>
                                <p className="text-xs text-muted-foreground mb-3">
                                  Pay in 2 installments: ${(price / 2).toFixed(2)} now, ${(price / 2).toFixed(2)} later
                                </p>
                                <Button
                                  variant="default"
                                  className="w-full"
                                  onClick={handleInstallmentPayment}
                                  disabled={enrollWithInstallmentMutation.isPending || !studentFirstName || !studentLastName}
                                >
                                  {enrollWithInstallmentMutation.isPending ? "Processing..." : "Pay in 2 Installments"}
                                </Button>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setIsEnrollDialogOpen(false)}
                              >
                                Cancel
                              </Button>
                              <Button
                                className="flex-1"
                                onClick={handleEnroll}
                                disabled={createCheckoutMutation.isPending || !studentFirstName || !studentLastName}
                              >
                                {createCheckoutMutation.isPending ? "Processing..." : "Pay in Full"}
                              </Button>
                            </div>
                            <Button
                              variant="secondary"
                              className="w-full"
                              onClick={handlePayLater}
                              disabled={enrollWithoutPaymentMutation.isPending || !studentFirstName || !studentLastName}
                            >
                              {enrollWithoutPaymentMutation.isPending ? "Enrolling..." : "Pay Later"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      {/* Booking Dialog - Opens after enrollment */}
                      <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
                        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Book Your First Session</DialogTitle>
                            <DialogDescription>
                              Select a date and time for your first tutoring session with {tutorsWithAvailability.find((t: any) => t.user.id === selectedTutorId)?.user.name || 'your tutor'}.
                            </DialogDescription>
                          </DialogHeader>
                          {selectedTutorId && course && (
                            <BookableCalendar 
                              tutorId={selectedTutorId}
                              tutorName={tutorsWithAvailability.find((t: any) => t.user.id === selectedTutorId)?.user.name || 'Tutor'}
                              courseId={course.id}
                              courseName={course.title}
                              sessionDuration={60}
                              onBookingComplete={() => {
                                toast.success("Session booked successfully!");
                                setIsBookingDialogOpen(false);
                                setLocation("/parent/dashboard");
                              }}
                            />
                          )}
                        </DialogContent>
                      </Dialog>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-3">
                          Only parent accounts can enroll in courses
                        </p>
                        <Button asChild variant="outline" className="w-full">
                          <Link href="/role-selection">
                            Switch to Parent Account
                          </Link>
                        </Button>
                      </div>
                    )
                  ) : (
                    <>
                      <Button asChild className="w-full" size="lg">
                        <a href={LOGIN_PATH}>Sign In to Enroll</a>
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Create a free account to get started
                      </p>
                    </>
                  )}

                  <div className="pt-4 border-t border-border space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Instant confirmation</span>
                      <span className="font-medium">✓</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Flexible scheduling</span>
                      <span className="font-medium">✓</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Direct messaging</span>
                      <span className="font-medium">✓</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Progress tracking</span>
                      <span className="font-medium">✓</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Assigned Tutors Section */}
              {course.tutors && course.tutors.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Assigned Tutors</CardTitle>
                    <CardDescription>
                      Meet the qualified tutors who teach this course
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {course.tutors.map((tutorAssignment) => (
                        <div key={tutorAssignment.tutorId} className="pb-6 border-b last:border-0 last:pb-0">
                          <div className="flex flex-col sm:flex-row gap-4">
                            <Avatar className="h-16 w-16 flex-shrink-0">
                              <AvatarImage src={tutorAssignment.profile?.profileImageUrl || undefined} alt={tutorAssignment.user.name || 'Tutor'} />
                              <AvatarFallback className="text-lg">
                                {tutorAssignment.user.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'T'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0 space-y-3">
                              <div>
                                <Link href={`/tutor/${tutorAssignment.tutorId}`}>
                                  <h3 className="font-semibold text-lg hover:text-primary cursor-pointer transition-colors break-words">
                                    {tutorAssignment.user.name}
                                  </h3>
                                </Link>
                                <p className="text-sm text-muted-foreground">
                                  {tutorAssignment.profile?.bio ? tutorAssignment.profile.bio.split('\n')[0] : 'English tutor'}
                                </p>
                              </div>
                              {tutorAssignment.profile?.bio && tutorAssignment.profile.bio.includes('\n') && (
                                <p className="text-sm text-muted-foreground leading-relaxed break-words">
                                  {tutorAssignment.profile.bio.split('\n').slice(1).join('\n')}
                                </p>
                              )}
                              <div className="flex flex-col xs:flex-row gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full xs:w-auto whitespace-nowrap"
                                  onClick={() => {
                                    setSelectedTutorForAvailability({
                                      id: tutorAssignment.tutorId,
                                      name: tutorAssignment.user.name || "Tutor"
                                    });
                                    setAvailabilityModalOpen(true);
                                  }}
                                >
                                  View Availability
                                </Button>
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="w-full xs:w-auto whitespace-nowrap"
                                  onClick={() => handleBookTrial(tutorAssignment.tutorId)}
                                  disabled={!trialEligibility?.eligible}
                                >
                                  {trialEligibility?.eligible
                                    ? `Book Trial Lesson (${trialEligibility.trialsRemaining}/2 left)`
                                    : "Trial Limit Reached"
                                  }
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trial Booking Dialog */}
      <Dialog open={isTrialDialogOpen} onOpenChange={setIsTrialDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book Your Trial Lesson</DialogTitle>
            <DialogDescription>
              Experience our teaching style with a free trial lesson!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {trialEligibility && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-blue-900 dark:text-blue-200">
                    <strong>Trials Remaining:</strong> {trialEligibility.trialsRemaining} of 2
                  </p>
                </div>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Book a full 60-minute trial session to experience our teaching quality!
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="trial-firstName">Student First Name *</Label>
                <Input
                  id="trial-firstName"
                  value={trialStudentFirstName}
                  onChange={(e) => setTrialStudentFirstName(e.target.value)}
                  placeholder="John"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trial-lastName">Student Last Name *</Label>
                <Input
                  id="trial-lastName"
                  value={trialStudentLastName}
                  onChange={(e) => setTrialStudentLastName(e.target.value)}
                  placeholder="Doe"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="trial-grade">Grade (Optional)</Label>
              <Select value={trialStudentGrade} onValueChange={setTrialStudentGrade}>
                <SelectTrigger id="trial-grade">
                  <SelectValue placeholder="Select grade level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kindergarten">Kindergarten</SelectItem>
                  <SelectItem value="1st Grade">1st Grade</SelectItem>
                  <SelectItem value="2nd Grade">2nd Grade</SelectItem>
                  <SelectItem value="3rd Grade">3rd Grade</SelectItem>
                  <SelectItem value="4th Grade">4th Grade</SelectItem>
                  <SelectItem value="5th Grade">5th Grade</SelectItem>
                  <SelectItem value="6th Grade">6th Grade</SelectItem>
                  <SelectItem value="7th Grade">7th Grade</SelectItem>
                  <SelectItem value="8th Grade">8th Grade</SelectItem>
                  <SelectItem value="9th Grade">9th Grade</SelectItem>
                  <SelectItem value="10th Grade">10th Grade</SelectItem>
                  <SelectItem value="11th Grade">11th Grade</SelectItem>
                  <SelectItem value="12th Grade">12th Grade</SelectItem>
                  <SelectItem value="College">College</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedTrialTutorId && course && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Select a Time for Your Trial Lesson</h3>
                <BookableCalendar
                  tutorId={selectedTrialTutorId}
                  tutorName={course.tutors?.find((t: any) => t.tutorId === selectedTrialTutorId)?.user.name || 'Tutor'}
                  courseId={course.id}
                  courseName={course.title}
                  sessionDuration={60}
                  isTrial={true}
                  onBookingComplete={handleTrialBookingComplete}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Tutor Availability Modal */}
      {selectedTutorForAvailability && (
        <TutorAvailabilityModal
          open={availabilityModalOpen}
          onOpenChange={setAvailabilityModalOpen}
          tutorId={selectedTutorForAvailability.id}
          tutorName={selectedTutorForAvailability.name}
          availability={tutorAvailability}
        />
      )}
    </div>
  );
}
