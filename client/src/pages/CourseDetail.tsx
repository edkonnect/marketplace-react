import React from "react";
import { RichTextDisplay } from "@/components/RichTextEditor";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { CoursePrice } from "@/components/CoursePrice";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useIsIndianUser } from "@/hooks/useIsIndianUser";
import { useExchangeRate } from "@/hooks/useExchangeRate";
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
import { Clock, DollarSign, BookOpen, Calendar, Users, Download, ArrowLeft } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { toast } from "sonner";
import { BookableCalendar } from "@/components/BookableCalendar";
import { TutorAvailabilityModal } from "@/components/TutorAvailabilityModal";
import { detectUserTimezone } from "@/../../shared/timezone-utils";

export default function CourseDetail() {
  const { id } = useParams();
  const courseId = parseInt(id || "0");
  const formatPrice = useFormatPrice();
  const isIndian = useIsIndianUser();
  const exchangeRate = useExchangeRate();
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = React.useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = React.useState(false);
  const [selectedTutorId, setSelectedTutorId] = React.useState<number | null>(null);
  const [studentFirstName, setStudentFirstName] = React.useState("");
  const [studentLastName, setStudentLastName] = React.useState("");
  const [studentGrade, setStudentGrade] = React.useState("");
  const [availabilityModalOpen, setAvailabilityModalOpen] = React.useState(false);
  const [showDiscountBreakdown, setShowDiscountBreakdown] = React.useState(false);
  const [expandedBios, setExpandedBios] = React.useState<Set<number>>(new Set());
  const [selectedTutorForAvailability, setSelectedTutorForAvailability] = React.useState<{
    id: number;
    name: string;
    timezone?: string | null;
  } | null>(null);
  const [viewerTimezone, setViewerTimezone] = React.useState<string>(() => detectUserTimezone());

  const { data: course, isLoading } = trpc.course.get.useQuery({ id: courseId });

  const { data: refDiscount } = trpc.referral.getDiscountForCourse.useQuery(
    { coursePriceUsd: parseFloat(course?.price ?? "0") },
    { enabled: !!course, staleTime: 60 * 60 * 1000 }
  );

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
  const { data: siblingDiscountData } = trpc.subscription.checkSiblingDiscount.useQuery(
    { studentFirstName, studentLastName },
    { enabled: isAuthenticated && user?.role === "parent" && !!studentFirstName && !!studentLastName }
  );
  const siblingDiscount = siblingDiscountData?.eligible ?? false;
  const discountPercent = siblingDiscountData?.discountPercent ?? 0;

  // Promo code state
  const [promoCode, setPromoCode] = React.useState("");
  const [promoValidation, setPromoValidation] = React.useState<{ valid: boolean; discountAmountUsd?: number; discountAmountInr?: number; reason?: string; isExternalPromo?: boolean; discountPercent?: number } | null>(null);
  const [isValidatingExternalPromo, setIsValidatingExternalPromo] = React.useState(false);
  const validateCouponQuery = trpc.referral.validateCoupon.useQuery(
    { code: promoCode, coursePriceUsd: course ? parseFloat(course.price) : undefined },
    { enabled: false }
  );

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    if (promoCode.trim().toUpperCase().startsWith("EDK-")) {
      if (!user?.email) {
        setPromoValidation({ valid: false, reason: "Please log in to apply this code." });
        return;
      }
      setIsValidatingExternalPromo(true);
      try {
        const inputParam = encodeURIComponent(JSON.stringify({ json: { code: promoCode.trim().toUpperCase(), parentEmail: user.email } }));
        const url = `${import.meta.env.VITE_REFERRAL_APP_URL}/api/trpc/promoCodes.validate?input=${inputParam}`;
        const res = await fetch(url);
        const json = await res.json();
        const d = json?.result?.data?.json ?? json?.result?.data;
        if (d?.valid) {
          setPromoValidation({ valid: true, isExternalPromo: true, discountPercent: 10 });
        } else {
          const reason = d?.reason === "email_mismatch"
            ? "This code is not linked to your account."
            : "Invalid or expired promo code.";
          setPromoValidation({ valid: false, reason });
        }
      } catch {
        setPromoValidation({ valid: false, reason: "Could not validate code. Please try again." });
      } finally {
        setIsValidatingExternalPromo(false);
      }
      return;
    }
    const result = await validateCouponQuery.refetch();
    if (result.data) setPromoValidation(result.data);
  };

  // Promo code gives fixed USD amount off; EDK- codes give 10% of course price
  const coursePrice = course ? parseFloat(course.price) : 0;
  const promoDiscountUsd = promoValidation?.valid
    ? promoValidation.isExternalPromo
      ? Math.round(coursePrice * 10) / 100
      : (promoValidation.discountAmountUsd ?? 0)
    : 0;

  const createCheckoutMutation = trpc.course.createCheckoutSession.useMutation();
  const enrollWithoutPaymentMutation = trpc.course.enrollWithoutPayment.useMutation();
  const enrollWithInstallmentsMutation = trpc.course.enrollWithInstallments.useMutation();

  // Request tutor state
  const [isTutorRequestOpen, setIsTutorRequestOpen] = React.useState(false);
  const [tutorRequestMessage, setTutorRequestMessage] = React.useState("");
  const requestTutorMutation = trpc.course.requestTutorAssignment.useMutation();
  const { data: tutorRequestStatus, refetch: refetchTutorRequestStatus } = trpc.course.checkTutorRequest.useQuery(
    { courseId },
    { enabled: isAuthenticated && user?.role === "parent" && courseId > 0 }
  );
  const alreadyRequestedTutor = tutorRequestStatus?.requested ?? false;

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

  const createTrialCheckoutMutation = trpc.trialLesson.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      toast.error(`Failed to start payment: ${error.message}`);
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

  const handleSelectExistingStudentForTrial = (fullName: string) => {
    const student = existingStudents.find(s => s.fullName === fullName);
    if (student) {
      setTrialStudentFirstName(student.firstName);
      setTrialStudentLastName(student.lastName);
      setTrialStudentGrade(student.grade || "");
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
        studentGrade: studentGrade || "Grade Not Specified",
        origin: window.location.origin,
        promoCode: promoValidation?.valid ? promoCode.trim().toUpperCase() : undefined,
      });

      if (result?.success) {
        setIsEnrollDialogOpen(false);
        if (result.checkoutUrl) {
          // Store the applied promo code so the dashboard can suppress the popup after redirect
          if (promoValidation?.valid && promoCode.trim()) {
            sessionStorage.setItem("justUsedCoupon", promoCode.trim().toUpperCase());
          }
          toast.success("Opening payment in a new tab...");
          window.open(result.checkoutUrl, "_blank");
        } else {
          toast.success("Enrollment created. Complete payment from your dashboard.");
          setLocation("/parent/dashboard");
        }
      } else {
        toast.error("Enrollment failed. Please try again.");
      }
    } catch (error: any) {
      const message = error?.data?.message || error?.message || "Failed to process enrollment";
      toast.error(message);
    }
  };

  const handlePayLater = async () => {
    if (!studentFirstName || !studentLastName) {
      toast.error("Please provide student's first and last name");
      return;
    }

    try {
      const result = await enrollWithoutPaymentMutation.mutateAsync({
        courseId,
        studentFirstName,
        studentLastName,
        studentGrade: studentGrade || "Grade Not specified",
        preferredTutorId: selectedTutorId || undefined,
        origin: window.location.origin,
        promoCode: promoValidation?.valid ? promoCode.trim().toUpperCase() : undefined,
      });

      setIsEnrollDialogOpen(false);

      if (result?.setupUrl) {
        toast.success("Enrolled! Opening monthly billing setup in a new tab...");
        window.open(result.setupUrl, "_blank");
      } else {
        toast.success("Enrolled successfully! Add your payment method from the dashboard.");
        setLocation("/parent/dashboard");
      }
    } catch (error: any) {
      const message = error?.data?.message || error?.message || "Failed to enroll";
      toast.error(message);
    }
  };

  const handleEnrollInstallments = async () => {
    if (!studentFirstName || !studentLastName) {
      toast.error("Please provide student's first and last name");
      return;
    }
    try {
      const result = await enrollWithInstallmentsMutation.mutateAsync({
        courseId,
        preferredTutorId: selectedTutorId || undefined,
        studentFirstName,
        studentLastName,
        studentGrade: studentGrade || "Grade Not Specified",
        origin: window.location.origin,
        promoCode: promoValidation?.valid ? promoCode.trim().toUpperCase() : undefined,
      });
      setIsEnrollDialogOpen(false);
      if (result?.setupUrl) {
        toast.success("Enrolled! Opening installment billing setup in a new tab...");
        window.open(result.setupUrl, "_blank");
      } else {
        toast.success("Enrolled successfully! Add your payment method from the dashboard.");
        setLocation("/parent/dashboard");
      }
    } catch (error: any) {
      const message = error?.data?.message || error?.message || "Failed to enroll";
      toast.error(message);
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

  const handleTrialBookingComplete = (scheduledAt: number | undefined) => {
    if (!selectedTrialTutorId || !scheduledAt) {
      toast.error("Please select a time slot");
      return;
    }

    if (!trialStudentFirstName || !trialStudentLastName) {
      toast.error("Please provide student's first and last name");
      return;
    }

    createTrialCheckoutMutation.mutate({
      courseId,
      tutorId: selectedTrialTutorId,
      scheduledAt,
      duration: 60,
      studentFirstName: trialStudentFirstName,
      studentLastName: trialStudentLastName,
      studentGrade: trialStudentGrade,
      origin: window.location.origin,
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

  const priceUsd = parseFloat(course.price);
  const priceInrStored = course.priceInr ? parseFloat(course.priceInr) : null;
  const price = isIndian ? (priceInrStored ?? Math.round(priceUsd * exchangeRate)) : priceUsd;
  // fmt formats an already-currency-correct amount — avoids double-conversion when price is already INR
  const fmt = (amt: number) => isIndian
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amt)
    : `$${amt % 1 === 0 ? amt.toFixed(0) : amt.toFixed(2)}`;
  // For display: convert USD promo discount to INR when showing INR prices
  const promoDiscountDisplay = isIndian && promoDiscountUsd > 0 ? Math.round(promoDiscountUsd * exchangeRate) : promoDiscountUsd;
  const isTestPrep = course.courseType === "test_prep";
  const isUsageBased = course.courseType === "tutor" || course.courseType === "homework";
  const LOYALTY_DISCOUNT_PCT = 5;
  // 5% loyalty discount on full payment for all course types + sibling discount stack, capped at 100%
  const totalPctDiscount = Math.min(100, LOYALTY_DISCOUNT_PCT + (siblingDiscount ? discountPercent : 0));
  const pctDiscountAmount = totalPctDiscount > 0 ? price * totalPctDiscount / 100 : 0;
  const effectiveTotal = Math.max(0, price - pctDiscountAmount - promoDiscountDisplay);
  // Per-session rate for Tutor/Homework — applies sibling + promo discounts (loyalty is pay-in-full only)
  const siblingOnlyDiscountAmount = siblingDiscount ? price * discountPercent / 100 : 0;
  const discountedMonthlyBase = Math.max(0, price - siblingOnlyDiscountAmount - promoDiscountDisplay);
  const perSessionRate = course.totalSessions ? discountedMonthlyBase / course.totalSessions : null;
  // Installment amount (3 equal parts of discounted price, sibling+promo only)
  const installmentAmount = discountedMonthlyBase / 3;

  // "As low as" — best-case price assuming loyalty + sibling + referral promo all applied
  const refDiscountAmt = isIndian
    ? (refDiscount?.discountAmountInr ?? 0)
    : (refDiscount?.discountAmountUsd ?? 0);
  const asLowAs = Math.max(0, price * (1 - (LOYALTY_DISCOUNT_PCT + 5) / 100) - refDiscountAmt);
  const asLowAsPerSession = course.totalSessions ? asLowAs / course.totalSessions : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 mt-20">
        {/* Course Header */}
        <div className="bg-gradient-to-br from-primary/5 via-accent/5 to-background border-b border-border">
          <div className="container py-12">
            <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1.5" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="max-w-4xl">
              <div className="flex gap-2 mb-4">
                <Badge variant="secondary">{course.subject}</Badge>
                {course.gradeLevel && course.gradeLevel.split(",").map((g: string) => (
                  <Badge key={g} variant="outline">{g.trim()}</Badge>
                ))}
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
                    <RichTextDisplay html={course.curriculum} />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar - Enrollment Card */}
            <div>
              <Card className="sticky top-24 border-2 z-20 bg-background">
                <CardHeader className="space-y-2">
                  {/* Actual price */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{fmt(price)}</span>
                    {course.totalSessions && (
                      <span className="text-sm text-muted-foreground">/ {course.totalSessions} sessions</span>
                    )}
                  </div>
                  {/* As low as (discounted total) + inline Show button */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-normal">as low as</span>
                    <span className="text-2xl font-bold text-primary">{fmt(asLowAs)}</span>
                    <button
                      type="button"
                      onClick={() => setShowDiscountBreakdown(v => !v)}
                      className="text-xs font-medium border border-primary text-primary rounded px-2 py-0.5 hover:bg-primary/10 transition-colors"
                    >
                      {showDiscountBreakdown ? "Hide" : "Show"}
                    </button>
                  </div>
                  {/* Discount breakdown */}
                  {showDiscountBreakdown && (
                    <div className="space-y-1 text-sm border rounded-lg p-3 bg-muted/30">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Base price</span>
                        <span>{fmt(price)}</span>
                      </div>
                      <div className="flex justify-between text-blue-600 dark:text-blue-400">
                        <span>Loyalty discount (5% off, pay-in-full)</span>
                        <span>−{fmt(price * LOYALTY_DISCOUNT_PCT / 100)}</span>
                      </div>
                      <div className="flex justify-between text-purple-600 dark:text-purple-400">
                        <span>Sibling discount (5% off)</span>
                        <span>−{fmt(price * 5 / 100)}</span>
                      </div>
                      {refDiscountAmt > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Referral promo code</span>
                          <span>−{fmt(refDiscountAmt)}</span>
                        </div>
                      )}
                      <div className="border-t border-border pt-1 flex justify-between font-semibold">
                        <span>As low as</span>
                        <span className="text-primary">{fmt(asLowAs)}</span>
                      </div>
                      {asLowAsPerSession && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Per session ({course.totalSessions} sessions)</span>
                          <span>{fmt(asLowAsPerSession)}/session</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground pt-1">
                        * Sibling discount applies when another child is already enrolled. Loyalty discount requires pay-in-full. Promo code required for referral discount.
                      </p>
                    </div>
                  )}
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
                                <Label>Select Preferred Tutor</Label>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Choose your preferred tutor. You can schedule sessions after enrollment.
                                </p>
                                <Select value={selectedTutorId?.toString() || ""} onValueChange={(value) => setSelectedTutorId(value ? parseInt(value) : null)}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a tutor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {tutorsWithAvailability.map((tutor: any) => (
                                      <SelectItem key={tutor.user.id} value={tutor.user.id.toString()}>
                                        {tutor.user.name}
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
                          {siblingDiscount && (
                            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                              <Badge className="bg-green-600 text-white text-xs shrink-0">
                                {discountPercent}% Sibling Discount
                              </Badge>
                              <p className="text-sm text-green-800 dark:text-green-200">
                                First enrollment for this child — {fmt(price * discountPercent / 100)} off applied automatically.
                              </p>
                            </div>
                          )}

                          {/* Promo Code */}
                          {isAuthenticated && (
                            <div className="space-y-2">
                              <Label htmlFor="promo-code">Promo Code (Optional)</Label>
                              <div className="flex gap-2">
                                <Input
                                  id="promo-code"
                                  placeholder="e.g. REF-ABC123 or EDK-XXXXXX"
                                  value={promoCode}
                                  onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoValidation(null); }}
                                  className="uppercase"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={handleValidatePromo}
                                  disabled={!promoCode.trim() || validateCouponQuery.isFetching || isValidatingExternalPromo}
                                >
                                  {(validateCouponQuery.isFetching || isValidatingExternalPromo) ? "..." : "Apply"}
                                </Button>
                              </div>
                              {promoValidation && (
                                promoValidation.valid ? (
                                  <p className="text-sm text-green-600 font-medium">
                                    ✓ {promoValidation.isExternalPromo
                                      ? `10% discount applied — you save ${fmt(promoDiscountDisplay)}!`
                                      : `${fmt(promoDiscountDisplay)} discount applied!`}
                                  </p>
                                ) : (
                                  <p className="text-sm text-destructive">{promoValidation.reason}</p>
                                )
                              )}
                            </div>
                          )}

                          {/* Price summary — always shown so user sees original vs discounted */}
                          <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 text-sm space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Original price</span>
                              <span className={totalPctDiscount > 0 || promoDiscountDisplay > 0 ? "line-through text-muted-foreground" : "font-semibold"}>
                                {fmt(price)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-blue-700 dark:text-blue-400">
                              <span>Loyalty discount ({LOYALTY_DISCOUNT_PCT}% off) when you pay in full</span>
                              <span>−{fmt(price * LOYALTY_DISCOUNT_PCT / 100)}</span>
                            </div>
                            {siblingDiscount && (
                              <div className="flex items-center justify-between text-purple-700 dark:text-purple-400">
                                <span>Sibling discount ({discountPercent}% off)</span>
                                <span>−{fmt(price * discountPercent / 100)}</span>
                              </div>
                            )}
                            {promoDiscountDisplay > 0 && (
                              <div className="flex items-center justify-between text-green-700 dark:text-green-400">
                                <span>Promo code</span>
                                <span>−{fmt(promoDiscountDisplay)}</span>
                              </div>
                            )}
                            <div className="border-t border-primary/20 pt-1.5 flex items-center justify-between font-bold">
                              <span>You pay</span>
                              <span className="text-primary text-base">{fmt(effectiveTotal)}</span>
                            </div>
                            <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                              You save {fmt(price - effectiveTotal)} on this course!
                            </p>
                          </div>

                          <div className="space-y-3">
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
                                {createCheckoutMutation.isPending ? "Processing..." : (
                                  `Pay in Full — ${fmt(effectiveTotal)}${totalPctDiscount > 0 ? ` (${totalPctDiscount}% off)` : ""}`
                                )}
                              </Button>
                            </div>

                            {/* Test Prep: 3-installment option */}
                            {isTestPrep && (
                              <Button
                                variant="secondary"
                                className="w-full"
                                onClick={handleEnrollInstallments}
                                disabled={enrollWithInstallmentsMutation.isPending || !studentFirstName || !studentLastName}
                              >
                                {enrollWithInstallmentsMutation.isPending
                                  ? "Enrolling..."
                                  : `Pay in 3 Installments — ${fmt(installmentAmount)}/month × 3`}
                              </Button>
                            )}

                            {/* Tutor / Homework: usage-based monthly */}
                            {isUsageBased && (
                              <Button
                                variant="secondary"
                                className="w-full"
                                onClick={handlePayLater}
                                disabled={enrollWithoutPaymentMutation.isPending || !studentFirstName || !studentLastName}
                              >
                                {enrollWithoutPaymentMutation.isPending
                                  ? "Enrolling..."
                                  : perSessionRate !== null
                                    ? `Enroll & Pay Monthly — ${fmt(perSessionRate)}/session`
                                    : "Enroll & Pay Monthly"}
                              </Button>
                            )}

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
                          Only parent accounts can enroll in courses.
                        </p>
                        <Button asChild variant="outline" className="w-full">
                          <a href={LOGIN_PATH}>Switch to Parent Account</a>
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

              {/* Assigned Tutors / Request a Tutor Section */}
              {course.tutors && course.tutors.length === 0 && isAuthenticated && user?.role === "parent" && (
                <Card>
                  <CardHeader>
                    <CardTitle>Assigned Tutors</CardTitle>
                    <CardDescription>
                      No tutor has been assigned to this course yet
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      {alreadyRequestedTutor
                        ? "Your tutor request has been received. Our team will be in touch shortly."
                        : "A tutor hasn't been assigned to this course yet. Request one and our team will get back to you shortly."}
                    </p>
                    {alreadyRequestedTutor ? (
                      <Button className="w-full" disabled>Request Sent</Button>
                    ) : (
                      <Dialog open={isTutorRequestOpen} onOpenChange={setIsTutorRequestOpen}>
                        <DialogTrigger asChild>
                          <Button className="w-full">Request a Tutor</Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[480px]">
                          <DialogHeader>
                            <DialogTitle>Request a Tutor</DialogTitle>
                            <DialogDescription>
                              Submit a request and our team will assign a tutor to this course for you.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="tutor-request-message">Additional Message (Optional)</Label>
                              <textarea
                                id="tutor-request-message"
                                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                placeholder="Any specific requirements or preferences for the tutor..."
                                value={tutorRequestMessage}
                                onChange={(e) => setTutorRequestMessage(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsTutorRequestOpen(false)}>
                              Cancel
                            </Button>
                            <Button
                              disabled={requestTutorMutation.isPending}
                              onClick={async () => {
                                try {
                                  await requestTutorMutation.mutateAsync({
                                    courseId,
                                    message: tutorRequestMessage || undefined,
                                  });
                                  toast.success("Tutor request sent! Our team will be in touch shortly.");
                                  setIsTutorRequestOpen(false);
                                  setTutorRequestMessage("");
                                  refetchTutorRequestStatus();
                                } catch {
                                  toast.error("Failed to send request. Please try again.");
                                }
                              }}
                            >
                              {requestTutorMutation.isPending ? "Sending..." : "Send Request"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              )}
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
                                {tutorAssignment.profile?.bio && (() => {
                                  const bio = tutorAssignment.profile!.bio!;
                                  const isExpanded = expandedBios.has(tutorAssignment.tutorId);
                                  const isLong = bio.length > 160;
                                  return (
                                    <div>
                                      <p className={`text-sm text-muted-foreground leading-relaxed break-words ${!isExpanded && isLong ? "line-clamp-2" : ""}`}>
                                        {bio}
                                      </p>
                                      {isLong && (
                                        <button
                                          onClick={() => setExpandedBios(prev => {
                                            const next = new Set(prev);
                                            if (next.has(tutorAssignment.tutorId)) next.delete(tutorAssignment.tutorId);
                                            else next.add(tutorAssignment.tutorId);
                                            return next;
                                          })}
                                          className="text-xs text-primary font-medium mt-0.5 hover:underline"
                                        >
                                          {isExpanded ? "Show less" : "Show more"}
                                        </button>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div className="flex flex-col xs:flex-row gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full xs:w-auto whitespace-nowrap"
                                  onClick={() => {
                                    setSelectedTutorForAvailability({
                                      id: tutorAssignment.tutorId,
                                      name: tutorAssignment.user.name || "Tutor",
                                      timezone: (tutorAssignment.user as any).timezone || null,
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
              Book a 60-minute trial lesson for just {formatPrice(1)}!
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
                  Book a 60-minute trial session only {formatPrice(1)}!
                </p>
              </div>
            )}

            {existingStudents.length > 0 && (
              <div className="space-y-2">
                <Label>Select Existing Student (Optional)</Label>
                <Select onValueChange={handleSelectExistingStudentForTrial}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a student or enter new" />
                  </SelectTrigger>
                  <SelectContent>
                    {existingStudents.map((student) => (
                      <SelectItem key={student.fullName} value={student.fullName}>
                        {student.fullName}{student.grade ? ` (${student.grade})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  trialPriceLabel={formatPrice(1)}
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
          tutorTimezone={selectedTutorForAvailability.timezone}
          viewerTimezone={viewerTimezone}
          onViewerTimezoneChange={setViewerTimezone}
          availability={tutorAvailability}
        />
      )}
      <Footer />
    </div>
  );
}
