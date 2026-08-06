import { useParams, Link } from "wouter";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export function StudentDetail() {
  const params = useParams<{ id: string }>();
  const userId = Number(params.id);

  const { data, isLoading, refetch } = trpc.admin.getUserSessionDetails.useQuery(
    { userId },
    { enabled: !isNaN(userId) }
  );

  const [startDate, setStartDate] = useState("");
  const [completionDate, setCompletionDate] = useState("");
  const [testDate, setTestDate] = useState("");
  const [testDate2, setTestDate2] = useState("");
  const [testDate3, setTestDate3] = useState("");

  useEffect(() => {
    if (data?.satDetails) {
      setStartDate((data.satDetails as any).courseStartDate ? new Date((data.satDetails as any).courseStartDate).toISOString().slice(0, 10) : "");
      setCompletionDate(data.satDetails.courseCompletionDate ? new Date(data.satDetails.courseCompletionDate).toISOString().slice(0, 10) : "");
      setTestDate(data.satDetails.satTestDate ? new Date(data.satDetails.satTestDate).toISOString().slice(0, 10) : "");
      setTestDate2((data.satDetails as any).satTestDate2 ? new Date((data.satDetails as any).satTestDate2).toISOString().slice(0, 10) : "");
      setTestDate3((data.satDetails as any).satTestDate3 ? new Date((data.satDetails as any).satTestDate3).toISOString().slice(0, 10) : "");
    }
  }, [data?.satDetails]);

  const updateMutation = trpc.admin.updateSatStudentDetails.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save");
    },
  });

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-10 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container max-w-4xl py-10">
        <p className="text-muted-foreground">Student not found.</p>
        <Link href="/admin/dashboard" className="text-primary hover:underline">Back to Users</Link>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-10 space-y-6">
      <Link href="/admin/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Users
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{data.user.name || "Unknown"}</h1>
        {data.isSat && <Badge variant="default" className="bg-blue-600">SAT</Badge>}
      </div>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>{data.user.email}</p>
        {data.user.phoneNumber && <p>{data.user.phoneNumber}</p>}
        {data.user.createdAt && <p>Joined {new Date(data.user.createdAt).toLocaleDateString()}</p>}
      </div>

      {data.isSat && (
        <Card>
          <CardHeader><CardTitle>SAT Tracking</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4 mb-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Course Dates</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Course Start Date</Label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Course Completion Date</Label>
                    <Input type="date" value={completionDate} onChange={e => setCompletionDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">SAT Test Dates</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Test 1 Date</Label>
                    <Input type="date" value={testDate} onChange={e => setTestDate(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Test 2 Date</Label>
                    <Input type="date" value={testDate2} onChange={e => setTestDate2(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Test 3 Date</Label>
                    <Input type="date" value={testDate3} onChange={e => setTestDate3(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({
                userId,
                courseStartDate: startDate || null,
                courseCompletionDate: completionDate || null,
                satTestDate: testDate || null,
                satTestDate2: testDate2 || null,
                satTestDate3: testDate3 || null,
              })}
            >
              Save
            </Button>
          </CardContent>
        </Card>
      )}

      {data.packages.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Package / Hours</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.packages.map(p => (
                <div key={p.subscriptionId} className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">{p.courseTitle}</p>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">{p.completed} of {p.totalSessions} sessions used</span>
                    <span className="text-muted-foreground">{p.remaining} remaining</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{ width: `${p.totalSessions > 0 ? Math.min(100, (p.completed / p.totalSessions) * 100) : 0}%` }}
                    />
                  </div>
                  {p.scheduled > 0 && <p className="text-xs text-muted-foreground mt-2">{p.scheduled} more scheduled</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Session Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{data.summary.total}</p>
              <p className="text-xs text-muted-foreground">Total Sessions</p>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{data.summary.completed}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{data.summary.scheduled}</p>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </div>
            <div className="border rounded-lg p-3 text-center">
              <p className="text-2xl font-bold">{data.summary.cancelled + data.summary.noShow}</p>
              <p className="text-xs text-muted-foreground">Cancelled/No-show</p>
            </div>
          </div>
          {data.summary.subjects.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.summary.subjects.map(s => (
                <Badge key={s.subject} variant="outline">{s.subject} ({s.count})</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Sessions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sessions.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No sessions yet</TableCell></TableRow>
              ) : data.sessions.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{new Date(s.scheduledAt).toLocaleDateString()}</TableCell>
                  <TableCell>{s.courseTitle || s.courseSubject || "—"}</TableCell>
                  <TableCell>{s.tutorName || "—"}</TableCell>
                  <TableCell><Badge variant={s.status === "completed" ? "secondary" : s.status === "cancelled" || s.status === "no_show" ? "outline" : "default"}>{s.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
