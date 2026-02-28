import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Calendar, Clock, User, BookOpen, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function ManageBooking() {
  const params = useParams<{ token: string }>();
  const token = params.token || "";
  const [cancelled, setCancelled] = useState(false);

  const { data: session, isLoading, error } = trpc.bookingManagement.getSession.useQuery(
    { token },
    { enabled: !!token && !cancelled }
  );

  const cancelMutation = trpc.bookingManagement.cancelSession.useMutation({
    onSuccess: () => {
      setCancelled(true);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="container max-w-3xl">
          <Card>
            <CardHeader>
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96 mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="container max-w-3xl">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Booking Not Found</AlertTitle>
            <AlertDescription>
              {error?.message || "The booking link is invalid or has expired. Please check your email for the correct link."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (cancelled) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
        <div className="container max-w-3xl">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <CardTitle>Session Cancelled</CardTitle>
              </div>
              <CardDescription>
                Your tutoring session has been cancelled successfully.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Confirmation Email Sent</AlertTitle>
                <AlertDescription>
                  A cancellation confirmation has been sent to your email address.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const sessionDate = new Date(session.scheduledAt);
  const isPastSession = sessionDate < new Date();
  const canManage = session.status === "scheduled" && !isPastSession;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="container max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>Manage Your Booking</CardTitle>
            <CardDescription>
              View session details and manage your booking
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Session Status */}
            {session.status === "cancelled" && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertTitle>Session Cancelled</AlertTitle>
                <AlertDescription>
                  This session has been cancelled.
                </AlertDescription>
              </Alert>
            )}

            {session.status === "completed" && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertTitle>Session Completed</AlertTitle>
                <AlertDescription>
                  This session has been completed.
                </AlertDescription>
              </Alert>
            )}

            {isPastSession && session.status === "scheduled" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Past Session</AlertTitle>
                <AlertDescription>
                  This session has already passed and cannot be modified.
                </AlertDescription>
              </Alert>
            )}

            {/* Session Details */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <BookOpen className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Course</p>
                  <p className="text-sm text-muted-foreground">{session.course?.title || "N/A"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Tutor</p>
                  <p className="text-sm text-muted-foreground">{session.tutorUser?.name || "N/A"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Date & Time</p>
                  <p className="text-sm text-muted-foreground">
                    {sessionDate.toLocaleString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZoneName: "short",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Duration</p>
                  <p className="text-sm text-muted-foreground">{session.duration} minutes</p>
                </div>
              </div>

              {session.notes && (
                <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                  <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Notes</p>
                    <p className="text-sm text-muted-foreground">{session.notes}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {canManage && (
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1">
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancel Session
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will cancel your tutoring session scheduled for{" "}
                        {sessionDate.toLocaleDateString()}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Session</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          cancelMutation.mutate({ token });
                        }}
                        disabled={cancelMutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {cancelMutation.isPending ? "Cancelling..." : "Yes, Cancel Session"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {!canManage && session.status === "scheduled" && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Cannot Modify</AlertTitle>
                <AlertDescription>
                  This session cannot be rescheduled or cancelled at this time.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
