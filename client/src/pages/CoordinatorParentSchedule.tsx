import { useEffect } from "react";
import { useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { CoordinatorSessionsView } from "@/components/CoordinatorSessionsView";

/**
 * Coordinator view of a specific parent's schedule/sessions
 * This allows coordinators to view and monitor sessions for assigned parents
 */
export function CoordinatorParentSchedule() {
  const { parentId } = useParams<{ parentId: string }>();
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: parentInfo, isLoading: parentLoading } = trpc.users.getById.useQuery(
    { userId: parseInt(parentId!) },
    { enabled: isAuthenticated && user?.role === "coordinator" && !!parentId }
  );

  const { data: upcomingSessions, isLoading: sessionsLoading, refetch: refetchSessions } = trpc.session.getParentUpcomingSessions.useQuery(
    { parentId: parseInt(parentId!) },
    { enabled: isAuthenticated && user?.role === "coordinator" && !!parentId }
  );

  const { data: sessionHistory, isLoading: historyLoading, refetch: refetchHistory } = trpc.session.getParentPastSessions.useQuery(
    { parentId: parseInt(parentId!) },
    { enabled: isAuthenticated && user?.role === "coordinator" && !!parentId }
  );

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "coordinator")) {
      window.location.href = LOGIN_PATH;
    }
  }, [isAuthenticated, user, loading]);

  if (loading || !isAuthenticated || user?.role !== "coordinator") {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-8 mt-20">
        {/* Back button */}
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => setLocation("/coordinator/dashboard")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        {/* Header */}
        <div className="mb-6">
          {parentLoading ? (
            <Skeleton className="h-10 w-64 mb-2" />
          ) : (
            <h1 className="text-3xl font-bold mb-2">
              Schedule for {parentInfo?.firstName} {parentInfo?.lastName}
            </h1>
          )}
          <p className="text-muted-foreground">
            View and monitor all sessions for this family
          </p>
        </div>

        {/* Sessions View with Filters */}
        <CoordinatorSessionsView
          upcomingSessions={upcomingSessions || []}
          sessionHistory={sessionHistory || []}
          sessionsLoading={sessionsLoading}
          historyLoading={historyLoading}
        />
      </div>
    </div>
  );
}
