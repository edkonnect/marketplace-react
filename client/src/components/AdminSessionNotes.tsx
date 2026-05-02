import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Search, X } from "lucide-react";

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

  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [appliedTutor, setAppliedTutor] = useState<string>("all");

  const { data: tutors = [] } = trpc.admin.getTutorsForCourseApproval.useQuery();

  // Deduplicate tutors by name
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

  const notesOnly = useMemo(() => {
    return (sessionsData?.sessions || []).filter(s => {
      if (!s.feedbackFromTutor || s.feedbackFromTutor.trim() === "") return false;
      if (appliedTutor !== "all") {
        return (s.tutorName || "") === appliedTutor;
      }
      return true;
    });
  }, [sessionsData, appliedTutor]);

  const handleApply = () => {
    setAppliedFrom(fromDate);
    setAppliedTo(toDate);
    setAppliedTutor(selectedTutorName);
  };

  const handleReset = () => {
    const f = thirtyDaysAgo();
    const t = today();
    setFromDate(f);
    setToDate(t);
    setSelectedTutorName("all");
    setAppliedFrom(f);
    setAppliedTo(t);
    setAppliedTutor("all");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <Select key={selectedTutorName} value={selectedTutorName} onValueChange={(v) => { setSelectedTutorName(v); setAppliedTutor(v); }}>
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
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleApply} className="gap-2">
              <Search className="h-4 w-4" /> Apply
            </Button>
            <Button size="sm" variant="outline" onClick={handleReset} className="gap-2">
              <X className="h-4 w-4" /> Reset
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
                <tbody key={appliedTutor}>
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
