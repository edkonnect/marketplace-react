import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, X, Download } from "lucide-react";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function AdminSessionNotes() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTutorName, setSelectedTutorName] = useState<string>("all");
  const [selectedParentEmail, setSelectedParentEmail] = useState<string>("all");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [appliedTutor, setAppliedTutor] = useState<string>("all");
  const [appliedParent, setAppliedParent] = useState<string>("all");

  const { data: tutors = [] } = trpc.admin.getTutorsForCourseApproval.useQuery();

  const uniqueTutors = useMemo(() => {
    const seen = new Set<string>();
    return tutors.filter(t => {
      const key = t.name || t.email || String(t.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [tutors]);

  const { data: sessionsData, isLoading } = trpc.admin.getAllSessions.useQuery({
    limit: 1000,
    offset: 0,
    startDate: appliedFrom,
    endDate: appliedTo,
  });

  // Get unique parents filtered by selected tutor
  const uniqueParents = useMemo(() => {
    const seen = new Set<string>();
    const parents: { email: string; name: string }[] = [];
    (sessionsData?.sessions || []).forEach(s => {
      if (!s.feedbackFromTutor || s.feedbackFromTutor.trim() === "") return;
      if (appliedTutor !== "all" && (s.tutorName || "") !== appliedTutor) return;
      if (s.parentEmail && !seen.has(s.parentEmail)) {
        seen.add(s.parentEmail);
        parents.push({ email: s.parentEmail, name: s.parentName || s.parentEmail });
      }
    });
    return parents.sort((a, b) => a.name.localeCompare(b.name));
  }, [sessionsData, appliedTutor]);

  const notesOnly = useMemo(() => {
    return (sessionsData?.sessions || []).filter(s => {
      if (!s.feedbackFromTutor || s.feedbackFromTutor.trim() === "") return false;
      if (appliedTutor !== "all" && (s.tutorName || "") !== appliedTutor) return false;
      if (appliedParent !== "all" && (s.parentEmail || "") !== appliedParent) return false;
      return true;
    });
  }, [sessionsData, appliedTutor, appliedParent]);

  const handleApply = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedTutor(selectedTutorName);
    setAppliedParent(selectedParentEmail);
  };

  const handleReset = () => {
    const f = thirtyDaysAgo();
    const t = today();
    setFromDate(f);
    setToDate(t);
    setSelectedTutorName("all");
    setSelectedParentEmail("all");
    setAppliedFrom(f);
    setAppliedTo(t);
    setAppliedTutor("all");
    setAppliedParent("all");
  };

  const handleGeneratePdf = async () => {
    if (notesOnly.length === 0) return;
    setIsGeneratingPdf(true);

    try {
      const parentLabel = appliedParent !== "all"
        ? uniqueParents.find(p => p.email === appliedParent)?.name || appliedParent
        : "All Parents";

      const fromLabel = appliedFrom
        ? new Date(appliedFrom).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "All time";
      const toLabel = appliedTo
        ? new Date(appliedTo).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        : "Today";

      const sessionRows = notesOnly.map(s => {
        const studentName = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ") || "—";
        const date = new Date(s.scheduledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const notes = (s.feedbackFromTutor || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        return `
          <div class="session-card">
            <div class="session-header">
              <div>
                <div class="session-date">${date}</div>
                <div class="session-meta" style="margin-top:4px;">
                  <strong>Student:</strong> ${studentName} &nbsp;|&nbsp; <strong>Tutor:</strong> ${s.tutorName || "—"}
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
    .meta-item span { font-weight: 600; display: block; font-size: 11px; opacity: 0.75; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 32px 40px; }
    .session-card { border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 20px; overflow: hidden; page-break-inside: avoid; }
    .session-header { background: #f8fafc; padding: 14px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px; }
    .session-date { font-size: 13px; font-weight: 600; color: #2563eb; }
    .session-meta { font-size: 13px; color: #374151; }
    .session-meta strong { color: #111827; }
    .course-badge { display: inline-block; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 20px; padding: 2px 10px; font-size: 12px; font-weight: 500; }
    .session-body { padding: 16px 20px; }
    .notes-text { font-size: 13px; line-height: 1.75; color: #374151; white-space: pre-wrap; }
    .footer { margin-top: 40px; padding: 20px 40px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af; }
    .summary { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px 20px; margin-bottom: 28px; display: flex; gap: 32px; flex-wrap: wrap; }
    .summary-item { font-size: 13px; color: #374151; }
    .summary-item strong { display: block; font-size: 22px; color: #16a34a; font-weight: 700; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>EdKonnect Academy</h1>
    <p>Session Notes Report</p>
    <div class="meta">
      <div class="meta-item"><span>Parent</span>${parentLabel}</div>
      <div class="meta-item"><span>Period</span>${fromLabel} — ${toLabel}</div>
      <div class="meta-item"><span>Generated</span>${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
    </div>
  </div>
  <div class="content">
    <div class="summary">
      <div class="summary-item"><strong>${notesOnly.length}</strong>Total Sessions</div>
      <div class="summary-item"><strong>${totalTutors}</strong>Tutors</div>
      <div class="summary-item"><strong>${totalStudents}</strong>Students</div>
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">From Date</label>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">To Date</label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={today()}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tutor</label>
              <Select
                key={selectedTutorName}
                value={selectedTutorName}
                onValueChange={(v) => {
                  setSelectedTutorName(v);
                  setAppliedTutor(v);
                  setSelectedParentEmail("all");
                  setAppliedParent("all");
                }}
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
            <div>
              <label className="text-sm font-medium mb-2 block">Parent</label>
              <Select
                key={`${appliedTutor}-${selectedParentEmail}`}
                value={selectedParentEmail}
                onValueChange={(v) => {
                  setSelectedParentEmail(v);
                  setAppliedParent(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All parents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parents</SelectItem>
                  {uniqueParents.map((p) => (
                    <SelectItem key={p.email} value={p.email}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleApply} className="gap-2">
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
          {!isLoading && (
            <p className="text-sm text-muted-foreground">
              {notesOnly.length} session{notesOnly.length !== 1 ? "s" : ""} with notes found
            </p>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
            </div>
          ) : notesOnly.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="font-medium">No session notes found</p>
              <p className="text-sm text-muted-foreground mt-1">Try adjusting the date range or tutor filter</p>
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
                <tbody key={`${appliedTutor}-${appliedParent}`}>
                  {notesOnly.map((s) => {
                    const studentName = [s.studentFirstName, s.studentLastName].filter(Boolean).join(" ") || "—";
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40 align-top">
                        <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                          {new Date(s.scheduledAt).toLocaleDateString()}
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