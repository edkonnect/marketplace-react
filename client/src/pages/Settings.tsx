import { useState, useEffect } from "react";
import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { LOGIN_PATH } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, Lock, BookOpen, Users, GraduationCap, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Settings() {
  const { user, isAuthenticated, loading, refreshProfile } = useAuth();

  // Basic info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Tutor profile
  const [bio, setBio] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<number | "">("");
  const [subjects, setSubjects] = useState("");


  // --- Data fetching ---

  const { data: meData } = trpc.auth.me.useQuery(undefined, { enabled: isAuthenticated });

  const { data: tutorProfile } = trpc.tutorProfile.getMy.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "tutor",
  });

const { data: subscriptions } = trpc.subscription.mySubscriptions.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "parent",
  });

  useEffect(() => {
    if (meData) {
      setFirstName((meData as any).firstName || "");
      setLastName((meData as any).lastName || "");
      setEmail((meData as any).email || "");
    }
  }, [meData]);

  useEffect(() => {
    if (tutorProfile) {
      setBio(tutorProfile.bio || "");
      setQualifications(tutorProfile.qualifications || "");
      setHourlyRate(tutorProfile.hourlyRate || "");
      setYearsOfExperience(tutorProfile.yearsOfExperience ?? "");
      try {
        const parsed = JSON.parse(tutorProfile.subjects || "[]");
        setSubjects(Array.isArray(parsed) ? parsed.join(", ") : (tutorProfile.subjects || ""));
      } catch {
        setSubjects(tutorProfile.subjects || "");
      }
    }
  }, [tutorProfile]);

  // --- Mutations ---

  const updateProfileMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: () => { toast.success("Profile updated successfully"); refreshProfile(); },
    onError: (err: any) => toast.error(err.message || "Failed to update profile"),
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    },
    onError: (err: any) => toast.error(err.message || "Failed to change password"),
  });

  const updateTutorProfileMutation = trpc.tutorProfile.update.useMutation({
    onSuccess: () => toast.success("Tutor profile updated successfully"),
    onError: (err: any) => toast.error(err.message || "Failed to update tutor profile"),
  });


  if (!loading && !isAuthenticated) {
    window.location.href = LOGIN_PATH;
    return null;
  }

  // --- Handlers ---

  const handleProfileSave = () => {
    const updates: { firstName?: string; lastName?: string } = {};
    if (firstName.trim()) updates.firstName = firstName.trim();
    if (lastName.trim()) updates.lastName = lastName.trim();
    updateProfileMutation.mutate(updates);
  };

  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) { toast.error("New passwords do not match"); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const handleTutorProfileSave = () => {
    const subjectsArray = subjects.split(",").map(s => s.trim()).filter(Boolean);
    updateTutorProfileMutation.mutate({
      bio: bio || undefined,
      qualifications: qualifications || undefined,
      hourlyRate: hourlyRate || undefined,
      yearsOfExperience: yearsOfExperience !== "" ? Number(yearsOfExperience) : undefined,
      subjects: JSON.stringify(subjectsArray),
    });
  };

// Build enrolled students grouped by student
  const enrolledStudents = (() => {
    if (!subscriptions) return null;
    const studentMap = new Map<string, { firstName: string; lastName: string; grade: string | null; courses: { title: string; status: string }[] }>();
    subscriptions
      .filter((s: any) => s.subscription?.studentFirstName || s.subscription?.studentLastName)
      .forEach((s: any) => {
        const key = `${s.subscription.studentFirstName}-${s.subscription.studentLastName}`;
        if (!studentMap.has(key)) {
          studentMap.set(key, {
            firstName: s.subscription.studentFirstName || "",
            lastName: s.subscription.studentLastName || "",
            grade: s.subscription.studentGrade || null,
            courses: [],
          });
        }
        if (s.course?.title) {
          studentMap.get(key)!.courses.push({ title: s.course.title, status: s.subscription.status });
        }
      });
    return Array.from(studentMap.values());
  })();

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <div className="container max-w-3xl pt-24 pb-12 px-4">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your personal information, security, and profile
          </p>
        </div>

        {/* Personal Information */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Personal Information</h2>
          </div>
          <div className="bg-background rounded-xl border shadow-sm p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">First Name</Label>
                <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address</Label>
              <Input id="email" type="email" value={email} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
              <p className="text-xs text-muted-foreground">Email cannot be changed. Contact support if needed.</p>
            </div>
            <div className="flex justify-end pt-1">
              <Button onClick={handleProfileSave} disabled={updateProfileMutation.isPending} size="sm">
                {updateProfileMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Security</h2>
          </div>
          <div className="bg-background rounded-xl border shadow-sm p-6 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Password</Label>
              <Input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Password</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="At least 8 characters" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" />
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <Button
                onClick={handlePasswordChange}
                disabled={changePasswordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
                size="sm"
                variant="outline"
              >
                {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </div>
        </section>

        {/* Tutor Profile */}
        {user?.role === "tutor" && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tutor Profile</h2>
            </div>
            <div className="bg-background rounded-xl border shadow-sm p-6 space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="bio" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bio</Label>
                <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell students about yourself..." rows={4} />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label htmlFor="qualifications" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Qualifications</Label>
                <Textarea id="qualifications" value={qualifications} onChange={e => setQualifications(e.target.value)} placeholder="Your degrees, certifications, experience..." rows={3} />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hourlyRate" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hourly Rate ($)</Label>
                  <Input id="hourlyRate" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="e.g. 50.00" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="yearsOfExperience" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Years of Experience</Label>
                  <Input id="yearsOfExperience" type="number" min={0} value={yearsOfExperience} onChange={e => setYearsOfExperience(e.target.value ? Number(e.target.value) : "")} placeholder="e.g. 5" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subjects" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subjects</Label>
                <Input id="subjects" value={subjects} onChange={e => setSubjects(e.target.value)} placeholder="e.g. Math, Science, English (comma-separated)" />
              </div>
              <div className="flex justify-end pt-1">
                <Button onClick={handleTutorProfileSave} disabled={updateTutorProfileMutation.isPending} size="sm">
                  {updateTutorProfileMutation.isPending ? "Saving..." : "Save Profile"}
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Enrolled Students */}
        {user?.role === "parent" && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Enrolled Students</h2>
            </div>
            <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
              {!enrolledStudents ? (
                <div className="p-6 text-sm text-muted-foreground">Loading...</div>
              ) : enrolledStudents.length === 0 ? (
                <div className="p-10 text-center">
                  <Users className="w-9 h-9 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No students enrolled yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Enroll a student in a course to see them here.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {enrolledStudents.map((student, i) => (
                    <div key={i} className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                          {(student.firstName?.[0] || "?").toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{student.firstName} {student.lastName}</p>
                          {student.grade && <p className="text-xs text-muted-foreground">Grade {student.grade}</p>}
                        </div>
                      </div>
                      {student.courses.length > 0 && (
                        <div className="ml-12 space-y-1.5">
                          {student.courses.map((course, j) => (
                            <div key={j} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                              <div className="flex items-center gap-2">
                                <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                <p className="text-xs text-foreground">{course.title}</p>
                              </div>
                              <Badge variant={course.status === "active" ? "default" : "secondary"} className="capitalize text-xs h-5">
                                {course.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}


      </div>
    </div>
  );
}
