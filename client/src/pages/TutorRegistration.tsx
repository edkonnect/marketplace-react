import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import {
  arrayMin,
  email as emailValidator,
  hourlyRateString,
  nonNegativeNumber,
  required,
  url as urlValidator,
} from "@/lib/validation";
import {
  FormCheckboxGroup,
  FormInput,
  FormTextarea,
} from "@/components/forms/FormInput";

const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "English",
  "History",
  "Computer Science",
  "Spanish",
  "French",
  "Art",
  "Music",
];

const GRADE_LEVELS = [
  "Elementary School",
  "Middle School",
  "High School",
  "College",
  "Adult Education",
];

export default function TutorRegistration() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [submitted, setSubmitted] = useState(false);

  const form = useValidatedForm(
    {
      name: "",
      email: "",
      phone: "",
      bio: "",
      qualifications: "",
      yearsOfExperience: "",
      hourlyRate: "",
      subjects: [] as string[],
      gradeLevels: [] as string[],
      // acuityLink: "",
    },
    {
      name: required("Full name is required"),
      email: [required("Email is required"), emailValidator()],
      bio: required("Please tell us about yourself"),
      qualifications: required("Qualifications are required"),
      yearsOfExperience: [
        required("Years of experience is required"),
        nonNegativeNumber("Please enter a valid years of experience"),
      ],
      hourlyRate: [
        required("Hourly rate range is required"),
        hourlyRateString("Please enter a valid hourly rate range"),
      ],
      subjects: arrayMin(1, "Select at least one subject"),
      gradeLevels: arrayMin(1, "Select at least one grade level"),
      // acuityLink: urlValidator("Enter a valid scheduling link"),
    }
  );

  const { values, register, setValue, validateForm } = form;

  // Pre-fill form with user data
  useEffect(() => {
    if (user) {
      setValue("name", user.name || "", { validate: false });
      setValue("email", user.email || "", { validate: false });
    }
  }, [user, setValue]);

  const registerMutation = trpc.tutorProfile.register.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Registration submitted successfully!");
    },
    onError: (error: any) => {
      if (error.message === "You already have a tutor profile") {
        setSubmitted(true);
      } else {
        toast.error(error.message || "Failed to submit registration");
      }
    },
  });

  const parseHourlyRate = (input: string) => {
    const numberMatches =
      input
        .trim()
        .match(/([0-9]+(?:\.[0-9]+)?)/g)
        ?.map(Number) || [];

    if (numberMatches.length >= 2) {
      const [low, high] = numberMatches.slice(0, 2);
      if (low > 0 && high > 0 && high >= low) {
        return (low + high) / 2;
      }
    } else if (numberMatches.length === 1) {
      return numberMatches[0] > 0 ? numberMatches[0] : null;
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid } = validateForm();
    if (!isValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const experience = parseInt(values.yearsOfExperience, 10);
    const numericRate = parseHourlyRate(values.hourlyRate);
    if (!numericRate || numericRate <= 0 || Number.isNaN(experience)) {
      toast.error("Please enter valid experience and hourly rate values.");
      return;
    }

    registerMutation.mutate({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone || undefined,
      bio: values.bio,
      qualifications: values.qualifications,
      yearsOfExperience: experience,
      hourlyRate: numericRate,
      subjects: values.subjects,
      gradeLevels: values.gradeLevels,
    });
  };

  const toggleSubject = (subject: string) => {
    setValue(
      "subjects",
      (prev) =>
        prev.includes(subject)
          ? prev.filter((s) => s !== subject)
          : [...prev, subject],
      { validate: true, touch: true }
    );
  };

  const toggleGradeLevel = (level: string) => {
    setValue(
      "gradeLevels",
      (prev) =>
        prev.includes(level)
          ? prev.filter((l) => l !== level)
          : [...prev, level],
      { validate: true, touch: true }
    );
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-sm">
            <div className="p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
              <p className="text-muted-foreground mb-6">
                {isAuthenticated
                  ? "Thank you for your interest in joining our tutoring platform. Your application is under review."
                  : "Thank you for applying! Once approved, you'll receive an email with instructions to set up your account and create your password."
                }
              </p>
              <div className="bg-muted p-4 rounded-lg space-y-2 text-sm text-left mb-6">
                <p className="font-medium">What happens next?</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Our team will review your application</li>
                  <li>You'll receive an email notification with the decision</li>
                  {isAuthenticated ? (
                    <li>If approved, you can start creating your profile and accepting students</li>
                  ) : (
                    <li>If approved, you'll receive a secure link to set up your password and access your account</li>
                  )}
                </ul>
              </div>
              <button
                onClick={() => navigate("/")}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md font-medium"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 bg-gradient-to-br from-primary/5 via-accent/5 to-background mt-20">
        <div className="container py-12">
          <div className="max-w-3xl mx-auto">
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-2">Become a Tutor</h1>
              <p className="text-lg text-muted-foreground">
                Join our community of expert educators and help students achieve their learning goals.
              </p>
            </div>

            <div className="bg-card border border-border rounded-lg shadow-sm">
              <div className="p-6 border-b border-border">
                <h2 className="text-xl font-semibold">Tutor Registration</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Fill out the form below to apply as a tutor. All fields marked with * are required.
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6">
                <div className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Personal Information</h3>

                    <FormInput
                      field={register("name")}
                      label="Full Name"
                      required
                      placeholder="John Doe"
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormInput
                        field={register("email")}
                        label="Email Address"
                        required
                        type="email"
                        placeholder="john@example.com"
                      />

                      <FormInput
                        field={register("phone")}
                        label="Phone Number"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  {/* Professional Information */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Professional Information</h3>

                    <FormTextarea
                      field={register("bio")}
                      label="About You"
                      required
                      placeholder="Tell us about your teaching philosophy, experience, and what makes you a great tutor..."
                      rows={4}
                    />

                    <FormTextarea
                      field={register("qualifications")}
                      label="Qualifications & Education"
                      required
                      placeholder="List your degrees, certifications, and relevant qualifications..."
                      rows={3}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormInput
                        field={register("yearsOfExperience")}
                        label="Years of Experience"
                        required
                        type="number"
                        min="0"
                        placeholder="5"
                      />

                      <FormInput
                        field={register("hourlyRate")}
                        label="Hourly Rate Range (USD)"
                        required
                        type="text"
                        inputMode="decimal"
                        placeholder="50-80"
                        helperText="Enter a single rate or a range (e.g., 50-80)"
                      />
                    </div>
                  </div>

                  {/* Subjects */}
                  <FormCheckboxGroup
                    field={register("subjects")}
                    label="Subjects You Teach"
                    required
                    items={SUBJECTS.map((subject) => ({ value: subject, label: subject }))}
                    selected={values.subjects}
                    onToggle={toggleSubject}
                    columns={3}
                  />

                  {/* Grade Levels */}
                  <FormCheckboxGroup
                    field={register("gradeLevels")}
                    label="Grade Levels"
                    required
                    items={GRADE_LEVELS.map((level) => ({ value: level, label: level }))}
                    selected={values.gradeLevels}
                    onToggle={toggleGradeLevel}
                    columns={2}
                  />

                  <div className="flex gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={registerMutation.isPending}
                      className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-md font-medium flex items-center justify-center"
                    >
                      {registerMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Submit Application
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="px-4 py-2 border border-input rounded-md hover:bg-accent"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
