import { useState, useEffect, useRef } from "react";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2, Camera, X } from "lucide-react";
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
import { detectUserTimezone } from "@/../../shared/timezone-utils";
import { TimezoneSelector } from "@/components/TimezoneSelector";
import { PhoneInput } from "@/components/PhoneInput";
import { ImageCropModal } from "@/components/ImageCropModal";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB

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
  // For unauthenticated users, persist submitted state across page reloads in the same session
  // For logged-in users, the backend controls this — don't use sessionStorage
  const [submitted, setSubmitted] = useState(() => !isAuthenticated && sessionStorage.getItem("tutorAppSubmitted") === "true");
  const [submittedEmail, setSubmittedEmail] = useState<string>(() => sessionStorage.getItem("tutorAppSubmittedEmail") || "");
  const [timezone, setTimezone] = useState(detectUserTimezone());

  // Profile image state
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const [profileImageFile, setProfileImageFile] = useState<{ base64: string; name: string; type: string; size: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  // Crop modal state
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState<string>("photo.jpg");

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
  const [phone, setPhone] = useState("");

  // Pre-fill form with user data — only once when user first loads
  const hasPrefilledRef = useRef(false);
  useEffect(() => {
    if (user && !hasPrefilledRef.current) {
      hasPrefilledRef.current = true;
      setValue("name", user.name || "", { validate: false });
      setValue("email", user.email || "", { validate: false });
    }
  }, [user]);

  const markSubmitted = (email: string) => {
    if (!isAuthenticated) {
      sessionStorage.setItem("tutorAppSubmitted", "true");
      sessionStorage.setItem("tutorAppSubmittedEmail", email);
    }
    setSubmittedEmail(email);
    setSubmitted(true);
  };

  const registerMutation = trpc.tutorProfile.register.useMutation({
    onSuccess: () => {
      markSubmitted(values.email.trim());
      toast.success("Registration submitted successfully!");
    },
    onError: (error: any) => {
      if (error.message === "You already have a tutor profile") {
        markSubmitted(user?.email || values.email.trim());
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
      phone: phone || undefined,
      bio: values.bio,
      qualifications: values.qualifications,
      yearsOfExperience: experience,
      hourlyRate: numericRate,
      subjects: values.subjects,
      gradeLevels: values.gradeLevels,
      timezone: timezone,
      profileImage: profileImageFile ? {
        base64Data: profileImageFile.base64,
        fileName: profileImageFile.name,
        fileType: profileImageFile.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
        fileSize: profileImageFile.size,
      } : undefined,
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, WebP, or GIF image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Image must be 5 MB or smaller.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setCropFileName(file.name);
      setCropSrc(dataUrl); // open cropper
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropConfirm = (croppedDataUrl: string, croppedBlob: Blob) => {
    const base64 = croppedDataUrl.split(",")[1];
    setProfileImagePreview(croppedDataUrl);
    setProfileImageFile({
      base64,
      name: cropFileName.replace(/\.[^.]+$/, "") + ".jpg",
      type: "image/jpeg",
      size: croppedBlob.size,
    });
    setCropSrc(null);
  };

  const handleCropCancel = () => {
    setCropSrc(null);
  };

  const handleRemoveImage = () => {
    setProfileImagePreview(null);
    setProfileImageFile(null);
  };

  if (submitted) {
    return (
      <>
        {cropSrc && (
          <ImageCropModal
            imageSrc={cropSrc}
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        )}
        <div className="min-h-screen flex flex-col bg-background">
          <Navigation />
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-card border border-border rounded-lg shadow-sm">
              <div className="p-6 text-center">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Application Submitted!</h2>
                {submittedEmail && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 mb-4 text-sm text-blue-800 font-medium">
                    Application submitted for: <span className="font-bold">{submittedEmail}</span>
                  </div>
                )}
                <p className="text-muted-foreground mb-6">
                  {isAuthenticated
                    ? "Thank you for your interest in joining our tutoring platform. Your application is under review."
                    : "Thank you for applying! A confirmation email has been sent to the address above. Once approved, you'll receive instructions to set up your account."
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
      </>
    );
  }

  return (
    <>
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
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

                    {/* Profile Photo */}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium">
                        Profile Photo <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-muted border-2 border-border flex-shrink-0">
                          {profileImagePreview ? (
                            <img
                              src={profileImagePreview}
                              alt="Profile preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <Camera className="w-7 h-7" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => imageInputRef.current?.click()}
                            className="px-3 py-1.5 text-sm border border-input rounded-md hover:bg-accent transition-colors"
                          >
                            {profileImagePreview ? "Change Photo" : "Upload Photo"}
                          </button>
                          {profileImagePreview && (
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="px-3 py-1.5 text-sm text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF · Max 5 MB</p>
                        </div>
                      </div>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageChange}
                        aria-label="Upload profile photo"
                      />
                    </div>

                    <FormInput
                      field={register("name")}
                      label="Full Name"
                      required
                      placeholder="John Doe"
                      readOnly={isAuthenticated}
                      className={isAuthenticated ? "opacity-60 cursor-not-allowed" : ""}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormInput
                        field={register("email")}
                        label="Email Address"
                        required
                        type="email"
                        placeholder="john@example.com"
                        readOnly={isAuthenticated}
                        className={isAuthenticated ? "opacity-60 cursor-not-allowed" : ""}
                      />

                      <PhoneInput
                        value={phone}
                        onChange={setPhone}
                        onTimezoneDetected={setTimezone}
                        currentTimezone={timezone}
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

                  {/* Timezone */}
                  <TimezoneSelector
                    value={timezone}
                    onChange={setTimezone}
                    label="Your Time Zone"
                    showDetected={true}
                  />

                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                    <button
                      type="submit"
                      disabled={registerMutation.isPending}
                      className="w-full sm:flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 sm:py-2 rounded-md font-medium flex items-center justify-center text-sm sm:text-base"
                    >
                      {registerMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Submit Application
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="w-full sm:w-auto px-4 py-2.5 sm:py-2 border border-input rounded-md hover:bg-accent text-sm sm:text-base"
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
    </>
  );
}
