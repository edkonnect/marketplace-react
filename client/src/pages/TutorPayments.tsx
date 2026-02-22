import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { LOGIN_PATH } from "@/const";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, CheckCircle, Clock, XCircle } from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="h-3 w-3 mr-1" />
        Approved
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200">
        <XCircle className="h-3 w-3 mr-1" />
        Rejected
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
      <Clock className="h-3 w-3 mr-1" />
      Pending
    </Badge>
  );
}

export default function TutorPayments() {
  const { isAuthenticated, loading, user } = useAuth();

  if (!loading && !isAuthenticated) {
    window.location.href = LOGIN_PATH;
  }
  if (user && user.role !== "tutor" && user.role !== "admin") {
    window.location.href = "/";
  }

  const { data: completedEnrollments = [], isLoading: loadingEnrollments, refetch: refetchEnrollments } =
    trpc.payment.getCompletedEnrollments.useQuery();

  const { data: payoutRequests = [], isLoading: loadingRequests, refetch: refetchRequests } =
    trpc.payment.getMyPayoutRequests.useQuery();

  const requestPayoutMutation = trpc.payment.requestPayout.useMutation({
    onSuccess: () => {
      toast.success("Payout request submitted successfully");
      refetchEnrollments();
      refetchRequests();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to submit payout request");
    },
  });

  const handleRequestPayout = (subscriptionId: number) => {
    requestPayoutMutation.mutate({ subscriptionId });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="container py-8 space-y-8">
        <h1 className="text-3xl font-bold">Billing & Payouts</h1>

        {/* Ready to Request */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Ready to Request
          </h2>
          {loadingEnrollments ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : completedEnrollments.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No completed enrollments available for payout request.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {completedEnrollments.map((enrollment) => {
                const hourlyRate = parseFloat(enrollment.tutorHourlyRate ?? "0");
                const durationHours = (enrollment.courseDuration ?? 60) / 60;
                const ratePerSession = hourlyRate * durationHours;
                const totalAmount = ratePerSession * (enrollment.sessionsCompleted ?? 0);
                const studentName =
                  enrollment.studentFirstName || enrollment.studentLastName
                    ? `${enrollment.studentFirstName ?? ""} ${enrollment.studentLastName ?? ""}`.trim()
                    : "Student";

                return (
                  <Card key={enrollment.subscriptionId}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">{enrollment.courseTitle}</CardTitle>
                      <CardDescription>
                        Student: {studentName} · Parent: {enrollment.parentName}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <div>Sessions completed: <span className="font-medium text-foreground">{enrollment.sessionsCompleted}</span></div>
                        <div>Rate per session: <span className="font-medium text-foreground">${ratePerSession.toFixed(2)}</span></div>
                      </div>
                      <div className="text-lg font-bold text-green-600">
                        Total: ${totalAmount.toFixed(2)}
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => handleRequestPayout(enrollment.subscriptionId)}
                        disabled={requestPayoutMutation.isPending}
                      >
                        Request Payout
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Payout Requests History */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Payout Requests</h2>
          {loadingRequests ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : payoutRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No payout requests submitted yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {payoutRequests.map((req) => {
                const studentName =
                  req.studentFirstName || req.studentLastName
                    ? `${req.studentFirstName ?? ""} ${req.studentLastName ?? ""}`.trim()
                    : "Student";

                return (
                  <Card key={req.id}>
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <p className="font-semibold">{req.courseTitle}</p>
                          <p className="text-sm text-muted-foreground">
                            Student: {studentName} · Parent: {req.parentName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {req.sessionsCompleted} sessions · ${parseFloat(req.ratePerSession).toFixed(2)}/session
                          </p>
                          {req.adminNotes && (
                            <p className="text-sm text-red-600 mt-1">
                              Note: {req.adminNotes}
                            </p>
                          )}
                        </div>
                        <div className="text-right space-y-2 shrink-0">
                          <p className="text-lg font-bold">${parseFloat(req.totalAmount).toFixed(2)}</p>
                          <StatusBadge status={req.status} />
                          <p className="text-xs text-muted-foreground">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
