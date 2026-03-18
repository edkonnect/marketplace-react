import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import Navigation from "@/components/Navigation";
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
      });
      // Clear stored referral code after successful signup
      localStorage.removeItem("edkonnect_ref");
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
                <p className="text-sm text-muted-foreground">Enroll in your first course after signing up to unlock a <strong>25% discount coupon</strong>.</p>
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
                  <a href="#" className="text-primary hover:underline">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-primary hover:underline">
                    Privacy Policy
                  </a>
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

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <GraduationCap className="w-5 h-5" />
              <span className="text-sm">© 2025 EdKonnect Academy. All rights reserved.</span>
            </div>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-colors">About</a>
              <a href="#" className="hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="hover:text-primary transition-colors">Terms</a>
              <a href="#" className="hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
