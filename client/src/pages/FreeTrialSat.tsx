import { useMemo, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInput } from "@/components/PhoneInput";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { detectUserTimezone } from "@/../../shared/timezone-utils";

const GRADES = ["6", "7", "8", "9", "10", "11", "12"];

const selectClass =
  "w-full px-3 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent";

interface StudentRow {
  name: string;
  grade: string; // one of GRADES or "Other"
  otherGrade: string;
}

const emptyStudent = (): StudentRow => ({ name: "", grade: "", otherGrade: "" });

// Max 4 time zones per country
const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "United States - Eastern (New York)" },
  { value: "America/Chicago", label: "United States - Central (Chicago)" },
  { value: "America/Denver", label: "United States - Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "United States - Pacific (Los Angeles)" },
  { value: "Asia/Kolkata", label: "India (Kolkata)" },
];

// If the visitor's detected zone isn't in the list, show it at the top
function getTimezoneOptions(detected: string) {
  if (detected && !TIMEZONE_OPTIONS.some((t) => t.value === detected)) {
    return [{ value: detected, label: detected.replace(/_/g, " ") }, ...TIMEZONE_OPTIONS];
  }
  return TIMEZONE_OPTIONS;
}

// Fixed trial dates (YYYY-MM-DD). Past dates are hidden automatically.
const TRIAL_DATES = ["2026-10-17", "2026-11-14", "2026-12-12"];

function getTrialDates() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return TRIAL_DATES.map((value) => {
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const label = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return { value, label, date };
  })
    .filter((x) => x.date >= today)
    .map(({ value, label }) => ({ value, label }));
}

export default function FreeTrialSat() {
  const detected = useMemo(() => detectUserTimezone(), []);
  const timezones = useMemo(() => getTimezoneOptions(detected), [detected]);
  const trialDates = useMemo(() => getTrialDates(), []);

  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([emptyStudent()]);
  const [timezone, setTimezone] = useState(detected);
  const [trialDate, setTrialDate] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const updateStudent = (i: number, patch: Partial<StudentRow>) =>
    setStudents((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parentName.trim()) return toast.error("Parent name is required.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast.error("Enter a valid email.");

    const cleanStudents = [];
    for (const s of students) {
      const grade = s.grade === "Other" ? s.otherGrade.trim() : s.grade;
      if (!s.name.trim() || !grade) {
        return toast.error("Enter name and grade for each student.");
      }
      cleanStudents.push({ name: s.name.trim(), grade });
    }

    if (!timezone) return toast.error("Select a time zone.");
    if (!trialDate) return toast.error("Select a course start date.");

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: parentName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          students: cleanStudents,
          timezone,
          trialDate,
          website,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Something went wrong. Please try again.");
        return;
      }
      setDone(true);
      window.scrollTo(0, 0);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <div className="flex-1 container py-16 max-w-2xl mt-20">
        {done ? (
          <Card>
            <CardContent className="py-12 text-center space-y-4">
              <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
              <h1 className="text-2xl font-bold">Thank you!</h1>
              <p className="text-muted-foreground">
                We received your free trial SAT request. Our team will contact you at{" "}
                <span className="font-medium text-foreground">{email}</span> to confirm your lesson.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Free Trial SAT Lesson</CardTitle>
              <CardDescription>
                Fill in the details below and pick a date.
              </CardDescription>
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-primary">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold">
                  No account or sign-up needed. Just fill in this form.
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Honeypot: hidden from real users */}
                <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                  <label>
                    Website
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="parentName">Parent name *</Label>
                  <Input
                    id="parentName"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Parent email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <PhoneInput value={phone} onChange={setPhone} label="Phone (optional)" />

                <div className="space-y-4">
                  <Label>Student(s) *</Label>
                  {students.map((s, i) => (
                    <div key={i} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Student {i + 1}</span>
                        {students.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setStudents((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <Input
                        placeholder="Student name"
                        value={s.name}
                        onChange={(e) => updateStudent(i, { name: e.target.value })}
                        maxLength={100}
                      />
                      <select
                        className={selectClass}
                        value={s.grade}
                        onChange={(e) => updateStudent(i, { grade: e.target.value })}
                      >
                        <option value="">Select grade</option>
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            Grade {g}
                          </option>
                        ))}
                        <option value="Other">Other</option>
                      </select>
                      {s.grade === "Other" && (
                        <Input
                          placeholder="Enter grade"
                          value={s.otherGrade}
                          onChange={(e) => updateStudent(i, { otherGrade: e.target.value })}
                          maxLength={50}
                        />
                      )}
                    </div>
                  ))}
                  {students.length < 10 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStudents((prev) => [...prev, emptyStudent()])}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Add another student
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Time zone *</Label>
                  <select
                    id="timezone"
                    className={selectClass}
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trialDate">Course Start Date *</Label>
                  <select
                    id="trialDate"
                    className={selectClass}
                    value={trialDate}
                    onChange={(e) => setTrialDate(e.target.value)}
                  >
                    <option value="">Select a date</option>
                    {trialDates.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Request Free Trial"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <Footer />
    </div>
  );
}