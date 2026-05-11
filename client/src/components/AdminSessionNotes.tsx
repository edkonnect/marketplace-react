import { useState, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, X, Download, User } from "lucide-react";

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Fix timezone issue: parse YYYY-MM-DD as local date, not UTC
function parseLocalDate(dateStr: string) {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatLocalDate(dateStr: string) {
  const d = parseLocalDate(dateStr);
  if (!d) return "All time";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function AdminSessionNotes() {
  // Filter input state (what user types/selects)
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTutorName, setSelectedTutorName] = useState<string>("all");
  const [parentSearch, setParentSearch] = useState("");
  const [selectedParent, setSelectedParent] = useState<{ email: string; name: string } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Applied filter state (what actually filters the data)
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [appliedTutor, setAppliedTutor] = useState<string>("all");

  // Gate — only show results after user explicitly applies AND selects a parent
  const [hasApplied, setHasApplied] = useState(false);

  // Date selection is required before parent search is enabled
  const isDateSelected = fromDate.trim() !== "" && toDate.trim() !== "";

  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: tutors = [] } = trpc.admin.getTutorsForCourseApproval.useQuery();

  const { data: parentsData } = trpc.admin.getAllUsers.useQuery({
    role: "parent",
    limit: 1000,
    offset: 0,
  });

  const uniqueTutors = useMemo(() => {
    const seen = new Set<string>();
    return tutors.filter(t => {
      const key = t.name || t.email || String(t.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tutors]);

  const filteredParents = useMemo(() => {
    const allParents = (parentsData?.users || []).map(u => ({
      email: u.email || "",
      name: u.name || u.email || "",
    })).filter(p => p.email);

    if (!parentSearch.trim()) return allParents.slice(0, 10);
    const q = parentSearch.toLowerCase();
    return allParents.filter(p =>
      p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
    ).slice(0, 10);
  }, [parentsData, parentSearch]);

  // Only fetch when user has applied filters AND selected a parent
  const shouldFetch = hasApplied && selectedParent !== null;

  const { data: sessionsData, isLoading } = trpc.admin.getAllSessions.useQuery(
    {
      limit: 2000,
      offset: 0,
      startDate: appliedFrom,
      endDate: appliedTo,
      parentName: selectedParent?.name || undefined,
    },
    {
      enabled: shouldFetch,
    }
  );

  const notesOnly = useMemo(() => {
    if (!shouldFetch) return [];
    return (sessionsData?.sessions || []).filter(s => {
      if (!s.feedbackFromTutor || s.feedbackFromTutor.trim() === "") return false;
      if (appliedTutor !== "all" && (s.tutorName || "") !== appliedTutor) return false;
      if (selectedParent && (s.parentEmail || "") !== selectedParent.email) return false;
      return true;
    });
  }, [sessionsData, appliedTutor, selectedParent, shouldFetch]);

  const handleApply = () => {
    if (!isDateSelected) return;
    if (!selectedParent) return;
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedTutor(selectedTutorName);
    setHasApplied(true);
  };

  const handleReset = () => {
    setFromDate("");
    setToDate("");
    setSelectedTutorName("all");
    setParentSearch("");
    setSelectedParent(null);
    setAppliedFrom("");
    setAppliedTo("");
    setAppliedTutor("all");
    setHasApplied(false);
  };

  const handleSelectParent = (p: { email: string; name: string }) => {
    setSelectedParent(p);
    setParentSearch(p.name);
    setShowSuggestions(false);
  };

  const handleClearParent = () => {
    setSelectedParent(null);
    setParentSearch("");
    setHasApplied(false);
  };

  const handleGeneratePdf = async () => {
    if (notesOnly.length === 0) return;
    setIsGeneratingPdf(true);

    try {
      const parentLabel = selectedParent ? selectedParent.name : "All Parents";

      // Use the applied (confirmed) date range for PDF label
      const fromLabel = appliedFrom ? formatLocalDate(appliedFrom) : "All time";
      const toLabel = appliedTo ? formatLocalDate(appliedTo) : "Today";

      const sessionRows = notesOnly.map(s => {
        const studentName = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ") || "—";
        const date = new Date(s.scheduledAt).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          timeZone: "Asia/Kolkata",
        });
        const notes = (s.feedbackFromTutor || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `
          <div class="session-card">
            <div class="session-header">
              <div>
                <div class="session-date">${date}</div>
                <div class="session-meta" style="margin-top:4px;">
                  <strong>Student:</strong> ${studentName} &nbsp;|&nbsp;
                  <strong>Tutor:</strong> ${s.tutorName || "—"} &nbsp;|&nbsp;
                  <strong>Parent:</strong> ${selectedParent ? selectedParent.name : (s.parentEmail || "—")}
                </div>
              </div>
              <div class="course-badge">${s.courseTitle || "—"}</div>
            </div>
            <div class="session-body">
              <p class="notes-text">${notes}</p>
            </div>
          </div>
        `;
      }).join("");

      const totalStudents = new Set(notesOnly.map(s => [s.studentFirstName, s.studentLastName].filter(Boolean).join(" "))).size;
      const totalTutors = new Set(notesOnly.map(s => s.tutorName)).size;

      // Build per-student summary grouped by student → tutor+course → session count
      type StudentGroup = {
        tutorCourses: Record<string, { tutor: string; course: string; count: number }>;
        total: number;
      };
      const studentMap: Record<string, StudentGroup> = {};
      notesOnly.forEach(s => {
        const studentName = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ") || "Unknown";
        const tutor = s.tutorName || "—";
        const course = s.courseTitle || "—";
        const key = `${tutor}__${course}`;
        if (!studentMap[studentName]) studentMap[studentName] = { tutorCourses: {}, total: 0 };
        if (!studentMap[studentName].tutorCourses[key]) {
          studentMap[studentName].tutorCourses[key] = { tutor, course, count: 0 };
        }
        studentMap[studentName].tutorCourses[key].count++;
        studentMap[studentName].total++;
      });

      const studentSummaryRows = Object.entries(studentMap).map(([studentName, data], idx) => {
        const courseRows = Object.values(data.tutorCourses).map(tc => `
          <tr class="course-row">
            <td class="col-course">• ${tc.course}</td>
            <td class="col-tutor">${tc.tutor}</td>
            <td class="col-sessions">${tc.count}</td>
          </tr>
        `).join("");
        return `
          <div class="student-summary-card">
            <div class="student-summary-header">
              <span class="student-index">Student ${idx + 1}</span>
              <span class="student-name">${studentName}</span>
              <span class="student-total">${data.total} session${data.total !== 1 ? "s" : ""}</span>
            </div>
            <table class="summary-table">
              <colgroup>
                <col style="width:55%">
                <col style="width:35%">
                <col style="width:10%">
              </colgroup>
              <thead>
                <tr class="summary-thead-row">
                  <th class="col-course th">Course</th>
                  <th class="col-tutor th">Tutor</th>
                  <th class="col-sessions th">Sessions</th>
                </tr>
              </thead>
              <tbody>
                ${courseRows}
              </tbody>
            </table>
          </div>
        `;
      }).join("");

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Session Notes - ${parentLabel}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; }
    .header { background: linear-gradient(135deg, #2563eb, #10b981); padding: 32px 40px; color: white; }
    .header h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; }
    .header p { font-size: 14px; opacity: 0.85; }
    .meta { display: flex; gap: 32px; margin-top: 16px; flex-wrap: wrap; }
    .meta-item { font-size: 13px; }
    .meta-label { font-weight: 600; font-size: 11px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .meta-value { font-size: 13px; font-weight: 500; }
    .content { padding: 32px 40px; }
    .session-card { border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
    .session-header { background: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; }
    .session-date { font-size: 13px; font-weight: 600; color: #2563eb; }
    .session-meta { font-size: 13px; color: #374151; }
    .session-meta strong { color: #111827; }
    .course-badge { display: inline-block; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 20px; padding: 2px 10px; font-size: 12px; font-weight: 500; white-space: nowrap; }
    .session-body { padding: 16px 20px; }
    .notes-text { font-size: 13px; line-height: 1.75; color: #374151; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding: 20px 40px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
    .date-range-banner { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px 16px; margin-bottom: 20px; font-size: 13px; color: #1d4ed8; font-weight: 500; }
    .summary-title { font-size: 11px; font-weight: 700; color: #6b7280; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .student-summary-card { border: 1px solid #d1fae5; border-radius: 10px; margin-bottom: 14px; overflow: hidden; page-break-inside: avoid; }
    .student-summary-header { background: #f0fdf4; padding: 12px 20px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #d1fae5; }
    .student-index { background: #16a34a; color: white; font-size: 10px; font-weight: 700; border-radius: 20px; padding: 3px 10px; white-space: nowrap; letter-spacing: 0.3px; }
    .student-name { font-size: 14px; font-weight: 700; color: #111827; flex: 1; }
    .student-total { font-size: 12px; color: #16a34a; font-weight: 700; white-space: nowrap; }
    .summary-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .summary-thead-row { background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
    .th { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.6px; padding: 8px 16px; text-align: left; }
    .col-course { padding: 9px 16px; font-size: 12px; color: #374151; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .col-tutor { padding: 9px 16px; font-size: 12px; color: #374151; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
    .col-sessions { padding: 9px 16px; font-size: 13px; font-weight: 700; color: #16a34a; border-bottom: 1px solid #f3f4f6; vertical-align: middle; text-align: center; }
    .course-row:last-child td { border-bottom: none; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>EdKonnect Academy</h1>
    <p>Session Notes Report</p>
    <div class="meta">
      <div class="meta-item"><div class="meta-label">Parent</div><div class="meta-value">${parentLabel}</div></div>
      <div class="meta-item"><div class="meta-label">Date Range</div><div class="meta-value">${fromLabel} — ${toLabel}</div></div>
      <div class="meta-item"><div class="meta-label">Generated</div><div class="meta-value">${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}</div></div>
    </div>
  </div>
  <div class="content">
    <div class="date-range-banner">
      📅 Showing session notes from <strong>${fromLabel}</strong> to <strong>${toLabel}</strong>
    </div>
    <div style="margin-bottom:28px;">
      <div class="summary-title">Summary by Student</div>
      ${studentSummaryRows}
    </div>
    ${sessionRows}
  </div>
  <div class="footer">
    &copy; ${new Date().getFullYear()} EdKonnect Academy &nbsp;|&nbsp; admin@edkonnect.com
  </div>
</body>
</html>`;

      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Please allow popups to generate PDF");
        return;
      }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Determine if Apply button should be enabled
  const canApply = isDateSelected && selectedParent !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Step 1: From Date */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                From Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={fromDate}
                max={toDate || today()}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  // Reset parent if date changes
                  setSelectedParent(null);
                  setParentSearch("");
                  setHasApplied(false);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Step 2: To Date */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                To Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={today()}
                onChange={(e) => {
                  setToDate(e.target.value);
                  // Reset parent if date changes
                  setSelectedParent(null);
                  setParentSearch("");
                  setHasApplied(false);
                }}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Tutor filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tutor</label>
              <Select
                key={selectedTutorName}
                value={selectedTutorName}
                onValueChange={(v) => setSelectedTutorName(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tutors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tutors</SelectItem>
                  {uniqueTutors.map((t) => (
                    <SelectItem key={t.id} value={t.name || t.email || String(t.id)}>
                      {t.name || t.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 3: Parent search — only enabled after both dates are selected */}
            <div ref={searchRef} className="relative">
              <label className="text-sm font-medium mb-2 block">
                Search Parent <span className="text-red-500">*</span>
              </label>
              {!isDateSelected && (
                <p className="text-xs text-amber-600 mb-1">⚠ Select From & To date first</p>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={parentSearch}
                  placeholder={isDateSelected ? "Type parent name..." : "Select dates first"}
                  disabled={!isDateSelected}
                  onChange={(e) => {
                    setParentSearch(e.target.value);
                    setSelectedParent(null);
                    setShowSuggestions(true);
                    setHasApplied(false);
                  }}
                  onFocus={() => isDateSelected && setShowSuggestions(true)}
                  className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {parentSearch && (
                  <button
                    onClick={handleClearParent}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {showSuggestions && parentSearch && filteredParents.length > 0 && isDateSelected && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-input rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredParents.map(p => (
                    <button
                      key={p.email}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                      onMouseDown={() => handleSelectParent(p)}
                    >
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.email}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedParent && (
                <p className="text-xs text-green-600 mt-1">✓ Selected: {selectedParent.name}</p>
              )}
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              onClick={handleApply}
              disabled={!canApply}
              className="gap-2"
              title={!isDateSelected ? "Select date range first" : !selectedParent ? "Select a parent first" : ""}
            >
              <Search className="h-4 w-4" /> Apply
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-2">
              <X className="h-4 w-4" /> Reset
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf || notesOnly.length === 0}
              className="gap-2 ml-auto"
            >
              <Download className="h-4 w-4" />
              {isGeneratingPdf ? "Generating..." : "Generate PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Notes</CardTitle>
          {shouldFetch && !isLoading && (
            <p className="text-sm text-muted-foreground">
              {notesOnly.length} session{notesOnly.length !== 1 ? "s" : ""} with notes found
              {appliedFrom && appliedTo && (
                <span className="ml-2 text-blue-600 font-medium">
                  ({formatLocalDate(appliedFrom)} — {formatLocalDate(appliedTo)})
                </span>
              )}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!shouldFetch ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Search className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="font-medium">No filters applied</p>
              <p className="text-sm text-muted-foreground mt-1">
                {!isDateSelected
                  ? "Start by selecting a From and To date, then search for a parent"
                  : !selectedParent
                  ? "Now search and select a parent to view session notes"
                  : "Click Apply to load session notes"}
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : notesOnly.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="font-medium">No session notes found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try a different date range, tutor, or parent
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Student</th>
                    <th className="py-2 pr-4 font-medium">Tutor</th>
                    <th className="py-2 pr-4 font-medium">Course</th>
                    <th className="py-2 pr-4 font-medium">Parent Email</th>
                    <th className="py-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody key={selectedParent?.email || "all"}>
                  {notesOnly.map((s) => {
                    const studentName = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ") || "—";
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40 align-top">
                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                          {new Date(s.scheduledAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: "Asia/Kolkata",
                          })}
                        </td>
                        <td className="py-3 pr-4 font-medium whitespace-nowrap">{studentName}</td>
                        <td className="py-3 pr-4 whitespace-nowrap">{s.tutorName || "—"}</td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <Badge variant="secondary">{s.courseTitle || "—"}</Badge>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">{s.parentEmail || "—"}</td>
                        <td className="py-3 max-w-sm">
                          <p className="whitespace-pre-wrap text-xs leading-relaxed">{s.feedbackFromTutor}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}