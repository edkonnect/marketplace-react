import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  FormInput,
  FormTextarea,
} from "@/components/forms/FormInput";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import {
  email as emailValidator,
  required,
} from "@/lib/validation";
import { detectUserTimezone } from "@/../../shared/timezone-utils";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import { PhoneInput } from "@/components/PhoneInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { fireConversion } from "@/lib/gtag";

export default function SignUp() {
  const [, setLocation] = useLocation();
  const { signup } = useAuth();
  const form = useValidatedForm(
    {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      educationalNeeds: "",
      role: "parent" as "parent" | "tutor" | "admin",
      interestType: "" as "" | "sat_test_prep" | "k12_math" | "k12_english" | "advanced_placement" | "coding" | "computer_science" | "other",
      targetScoreRange: "",
      plannedTestMonth: "",
      courseType: "" as "" | "regular" | "accelerated",
    },
    {
      firstName: required("First name is required"),
      lastName: required("Last name is required"),
      email: [required("Email is required"), emailValidator()],
      password: required("Password is required"),
    }
  );
  const { values, register, validateForm, setValue } = form;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timezone, setTimezone] = useState(detectUserTimezone());
  const [phone, setPhone] = useState("");
  const [refCode, setRefCode] = useState<string | null>(null);

  // Read ?ref= from URL and store in state (also persist in localStorage as fallback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref) {
      setRefCode(ref.trim().toUpperCase());
      localStorage.setItem("edkonnect_ref", ref.trim().toUpperCase());
    } else {
      const stored = localStorage.getItem("edkonnect_ref");
      if (stored) setRefCode(stored);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid } = validateForm();
    if (!isValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    setIsSubmitting(true);

    try {
      await signup({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        role: values.role,
        timezone: timezone,
        ...(refCode ? { refCode } : {}),
        ...(values.interestType ? { interestType: values.interestType } : {}),
        ...(values.targetScoreRange ? { targetScoreRange: values.targetScoreRange } : {}),
        ...(values.plannedTestMonth ? { plannedTestMonth: values.plannedTestMonth } : {}),
        ...(values.courseType ? { courseType: values.courseType } : {}),
      });
      // Clear stored referral code after successful signup
      localStorage.removeItem("edkonnect_ref");
      await fireConversion('Y_2FCLq02KocELW4_r5D');
      toast.success("Account created! Check your email for the verification link.");
      setLocation("/login");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      toast.error(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="py-20 flex-1">
        <div className="container max-w-2xl">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-6">
            <span>←</span> Back to Home
          </Link>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl lg:text-4xl font-bold mb-4">Join EdKonnect Academy</h1>
            <p className="text-lg text-muted-foreground">
              Start your personalized learning journey today
            </p>
          </div>

          {refCode && (
            <div className="mb-4 flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
              <span className="text-2xl">🎁</span>
              <div>
                <p className="font-semibold text-sm">You were invited!</p>
                <p className="text-sm text-muted-foreground">Enroll in your first course after signing up to unlock a <strong>discount coupon</strong> (up to $25 off).</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Sign Up</CardTitle>
              <CardDescription>
                Create your account to connect with expert tutors
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6" autoComplete="off">
                <div className="grid md:grid-cols-2 gap-4">
                  <FormInput
                    field={register("firstName")}
                    label="First Name"
                    required
                    placeholder="John"
                  />
                  <FormInput
                    field={register("lastName")}
                    label="Last Name"
                    required
                    placeholder="Doe"
                  />
                </div>

                <FormInput
                  field={register("email")}
                  label="Email Address"
                  required
                  type="email"
                  placeholder="john.doe@example.com"
                  autoComplete="new-email"
                />

                <FormInput
                  field={register("password")}
                  label="Password"
                  required
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />

                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  onTimezoneDetected={setTimezone}
                  currentTimezone={timezone}
                />

                <FormTextarea
                  field={register("educationalNeeds")}
                  label="Educational Needs"
                  placeholder="Tell us about your learning goals, subjects you need help with, or any specific requirements..."
                  rows={4}
                  helperText="Help us match you with the perfect tutor by sharing your educational goals."
                />

                <div>
                  <Label className="text-sm font-medium mb-2 block">What are you interested in?</Label>
                  <Select value={values.interestType} onValueChange={v => setValue("interestType", v as any)}>
                    <SelectTrigger><SelectValue placeholder="Select an option (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sat_test_prep">SAT / ACT Prep</SelectItem>
                      <SelectItem value="k12_math">K-12 Math</SelectItem>
                      <SelectItem value="k12_english">K-12 English</SelectItem>
                      <SelectItem value="advanced_placement">Advanced Placement (AP)</SelectItem>
                      <SelectItem value="coding">Coding</SelectItem>
                      <SelectItem value="computer_science">Computer Science</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {values.interestType === "sat_test_prep" && (
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Target Score Range</Label>
                      <Select value={values.targetScoreRange} onValueChange={v => setValue("targetScoreRange", v)}>
                        <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1000-1100">1000-1100</SelectItem>
                          <SelectItem value="1100-1200">1100-1200</SelectItem>
                          <SelectItem value="1200-1300">1200-1300</SelectItem>
                          <SelectItem value="1300-1400">1300-1400</SelectItem>
                          <SelectItem value="1400-1500">1400-1500</SelectItem>
                          <SelectItem value="1500-1600">1500-1600</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Planned Test Month</Label>
                      <Select value={values.plannedTestMonth} onValueChange={v => setValue("plannedTestMonth", v)}>
                        <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="march">March</SelectItem>
                          <SelectItem value="may">May</SelectItem>
                          <SelectItem value="june">June</SelectItem>
                          <SelectItem value="august">August</SelectItem>
                          <SelectItem value="october">October</SelectItem>
                          <SelectItem value="november">November</SelectItem>
                          <SelectItem value="december">December</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Course Type</Label>
                      <Select value={values.courseType} onValueChange={v => setValue("courseType", v as any)}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular (30+30 hrs)</SelectItem>
                          <SelectItem value="accelerated">Accelerated (20+20 hrs)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <TimezoneSelector
                  value={timezone}
                  onChange={setTimezone}
                  label="Your Time Zone"
                  showDetected={true}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating Account..." : "Sign Up"}
                </Button>

                <p className="text-sm text-center text-muted-foreground">
                  By signing up, you agree to our{" "}
                  <Link href="/privacy-policy" className="text-primary hover:underline">
                    Terms &amp; Conditions
                  </Link>
                  . Already have an account?{" "}
                  <Link href="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
}
