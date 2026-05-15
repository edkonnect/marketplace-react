import { useAuth } from "@/_core/hooks/useAuth";
import { AdminSessionNotes } from "@/components/AdminSessionNotes";
import { LOGIN_PATH } from "@/const";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, BookOpen, TrendingUp, UserCheck, GraduationCap, Download, X, BarChart3, Trash2, FolderOpen, FileText, Upload, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { convertToCSV, formatUsersForCSV, formatEnrollmentsForCSV, formatPaymentsForCSV } from "../../../server/csv-export";
import { UserGrowthChart } from "@/components/charts/UserGrowthChart";
import { EnrollmentPatternsChart } from "@/components/charts/EnrollmentPatternsChart";
import { RevenueTrendsChart } from "@/components/charts/RevenueTrendsChart";
import { UserDistributionChart } from "@/components/charts/UserDistributionChart";
import { PaymentStatusChart } from "@/components/charts/PaymentStatusChart";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import { TutorAvailabilityManager } from "@/components/TutorAvailabilityManager";
import { EmailSettings } from "@/components/EmailSettings";
import { RegisteredTutorsManager } from "@/components/RegisteredTutorsManager";
import { CoordinatorManager } from "@/components/CoordinatorManager";
import { Pagination } from "@/components/Pagination";
import { CourseCreationForm } from "@/components/CourseCreationForm";
import { CourseManagementTable } from "@/components/CourseManagementTable";
import { TutorAssignmentDialog } from "@/components/TutorAssignmentDialog";
import { TestimonialsManager } from "@/components/TestimonialsManager";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/FileUpload";
import DashboardLayout, { AdminSection } from "@/components/DashboardLayout";
import { SuperUserGate } from "@/components/SuperUserGate";
import { SuperUserSettings } from "@/components/SuperUserSettings";
import { useSuperUser } from "@/contexts/SuperUserContext";
import { NOT_SUPER_USER_ERR_MSG } from "@shared/const";

function RevenueBreakdownButton({ isUnlocked, onOpen, onLockAndOpen }: {
  isUnlocked: boolean;
  onOpen: () => void;
  onLockAndOpen: () => void;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3 w-full text-xs"
      onClick={isUnlocked ? onOpen : onLockAndOpen}
    >
      {isUnlocked ? "View Parent Breakdown" : "🔒 View Parent Breakdown"}
    </Button>
  );
}

function ReferralSettingsPanel() {
  const { data: tiers = [], refetch: refetchTiers } = trpc.referral.getReferralSettings.useQuery();
  const { data: allReferrals = [] } = trpc.referral.getAllReferrals.useQuery();
  const saveSettings = trpc.referral.saveReferralSettings.useMutation({ onSuccess: () => refetchTiers() });

  const [editTiers, setEditTiers] = useState<Array<{
    id?: number;
    maxPriceUsd: number | null;
    discountAmountUsd: number;
    discountAmountInr: number;
    label: string;
    sortOrder: number;
  }>>([]);

  useEffect(() => {
    if (tiers.length) setEditTiers(tiers);
  }, [tiers]);

  const handleSave = () => {
    saveSettings.mutate(editTiers);
    toast.success("Referral settings saved");
  };

  const updateTier = (idx: number, field: string, value: number | string | null) => {
    setEditTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Referral Discount Tiers</CardTitle>
          <CardDescription>Configure the fixed discount amounts awarded based on course price.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {editTiers.map((tier, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-3 items-end border rounded-lg p-3">
              <div className="col-span-3">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Label</label>
                <Input value={tier.label} onChange={e => updateTier(idx, "label", e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Max Price (USD)</label>
                <Input
                  type="number"
                  placeholder="∞"
                  value={tier.maxPriceUsd ?? ""}
                  onChange={e => updateTier(idx, "maxPriceUsd", e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <div className="col-span-3">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Discount (USD)</label>
                <Input type="number" value={tier.discountAmountUsd} onChange={e => updateTier(idx, "discountAmountUsd", Number(e.target.value))} />
              </div>
              <div className="col-span-3">
                <label className="text-xs font-medium text-muted-foreground block mb-1">Discount (INR ₹)</label>
                <Input type="number" value={tier.discountAmountInr} onChange={e => updateTier(idx, "discountAmountInr", Number(e.target.value))} />
              </div>
            </div>
          ))}
          <Button onClick={handleSave} disabled={saveSettings.isPending}>
            {saveSettings.isPending ? "Saving..." : "Save Tiers"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Referral History</CardTitle>
          <CardDescription>All referrals and their status.</CardDescription>
        </CardHeader>
        <CardContent>
          {allReferrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 text-xs font-medium text-muted-foreground py-2">
                <div className="col-span-3">Referrer</div>
                <div className="col-span-3">Referred</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-4">Date</div>
              </div>
              {allReferrals.map((r: any) => (
                <div key={r.id} className="grid grid-cols-12 items-center py-2 text-sm gap-2">
                  <div className="col-span-3">
                    <p className="font-medium truncate">{r.referrerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.referrerEmail}</p>
                  </div>
                  <div className="col-span-3">
                    <p className="font-medium truncate">{r.referredName || "—"}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.referredEmail || "—"}</p>
                  </div>
                  <div className="col-span-2">
                    <Badge variant={r.status === "rewarded" ? "default" : r.status === "signed_up" ? "secondary" : "outline"}>
                      {r.status}
                    </Badge>
                  </div>
                  <div className="col-span-4 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CourseFilesAdminPanel() {
  const { data: files = [], refetch: refetchFiles, isLoading: filesLoading } = trpc.fileManagement.getFiles.useQuery();
  const { data: tutors = [] } = trpc.fileManagement.getTutorsForAssignment.useQuery();
  const { data: coursesList = [] } = trpc.fileManagement.getCoursesList.useQuery();
  const uploadFileMutation = trpc.fileManagement.uploadFile.useMutation({
    onSuccess: () => { refetchFiles(); resetUpload(); toast.success("File uploaded successfully"); },
  });
  const getUploadUrlMutation = trpc.fileManagement.getUploadUrl.useMutation();
  const registerFileMutation = trpc.fileManagement.registerFile.useMutation({
    onSuccess: () => { refetchFiles(); resetUpload(); toast.success("File uploaded successfully"); },
  });
  const deleteFileMutation = trpc.fileManagement.deleteFile.useMutation({ onSuccess: () => { refetchFiles(); toast.success("File deleted"); } });
  const assignTutorsMutation = trpc.fileManagement.assignFileToTutors.useMutation({ onSuccess: () => { refetchFiles(); setAssignDialogFileId(null); toast.success("Tutors assigned"); } });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCourseId, setUploadCourseId] = useState<string>("");
  const [fileUploadKey, setFileUploadKey] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [assignDialogFileId, setAssignDialogFileId] = useState<number | null>(null);
  const [selectedTutorIds, setSelectedTutorIds] = useState<number[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [fileSearch, setFileSearch] = useState("");
  const [filterCourseId, setFilterCourseId] = useState<string>("all");

  const { data: existingAssignments = [] } = trpc.fileManagement.getFileAssignments.useQuery(
    { fileId: assignDialogFileId! },
    { enabled: assignDialogFileId !== null }
  );

  function resetUpload() {
    setSelectedFiles([]);
    setUploadTitle("");
    setUploadDescription("");
    setUploadCourseId("");
    setFileUploadKey(k => k + 1);
  }

  function openAssignDialog(fileId: number) {
    setAssignDialogFileId(fileId);
    setSelectedTutorIds([]);
  }

  if (assignDialogFileId !== null && existingAssignments.length > 0 && selectedTutorIds.length === 0) {
    const assignedIds = existingAssignments.map((a: any) => a.assignment.tutorId);
    if (assignedIds.length > 0) setSelectedTutorIds(assignedIds);
  }

  function toggleTutor(id: number) {
    setSelectedTutorIds(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  async function handleUpload() {
    if (!selectedFiles[0] || !uploadTitle.trim()) {
      toast.error("Please provide a title and select a file");
      return;
    }
    const file = selectedFiles[0];
    const mimeType = file.type || "application/octet-stream";
    setIsUploading(true);
    try {
      // Try presigned S3 upload first (production) — bypasses server body limit
      let presigned: { uploadUrl: string; key: string; fileUrl: string } | null = null;
      try {
        presigned = await getUploadUrlMutation.mutateAsync({
          fileName: file.name,
          fileType: mimeType,
        });
      } catch (err: any) {
        // Extension validation errors should be shown immediately
        toast.error(err?.message ?? "Failed to prepare upload");
        return;
      }

      if (presigned) {
        // Direct browser → S3 upload
        let s3Ok = false;
        try {
          const res = await fetch(presigned.uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": mimeType },
          });
          s3Ok = res.ok;
          if (!res.ok) throw new Error(`S3 upload failed (${res.status})`);
        } catch (err: any) {
          toast.error("Upload failed: Could not reach storage. Please try again.");
          return;
        }

        // S3 succeeded — now register in DB. If this fails, log the orphaned key.
        try {
          await registerFileMutation.mutateAsync({
            title: uploadTitle.trim(),
            description: uploadDescription.trim() || undefined,
            courseId: uploadCourseId ? parseInt(uploadCourseId) : undefined,
            fileName: file.name,
            fileType: mimeType,
            fileSize: file.size,
            fileKey: presigned.key,
            fileUrl: presigned.fileUrl,
          });
        } catch (err: any) {
          // File is in S3 but not in DB — log so admin can clean up manually
          console.error("[uploadFile] S3 upload succeeded but DB registration failed. Orphaned S3 key:", presigned.key, err);
          if (err?.data?.code === "CONFLICT") {
            toast.error(err.message, { duration: 6000 });
          } else {
            toast.error("File was uploaded but could not be saved. Please contact support.");
          }
          return;
        }
      } else {
        // Local dev fallback — base64 through server
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        try {
          await uploadFileMutation.mutateAsync({
            title: uploadTitle.trim(),
            description: uploadDescription.trim() || undefined,
            courseId: uploadCourseId ? parseInt(uploadCourseId) : undefined,
            fileName: file.name,
            fileType: mimeType,
            fileSize: file.size,
            base64Data,
          });
        } catch (err: any) {
          if (err?.data?.code === "CONFLICT") {
            toast.error(err.message, { duration: 6000 });
          } else {
            toast.error("Upload failed: " + (err?.message ?? "Unknown error"));
          }
          return;
        }
      }
    } finally {
      setIsUploading(false);
    }
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // Build subject lookup: courseId → subject
  const courseSubjectMap = new Map<number, string>(
    (coursesList as any[]).map((c: any) => [c.id, c.subject ?? "Other"])
  );

  // Collect distinct subjects that appear in the current course list, normalized
  const subjectOrder = ["Mathematics", "English", "Science", "Computer Science", "History", "Foreign Language", "Spanish", "Chemistry", "Physics", "Test Prep", "Other"];
  const availableSubjects = subjectOrder.filter(s =>
    (coursesList as any[]).some((c: any) => (c.subject ?? "Other") === s)
  );

  const filteredFiles = files.filter((row: any) => {
    const matchesSearch =
      !fileSearch.trim() ||
      row.file.title.toLowerCase().includes(fileSearch.toLowerCase()) ||
      row.file.fileName.toLowerCase().includes(fileSearch.toLowerCase()) ||
      (row.courseName ?? "").toLowerCase().includes(fileSearch.toLowerCase());
    const fileSubject = row.file.courseId != null ? (courseSubjectMap.get(row.file.courseId) ?? "Other") : null;
    const matchesCourse =
      filterCourseId === "all" ||
      (filterCourseId === "none" ? row.file.courseId == null : fileSubject === filterCourseId);
    return matchesSearch && matchesCourse;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" /> Upload Course File</CardTitle>
          <CardDescription>Upload PDF or Word documents and assign them to tutors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file-title">Title <span className="text-destructive">*</span></Label>
            <Input id="file-title" placeholder="e.g. Week 3 Worksheet" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-description">Description (optional)</Label>
            <Textarea id="file-description" placeholder="Brief description of the file..." value={uploadDescription} onChange={e => setUploadDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file-course">Course (optional)</Label>
            <select
              id="file-course"
              value={uploadCourseId}
              onChange={e => setUploadCourseId(e.target.value)}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="">— No course —</option>
              {coursesList.map((c: any) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>
          <FileUpload
            key={fileUploadKey}
            onFilesSelected={setSelectedFiles}
            maxFiles={1}
            maxSizeMB={20}
            acceptedTypes={["application/pdf", ".doc", ".docx", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xls", ".xlsx", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".ppt", ".pptx", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]}
          />
          <Button onClick={handleUpload} disabled={isUploading || !selectedFiles[0] || !uploadTitle.trim()}>
            {isUploading ? "Uploading..." : "Upload File"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5" /> Uploaded Files</CardTitle>
          <div className="flex flex-wrap gap-3 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search by title, file name or course..."
                value={fileSearch}
                onChange={e => setFileSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCourseId} onValueChange={setFilterCourseId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                <SelectItem value="none">No course</SelectItem>
                {availableSubjects.map(subject => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(fileSearch || filterCourseId !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setFileSearch(""); setFilterCourseId("all"); }}>
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filesLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : files.length === 0 ? (
            <p className="text-muted-foreground text-sm">No files uploaded yet.</p>
          ) : filteredFiles.length === 0 ? (
            <p className="text-muted-foreground text-sm">No files match your search.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Course</th>
                    <th className="py-2 pr-4 font-medium">File</th>
                    <th className="py-2 pr-4 font-medium">Size</th>
                    <th className="py-2 pr-4 font-medium">Tutors</th>
                    <th className="py-2 pr-4 font-medium">Uploaded</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((row: any) => (
                    <tr key={row.file.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="py-2 pr-4 font-medium">{row.file.title}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.courseName ?? "—"}</td>
                      <td className="py-2 pr-4">
                        <div className="flex items-center gap-1">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <span className="truncate max-w-[160px]">{row.file.fileName}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatFileSize(row.file.fileSize)}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="secondary">{row.tutorAssignmentCount} tutor{row.tutorAssignmentCount !== 1 ? "s" : ""}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(row.file.createdAt).toLocaleDateString()}</td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openAssignDialog(row.file.id)}>Assign Tutors</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(row.file.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={assignDialogFileId !== null} onOpenChange={open => { if (!open) setAssignDialogFileId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign File to Tutors</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto py-2">
            {tutors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tutors found.</p>
            ) : tutors.map((tutor: any) => (
              <div key={tutor.id} className="flex items-center gap-2">
                <Checkbox
                  id={`tutor-${tutor.id}`}
                  checked={selectedTutorIds.includes(tutor.id)}
                  onCheckedChange={() => toggleTutor(tutor.id)}
                />
                <Label htmlFor={`tutor-${tutor.id}`} className="cursor-pointer">
                  {tutor.firstName} {tutor.lastName} <span className="text-muted-foreground text-xs">({tutor.email})</span>
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogFileId(null)}>Cancel</Button>
            <Button
              disabled={assignTutorsMutation.isPending}
              onClick={() => assignTutorsMutation.mutate({ fileId: assignDialogFileId!, tutorIds: selectedTutorIds })}
            >
              {assignTutorsMutation.isPending ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={open => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete File?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete the file and remove all tutor and parent assignments. This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deleteFileMutation.isPending} onClick={() => { deleteFileMutation.mutate({ fileId: deleteConfirmId! }); setDeleteConfirmId(null); }}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const { isUnlocked, lock } = useSuperUser();
  const [activeSection, setActiveSection] = useState<AdminSection>("analytics");
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);

  // Course management state
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [isTutorAssignmentOpen, setIsTutorAssignmentOpen] = useState(false);
  const { refetch: refetchCourses } = trpc.adminCourses.getAllCoursesWithTutors.useQuery({});

  // Pagination states
  const [usersPage, setUsersPage] = useState(1);
  const [enrollmentsPage, setEnrollmentsPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [sessionsPage, setSessionsPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Filter states
  const [userFilters, setUserFilters] = useState<{
    role?: "admin" | "parent" | "tutor" | "coordinator";
    search?: string;
    startDate?: string;
    endDate?: string;
  }>({});

  const [enrollmentFilters, setEnrollmentFilters] = useState<{
    status?: "active" | "paused" | "cancelled" | "completed";
    paymentStatus?: "paid" | "pending" | "failed";
    startDate?: string;
    endDate?: string;
  }>({});

  const [paymentFilters, setPaymentFilters] = useState<{
    status?: "completed" | "pending" | "failed";
    startDate?: string;
    endDate?: string;
  }>({});

  const [sessionFilters, setSessionFilters] = useState<{
    status?: "scheduled" | "completed" | "cancelled" | "no_show";
    startDate?: string;
    endDate?: string;
    parentName?: string;
    studentName?: string;
    courseName?: string;
    month?: string;
  }>({});

  const [dateRange, setDateRange] = useState<{ startDate?: string; endDate?: string }>({});
  const [selectedTutorId, setSelectedTutorId] = useState<number | null>(null);

  const { data: stats, isLoading: statsLoading } = trpc.admin.getOverviewStats.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" && isUnlocked }
  );

  const { data: revenueBreakdown, isLoading: revenueBreakdownLoading } = trpc.admin.getParentRevenueBreakdown.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" && isUnlocked && showRevenueBreakdown }
  );

  const { data: usersData, isLoading: usersLoading } = trpc.admin.getAllUsers.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (usersPage - 1) * ITEMS_PER_PAGE, ...userFilters },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: enrollmentsData, isLoading: enrollmentsLoading } = trpc.admin.getAllEnrollments.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (enrollmentsPage - 1) * ITEMS_PER_PAGE, ...enrollmentFilters },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: paymentsData, isLoading: paymentsLoading } = trpc.admin.getAllPayments.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (paymentsPage - 1) * ITEMS_PER_PAGE, ...paymentFilters },
    { enabled: isAuthenticated && user?.role === "admin" && isUnlocked }
  );

  const { data: sessionsData, isLoading: sessionsLoading } = trpc.admin.getAllSessions.useQuery(
    { limit: ITEMS_PER_PAGE, offset: (sessionsPage - 1) * ITEMS_PER_PAGE, ...sessionFilters },
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: sessionFilterOptions } = trpc.admin.getSessionFilterOptions.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      toast.success("User deleted successfully");
      setConfirmDeleteId(null);
      utils.admin.getAllUsers.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete user");
      setConfirmDeleteId(null);
    },
  });

  const { data: usersCSVData, refetch: refetchUsersCSV } = trpc.admin.exportUsersCSV.useQuery(userFilters, { enabled: false });
  const { data: enrollmentsCSVData, refetch: refetchEnrollmentsCSV } = trpc.admin.exportEnrollmentsCSV.useQuery(enrollmentFilters, { enabled: false });
  const { data: paymentsCSVData, refetch: refetchPaymentsCSV } = trpc.admin.exportPaymentsCSV.useQuery(paymentFilters, { enabled: false });

  const { data: analyticsData, isLoading: analyticsLoading } = trpc.admin.getAnalytics.useQuery(
    dateRange,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: tutorOptions, isLoading: tutorOptionsLoading } = trpc.admin.getTutorsForCourseApproval.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "admin" }
  );

  const { data: tutorPreferenceData, isLoading: tutorPreferencesLoading, refetch: refetchTutorPreferences } =
    trpc.admin.getTutorCoursePreferences.useQuery(
      { tutorId: selectedTutorId ?? 0 },
      { enabled: isAuthenticated && user?.role === "admin" && !!selectedTutorId }
    );

  const updatePreferenceStatus = trpc.admin.updateTutorCoursePreferenceStatus.useMutation({
    onSuccess: () => { toast.success("Preference updated"); refetchTutorPreferences(); },
    onError: (err) => toast.error(err.message || "Failed to update preference"),
  });

  const [payoutStatusFilter, setPayoutStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");
  const [editingPayoutId, setEditingPayoutId] = useState<number | null>(null);
  const [editedAmount, setEditedAmount] = useState("");

  const { data: payoutRequests = [], isLoading: payoutRequestsLoading, refetch: refetchPayoutRequests } =
    trpc.adminCourses.getPayoutRequests.useQuery(
      undefined,
      { enabled: isAuthenticated && user?.role === "admin" && isUnlocked }
    );

  const updatePayoutMutation = trpc.adminCourses.updatePayoutRequest.useMutation({
    onSuccess: () => {
      toast.success("Payout request updated");
      refetchPayoutRequests();
      setRejectingId(null);
      setRejectNotes("");
      setEditingPayoutId(null);
      setEditedAmount("");
    },
    onError: (err) => toast.error(err.message || "Failed to update payout request"),
  });

  const triggerUsageBillingMutation = trpc.adminCourses.triggerUsageBilling.useMutation({
    onSuccess: () => toast.success("Usage billing job completed — check server logs for details"),
    onError: (err) => toast.error(err.message || "Billing job failed"),
  });

  useEffect(() => {
    if (!loading && !isAuthenticated) window.location.href = LOGIN_PATH;
  }, [loading, isAuthenticated]);

  useEffect(() => { setUsersPage(1); }, [userFilters]);
  useEffect(() => { setEnrollmentsPage(1); }, [enrollmentFilters]);
  useEffect(() => { setPaymentsPage(1); }, [paymentFilters]);
  useEffect(() => { setSessionsPage(1); }, [sessionFilters]);

  useEffect(() => {
    if (!loading && isAuthenticated && user?.role !== "admin") {
      window.location.href = "/";
    }
  }, [loading, isAuthenticated, user]);

  const downloadCSV = (data: string, filename: string) => {
    const blob = new Blob([data], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportUsers = async () => {
    const result = await refetchUsersCSV();
    if (result.data) {
      const formatted = formatUsersForCSV(result.data);
      const csv = convertToCSV(formatted, ["id", "name", "email", "role", "createdAt"]);
      downloadCSV(csv, `users-export-${new Date().toISOString().split("T")[0]}.csv`);
    }
  };

  const handleExportEnrollments = async () => {
    const result = await refetchEnrollmentsCSV();
    if (result.data) {
      const formatted = formatEnrollmentsForCSV(result.data);
      const csv = convertToCSV(formatted, ["id", "courseName", "studentName", "parentName", "parentEmail", "tutorName", "status", "paymentStatus", "paymentPlan", "createdAt"]);
      downloadCSV(csv, `enrollments-export-${new Date().toISOString().split("T")[0]}.csv`);
    }
  };

  const handleExportPayments = async () => {
    const result = await refetchPaymentsCSV();
    if (result.data) {
      const formatted = formatPaymentsForCSV(result.data);
      const csv = convertToCSV(formatted, ["id", "amount", "currency", "status", "paymentType", "courseName", "studentName", "parentName", "parentEmail", "tutorName", "stripePaymentIntentId", "createdAt"]);
      downloadCSV(csv, `payments-export-${new Date().toISOString().split("T")[0]}.csv`);
    }
  };

  const resetUserFilters = () => setUserFilters({});
  const resetEnrollmentFilters = () => setEnrollmentFilters({});
  const resetPaymentFilters = () => setPaymentFilters({});
  const resetSessionFilters = () => setSessionFilters({});

  if (loading || !isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardLayout activeSection={activeSection} onSectionChange={setActiveSection}>
        <div className="space-y-6">
          {/* KPI Cards — shown on all sections */}
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-8 w-20" /> : (
                  <>
                    <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{stats?.totalParents || 0} Parents</span>
                      <span className="flex items-center gap-1"><GraduationCap className="h-3 w-3" />{stats?.totalTutors || 0} Tutors</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Enrollments</CardTitle>
                <BookOpen className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-8 w-20" /> : (
                  <>
                    <div className="text-2xl font-bold">{stats?.totalEnrollments || 0}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stats?.activeEnrollments || 0} active</p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-8 w-20" /> : (
                  <>
                    <div className="text-2xl font-bold">${stats?.totalRevenue || "0.00"}</div>
                    <p className="text-xs text-muted-foreground mt-1">{stats?.totalPayments || 0} transactions</p>
                    <RevenueBreakdownButton
                      isUnlocked={isUnlocked}
                      onOpen={() => setShowRevenueBreakdown(true)}
                      onLockAndOpen={() => { lock(); setShowRevenueBreakdown(true); }}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Section content */}
          {activeSection === "analytics" && (
            <div className="space-y-6">
              <DateRangeSelector onDateRangeChange={(startDate, endDate) => setDateRange({ startDate, endDate })} />
              {analyticsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Card key={i}>
                      <CardHeader><Skeleton className="h-6 w-40" /></CardHeader>
                      <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
                    </Card>
                  ))}
                </div>
              ) : analyticsData ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-blue-500" />User Growth Trends</CardTitle>
                      <CardDescription>New user registrations over the last 12 months</CardDescription>
                    </CardHeader>
                    <CardContent><UserGrowthChart data={analyticsData.userGrowth} /></CardContent>
                  </Card>
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-green-500" />Monthly Enrollment Patterns</CardTitle>
                      <CardDescription>Course enrollments by month for the past year</CardDescription>
                    </CardHeader>
                    <CardContent><EnrollmentPatternsChart data={analyticsData.enrollmentPatterns} /></CardContent>
                  </Card>
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-purple-500" />Revenue Trends</CardTitle>
                      <CardDescription>Monthly revenue from completed payments</CardDescription>
                    </CardHeader>
                    <CardContent><RevenueTrendsChart data={analyticsData.revenueData} /></CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-blue-500" />User Distribution</CardTitle>
                      <CardDescription>Breakdown of users by role</CardDescription>
                    </CardHeader>
                    <CardContent><UserDistributionChart data={analyticsData.userDistribution} /></CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-green-500" />Billing Status</CardTitle>
                      <CardDescription>Billing completion rates</CardDescription>
                    </CardHeader>
                    <CardContent><PaymentStatusChart data={analyticsData.paymentStatus} /></CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">No analytics data available</p>
              )}
            </div>
          )}

          {activeSection === "users" && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Search</label>
                      <Input placeholder="Name or email..." value={userFilters.search || ""} onChange={e => setUserFilters({ ...userFilters, search: e.target.value || undefined })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Role</label>
                      <Select value={userFilters.role || "all"} onValueChange={v => setUserFilters({ ...userFilters, role: v === "all" ? undefined : v as any })}>
                        <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All roles</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="tutor">Tutor</SelectItem>
                          <SelectItem value="coordinator">Coordinator</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Start Date</label>
                      <Input type="date" value={userFilters.startDate || ""} onChange={e => setUserFilters({ ...userFilters, startDate: e.target.value || undefined })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">End Date</label>
                      <Input type="date" value={userFilters.endDate || ""} onChange={e => setUserFilters({ ...userFilters, endDate: e.target.value || undefined })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={resetUserFilters}><X className="h-4 w-4 mr-2" />Reset</Button>
                    <Button variant="default" size="sm" onClick={handleExportUsers}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>Showing {usersData?.users.length || 0} of {usersData?.total || 0} users</CardDescription>
                </CardHeader>
                <CardContent>
                  {usersLoading ? (
                    <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                  ) : usersData && usersData.users.length > 0 ? (
                    <div className="space-y-3">
                      {usersData.users.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <p className="font-semibold">{u.name || "Unknown"}</p>
                              <Badge variant={u.role === "admin" ? "default" : u.role === "tutor" ? "secondary" : "outline"}>{u.role}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{u.email}</p>
                            {u.createdAt && <p className="text-xs text-muted-foreground mt-1">Joined {new Date(u.createdAt).toLocaleDateString()}</p>}
                          </div>
                          {u.role !== "admin" && (
                            confirmDeleteId === u.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-muted-foreground">Delete?</span>
                                <Button size="sm" variant="destructive" onClick={() => deleteUserMutation.mutate({ userId: u.id })} disabled={deleteUserMutation.isPending}>Yes</Button>
                                <Button size="sm" variant="outline" onClick={() => setConfirmDeleteId(null)}>No</Button>
                              </div>
                            ) : (
                              <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(u.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No users found</p>
                  )}
                  {usersData && usersData.total > ITEMS_PER_PAGE && (
                    <Pagination currentPage={usersPage} totalItems={usersData.total} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setUsersPage} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "enrollments" && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={enrollmentFilters.status || "all"} onValueChange={v => setEnrollmentFilters({ ...enrollmentFilters, status: v === "all" ? undefined : v as any })}>
                        <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="paused">Paused</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Billing Status</label>
                      <Select value={enrollmentFilters.paymentStatus || "all"} onValueChange={v => setEnrollmentFilters({ ...enrollmentFilters, paymentStatus: v === "all" ? undefined : v as any })}>
                        <SelectTrigger><SelectValue placeholder="All billing statuses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All billing statuses</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Start Date</label>
                      <Input type="date" value={enrollmentFilters.startDate || ""} onChange={e => setEnrollmentFilters({ ...enrollmentFilters, startDate: e.target.value || undefined })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">End Date</label>
                      <Input type="date" value={enrollmentFilters.endDate || ""} onChange={e => setEnrollmentFilters({ ...enrollmentFilters, endDate: e.target.value || undefined })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={resetEnrollmentFilters}><X className="h-4 w-4 mr-2" />Reset</Button>
                    <Button variant="default" size="sm" onClick={handleExportEnrollments}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>All Enrollments</CardTitle>
                  <CardDescription>Showing {enrollmentsData?.enrollments.length || 0} of {enrollmentsData?.total || 0} enrollments</CardDescription>
                </CardHeader>
                <CardContent>
                  {enrollmentsLoading ? (
                    <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
                  ) : enrollmentsData && enrollmentsData.enrollments.length > 0 ? (
                    <div className="space-y-3">
                      {enrollmentsData.enrollments.map(enrollment => (
                        <div key={enrollment.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-semibold">{enrollment.courseName}</p>
                              <Badge variant={enrollment.status === "active" ? "default" : "secondary"}>{enrollment.status}</Badge>
                              <Badge variant="outline" className="text-xs">{enrollment.paymentStatus}</Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <p><span className="font-medium text-foreground">Student:</span> {enrollment.studentName}</p>
                              <p><span className="font-medium text-foreground">Parent:</span> {enrollment.parentName} ({enrollment.parentEmail})</p>
                              <p><span className="font-medium text-foreground">Tutor:</span> {enrollment.tutorName}</p>
                              <p className="text-xs">Enrolled {new Date(enrollment.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No enrollments found</p>
                  )}
                  {enrollmentsData && enrollmentsData.total > ITEMS_PER_PAGE && (
                    <Pagination currentPage={enrollmentsPage} totalItems={enrollmentsData.total} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setEnrollmentsPage} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "payments" && (
            <SuperUserGate>
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Billing Tools</CardTitle>
                  <CardDescription>Administrative billing operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Button variant="outline" onClick={() => triggerUsageBillingMutation.mutate()} disabled={triggerUsageBillingMutation.isPending}>
                      {triggerUsageBillingMutation.isPending ? "Running..." : "Run Usage Billing Now"}
                    </Button>
                    <p className="text-sm text-muted-foreground">Manually trigger the usage billing job. Normally runs daily at 02:00 UTC.</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={paymentFilters.status || "all"} onValueChange={v => setPaymentFilters({ ...paymentFilters, status: v === "all" ? undefined : v as any })}>
                        <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Start Date</label>
                      <Input type="date" value={paymentFilters.startDate || ""} onChange={e => setPaymentFilters({ ...paymentFilters, startDate: e.target.value || undefined })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">End Date</label>
                      <Input type="date" value={paymentFilters.endDate || ""} onChange={e => setPaymentFilters({ ...paymentFilters, endDate: e.target.value || undefined })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={resetPaymentFilters}><X className="h-4 w-4 mr-2" />Reset</Button>
                    <Button variant="default" size="sm" onClick={handleExportPayments}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>All Billing Transactions</CardTitle>
                  <CardDescription>Showing {paymentsData?.payments.length || 0} of {paymentsData?.total || 0} transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
                  ) : paymentsData && paymentsData.payments.length > 0 ? (
                    <div className="space-y-3">
                      {paymentsData.payments.map(payment => {
                        const planLabel = payment.paymentPlan === "installment"
                          ? payment.installmentNumber ? `Installment ${payment.installmentNumber}` : "Installment"
                          : "Pay in Full";
                        return (
                          <div key={payment.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <p className="font-semibold text-lg">${payment.amount} {payment.currency.toUpperCase()}</p>
                                <Badge variant={payment.status === "completed" ? "default" : "secondary"}>{payment.status}</Badge>
                                <Badge variant="outline">{planLabel}</Badge>
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <p><span className="font-medium text-foreground">Date:</span> {new Date(payment.createdAt).toLocaleDateString()} at {new Date(payment.createdAt).toLocaleTimeString()}</p>
                                {payment.courseName && <p><span className="font-medium text-foreground">Course:</span> {payment.courseName}</p>}
                                {payment.studentName && <p><span className="font-medium text-foreground">Student:</span> {payment.studentName}</p>}
                                <p><span className="font-medium text-foreground">Parent:</span> {payment.parentName} ({payment.parentEmail})</p>
                                <p><span className="font-medium text-foreground">Tutor:</span> {payment.tutorName}</p>
                                {payment.stripePaymentIntentId && <p className="text-xs"><span className="font-medium text-foreground">Transaction ID:</span> {payment.stripePaymentIntentId}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No billing transactions found</p>
                  )}
                  {paymentsData && paymentsData.total > ITEMS_PER_PAGE && (
                    <Pagination currentPage={paymentsPage} totalItems={paymentsData.total} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setPaymentsPage} />
                  )}
                </CardContent>
              </Card>
            </div>
            </SuperUserGate>
          )}

          {activeSection === "sessions" && (
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Filters</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Status</label>
                      <Select value={sessionFilters.status || "all"} onValueChange={v => setSessionFilters({ ...sessionFilters, status: v === "all" ? undefined : v as any })}>
                        <SelectTrigger><SelectValue placeholder="All statuses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="no_show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Month</label>
                      <Select value={sessionFilters.month || "all"} onValueChange={v => setSessionFilters({ ...sessionFilters, month: v === "all" ? undefined : v })}>
                        <SelectTrigger><SelectValue placeholder="All months" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All months</SelectItem>
                          {sessionFilterOptions?.months.map(m => (
                            <SelectItem key={m} value={m}>{new Date(m + "-01").toLocaleDateString(undefined, { year: "numeric", month: "long" })}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Parent Name</label>
                      <Select value={sessionFilters.parentName || "all"} onValueChange={v => setSessionFilters({ ...sessionFilters, parentName: v === "all" ? undefined : v })}>
                        <SelectTrigger><SelectValue placeholder="All parents" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All parents</SelectItem>
                          {sessionFilterOptions?.parentNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Student Name</label>
                      <Select value={sessionFilters.studentName || "all"} onValueChange={v => setSessionFilters({ ...sessionFilters, studentName: v === "all" ? undefined : v })}>
                        <SelectTrigger><SelectValue placeholder="All students" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All students</SelectItem>
                          {sessionFilterOptions?.studentNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Course Name</label>
                      <Select value={sessionFilters.courseName || "all"} onValueChange={v => setSessionFilters({ ...sessionFilters, courseName: v === "all" ? undefined : v })}>
                        <SelectTrigger><SelectValue placeholder="All courses" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All courses</SelectItem>
                          {sessionFilterOptions?.courseNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Start Date</label>
                      <Input type="date" value={sessionFilters.startDate || ""} onChange={e => setSessionFilters({ ...sessionFilters, startDate: e.target.value || undefined })} />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">End Date</label>
                      <Input type="date" value={sessionFilters.endDate || ""} onChange={e => setSessionFilters({ ...sessionFilters, endDate: e.target.value || undefined })} />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={resetSessionFilters}><X className="h-4 w-4 mr-2" />Reset</Button>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>All Sessions</CardTitle>
                  <CardDescription>Showing {sessionsData?.sessions.length || 0} of {sessionsData?.total || 0} sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  {sessionsLoading ? (
                    <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
                  ) : sessionsData && sessionsData.sessions.length > 0 ? (
                    <div className="space-y-3">
                      {sessionsData.sessions.map(session => {
                        const studentName = [session.studentFirstName, session.studentLastName].filter(Boolean).join(" ").trim() || "Student";
                        return (
                          <div key={session.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <p className="font-semibold">{new Date(session.scheduledAt).toLocaleDateString()} • {new Date(session.scheduledAt).toLocaleTimeString()}</p>
                                <Badge
                                  variant={session.status === "completed" ? "secondary" : session.status === "cancelled" ? "destructive" : session.status === "no_show" ? "outline" : "default"}
                                  className={session.status === "no_show" ? "bg-amber-100 text-amber-900 border-amber-300" : ""}
                                >
                                  {session.status === "no_show" ? "Completed (No Show)" : session.status}
                                </Badge>
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <p><span className="font-medium text-foreground">Course:</span> {session.courseTitle || "Unknown"}</p>
                                <p><span className="font-medium text-foreground">Student:</span> {studentName}</p>
                                <p><span className="font-medium text-foreground">Parent:</span> {session.parentName} ({session.parentEmail})</p>
                                <p><span className="font-medium text-foreground">Tutor:</span> {session.tutorName}</p>
                                <p><span className="font-medium text-foreground">Duration:</span> {session.duration} minutes</p>
                                {session.feedbackFromTutor && <p className="mt-2"><span className="font-medium text-foreground">Tutor Notes:</span> {session.feedbackFromTutor}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">No sessions found</p>
                  )}
                  {sessionsData && sessionsData.total > ITEMS_PER_PAGE && (
                    <Pagination currentPage={sessionsPage} totalItems={sessionsData.total} itemsPerPage={ITEMS_PER_PAGE} onPageChange={setSessionsPage} />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "payout-requests" && (
            <SuperUserGate>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Select value={payoutStatusFilter} onValueChange={v => setPayoutStatusFilter(v as any)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {payoutRequestsLoading ? (
                <div className="space-y-2">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
              ) : (() => {
                const filtered = payoutStatusFilter === "all" ? payoutRequests : payoutRequests.filter(r => r.status === payoutStatusFilter);
                if (filtered.length === 0) return <p className="text-muted-foreground text-center py-8">No payout requests found.</p>;
                return (
                  <div className="space-y-3">
                    {filtered.map(req => {
                      const studentName = req.studentFirstName || req.studentLastName ? `${req.studentFirstName ?? ""} ${req.studentLastName ?? ""}`.trim() : "Student";
                      return (
                        <Card key={req.id}>
                          <CardContent className="py-4">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                              <div className="space-y-1">
                                <p className="font-semibold">{req.tutorName} <span className="text-muted-foreground font-normal text-sm">({req.tutorEmail})</span></p>
                                <p className="text-sm text-muted-foreground">{req.courseTitle} · Student: {studentName} · Parent: {req.parentName}</p>
                                <p className="text-sm text-muted-foreground">{req.sessionsCompleted} sessions · ${parseFloat(req.ratePerSession).toFixed(2)}/session</p>
                                {req.adminNotes && <p className="text-sm text-red-600">Note: {req.adminNotes}</p>}
                                <p className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</p>
                              </div>
                              <div className="flex flex-col items-end gap-2 shrink-0">
                                <p className="text-xl font-bold">${parseFloat(req.totalAmount).toFixed(2)}</p>
                                <Badge className={req.status === "approved" ? "bg-green-100 text-green-800 border-green-200" : req.status === "rejected" ? "bg-red-100 text-red-800 border-red-200" : "bg-yellow-100 text-yellow-800 border-yellow-200"}>
                                  {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                                </Badge>
                                {req.status === "pending" && (
                                  <div className="flex gap-2 mt-1">
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => updatePayoutMutation.mutate({
                                        id: req.id,
                                        status: "approved",
                                        adjustedAmount: editingPayoutId === req.id && editedAmount ? editedAmount : undefined,
                                      })}
                                      disabled={updatePayoutMutation.isPending}>Approve</Button>
                                    <Button size="sm" variant="outline"
                                      onClick={() => {
                                        setEditingPayoutId(editingPayoutId === req.id ? null : req.id);
                                        setEditedAmount(parseFloat(req.totalAmount).toFixed(2));
                                        setRejectingId(null);
                                      }}>Edit Amount</Button>
                                    <Button size="sm" variant="destructive" onClick={() => { setRejectingId(rejectingId === req.id ? null : req.id); setEditingPayoutId(null); }}>Reject</Button>
                                  </div>
                                )}
                                {editingPayoutId === req.id && req.status === "pending" && (
                                  <div className="flex gap-2 mt-1 w-full items-center">
                                    <span className="text-sm text-muted-foreground">$</span>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={editedAmount}
                                      onChange={e => setEditedAmount(e.target.value)}
                                      className="text-sm h-8 w-28"
                                      placeholder="New amount"
                                    />
                                    <span className="text-xs text-muted-foreground">then hit Approve</span>
                                  </div>
                                )}
                                {rejectingId === req.id && (
                                  <div className="flex gap-2 mt-1 w-full">
                                    <Input placeholder="Rejection reason (optional)" value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} className="text-sm h-8" />
                                    <Button size="sm" variant="destructive" onClick={() => updatePayoutMutation.mutate({ id: req.id, status: "rejected", adminNotes: rejectNotes || undefined })} disabled={updatePayoutMutation.isPending}>Confirm</Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            </SuperUserGate>
          )}

          {activeSection === "courses" && (
            <div className="space-y-6">
              <CourseCreationForm onSuccess={() => refetchCourses()} />
              <CourseManagementTable onAssignTutors={courseId => { setSelectedCourseId(courseId); setIsTutorAssignmentOpen(true); }} />
              <TutorAssignmentDialog
                courseId={selectedCourseId}
                isOpen={isTutorAssignmentOpen}
                onClose={() => { setIsTutorAssignmentOpen(false); setSelectedCourseId(null); refetchCourses(); }}
              />
            </div>
          )}

          {activeSection === "registered-tutors" && <RegisteredTutorsManager />}

          {activeSection === "coordinators" && <CoordinatorManager />}

          {activeSection === "course-approval" && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Tutor Course Approval</CardTitle>
                  <CardDescription>Select a tutor to review their requested courses and approve or reject individually.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Select Tutor</label>
                      <Select value={selectedTutorId ? String(selectedTutorId) : undefined} onValueChange={v => setSelectedTutorId(Number(v))} disabled={tutorOptionsLoading}>
                        <SelectTrigger className="w-72"><SelectValue placeholder="Select Tutor" /></SelectTrigger>
                        <SelectContent>
                          {tutorOptions?.map(tutor => (
                            <SelectItem key={tutor.id} value={String(tutor.id)}>
                              {tutor.name || "Tutor"}{tutor.email ? ` • ${tutor.email}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedTutorId && (() => {
                      const selected = tutorOptions?.find(t => t.id === selectedTutorId);
                      const rate = selected?.hourlyRate ? parseFloat(selected.hourlyRate) : null;
                      return rate && rate > 0 ? (
                        <div className="pb-0.5">
                          <p className="text-xs text-muted-foreground mb-1">Requested Hourly Rate</p>
                          <p className="text-lg font-semibold text-primary">${rate.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/hr</span></p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  {!tutorOptionsLoading && (!tutorOptions || tutorOptions.length === 0) && (
                    <p className="text-sm text-muted-foreground">No tutors found.</p>
                  )}
                </CardContent>
              </Card>
              {selectedTutorId && (
                <Card>
                  <CardHeader>
                    <CardTitle>Requested Courses</CardTitle>
                    <CardDescription>Decisions apply immediately. Pending preferences are hidden from parents until approved.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {tutorPreferencesLoading ? (
                      <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                    ) : tutorPreferenceData && tutorPreferenceData.length > 0 ? (
                      <div className="divide-y">
                        <div className="grid grid-cols-12 text-sm font-medium text-muted-foreground py-2">
                          <div className="col-span-4">Course</div>
                          <div className="col-span-2">Requested Rate</div>
                          <div className="col-span-2">Status</div>
                          <div className="col-span-4 text-right">Actions</div>
                        </div>
                        {tutorPreferenceData.map((pref: any) => (
                          <div key={pref.id} className="grid grid-cols-12 items-center py-3 gap-2">
                            <div className="col-span-4"><p className="font-semibold">{pref.courseTitle}</p></div>
                            <div className="col-span-2">${parseFloat(pref.hourlyRate || 0).toFixed(2)}</div>
                            <div className="col-span-2">
                              <Badge variant={pref.approvalStatus === "APPROVED" ? "default" : pref.approvalStatus === "REJECTED" ? "destructive" : "secondary"}>{pref.approvalStatus}</Badge>
                            </div>
                            <div className="col-span-4 flex justify-end gap-2">
                              <Button size="sm" variant="outline" disabled={updatePreferenceStatus.isPending} onClick={() => updatePreferenceStatus.mutate({ preferenceId: pref.id, approvalStatus: "APPROVED" })}>Approve</Button>
                              <Button size="sm" variant="secondary" disabled={updatePreferenceStatus.isPending} onClick={() => updatePreferenceStatus.mutate({ preferenceId: pref.id, approvalStatus: "REJECTED" })}>Reject</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No preferences submitted by this tutor yet.</p>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeSection === "availability" && <TutorAvailabilityManager />}

          {activeSection === "email" && <EmailSettings />}

          {activeSection === "referrals" && <ReferralSettingsPanel />}

          {activeSection === "testimonials" && <TestimonialsManager />}

          {activeSection === "course-files" && <CourseFilesAdminPanel />}
          {activeSection === "session-notes" && <AdminSessionNotes />}
          {activeSection === "security" && <SuperUserSettings />}
        </div>
      </DashboardLayout>

      {/* Parent Revenue Breakdown Dialog */}
      <Dialog open={showRevenueBreakdown} onOpenChange={open => { if (!open) setShowRevenueBreakdown(false); }}>
        <DialogContent className="max-w-4xl w-full max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">Revenue Breakdown by Parent</DialogTitle>
            {!revenueBreakdownLoading && isUnlocked && (revenueBreakdown ?? []).length > 0 && (
              <p className="text-sm text-muted-foreground">
                {(revenueBreakdown ?? []).length} parents · {(revenueBreakdown ?? []).reduce((s, r) => s + r.count, 0)} transactions ·
                <span className="font-semibold text-foreground"> ${(revenueBreakdown ?? []).reduce((s, r) => s + r.total, 0).toFixed(2)} total</span>
              </p>
            )}
          </DialogHeader>

          {!isUnlocked ? (
            <SuperUserGate><span /></SuperUserGate>
          ) : revenueBreakdownLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (revenueBreakdown ?? []).length === 0 ? (
            <p className="text-center text-muted-foreground py-12">No completed payments found</p>
          ) : (
            <div className="overflow-y-auto flex-1 pr-1">
              {/* Column headers */}
              <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-x-4 px-4 py-2 text-xs font-medium text-muted-foreground border-b sticky top-0 bg-background z-10">
                <span>#</span>
                <span>Parent / Student</span>
                <span className="text-right w-16">Txns</span>
                <span className="text-right w-24">Revenue</span>
              </div>

              <Accordion type="multiple" className="w-full">
                {(revenueBreakdown ?? []).map((row, idx) => (
                  <AccordionItem key={row.parentId} value={String(row.parentId)} className="border-b">
                    <AccordionTrigger className="hover:no-underline hover:bg-muted/40 px-4 py-3 [&>svg]:ml-2">
                      <div className="grid grid-cols-[1.5rem_1fr_auto_auto] gap-x-4 w-full text-left items-center">
                        <span className="text-xs text-muted-foreground">{idx + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{row.parentName}</p>
                          <p className="text-xs text-muted-foreground">{row.parentEmail}</p>
                        </div>
                        <span className="text-sm text-right w-16">{row.count}</span>
                        <span className="text-sm font-semibold text-right w-24">${row.total.toFixed(2)}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-0">
                      <div className="bg-muted/30 border-t">
                        {/* Student sub-header */}
                        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-8 py-1.5 text-xs font-medium text-muted-foreground border-b border-muted">
                          <span>Student · Course</span>
                          <span className="text-right w-16">Txns</span>
                          <span className="text-right w-24">Revenue</span>
                          <span className="w-4" />
                        </div>
                        {row.students.map((s, si) => (
                          <div key={si} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-8 py-2.5 border-b border-muted/60 last:border-0 hover:bg-muted/50">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium">{s.studentName}</p>
                                {(s as any).migrated && (
                                  <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded px-1.5 py-0.5 leading-none">migrated</span>
                                )}
                              </div>
                              {s.courseName && <p className="text-xs text-muted-foreground">{s.courseName}</p>}
                            </div>
                            <span className="text-sm text-right w-16 self-center">{s.count}</span>
                            <span className="text-sm font-semibold text-right w-24 self-center">
                              {(s as any).migrated ? <span className="text-muted-foreground text-xs">—</span> : `$${s.total.toFixed(2)}`}
                            </span>
                            <span className="w-4" />
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
