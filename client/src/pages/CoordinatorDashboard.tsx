import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, MessageSquare, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import Navigation from "@/components/Navigation";

export function CoordinatorDashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);

  const { data: assignments, isLoading: assignmentsLoading } = trpc.coordinators.getMyAssignments.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "coordinator" }
  );

  const { data: parentConversations, isLoading: conversationsLoading } = trpc.messaging.getCoordinatorParentConversations.useQuery(
    undefined,
    { enabled: isAuthenticated && user?.role === "coordinator", refetchInterval: 10000 }
  );

  // Generate dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  // Generate dynamic subtitle
  const getSubtitle = () => {
    if (assignmentsLoading) return "Loading your dashboard...";
    const familyCount = assignments?.length || 0;
    if (familyCount === 0) return "Your coordinator dashboard";
    if (familyCount === 1) return `Supporting 1 family`;
    return `Supporting ${familyCount} families`;
  };

  useEffect(() => {
    if (!loading && (!isAuthenticated || user?.role !== "coordinator")) {
      window.location.href = LOGIN_PATH;
    }
  }, [isAuthenticated, user, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="w-32 h-32 rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== "coordinator") {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <Navigation />

      <div className="container mx-auto px-4 py-8 mt-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            {getGreeting()}, {user.firstName}!
          </h1>
          <p className="text-muted-foreground">
            {getSubtitle()}
          </p>
        </div>

        {/* Parent Messages */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Parent Messages
            </CardTitle>
            <CardDescription>
              Direct messages from parents you support
            </CardDescription>
          </CardHeader>
          <CardContent>
            {conversationsLoading ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : parentConversations && parentConversations.length > 0 ? (
              <div className="space-y-2">
                {parentConversations.map((conv: any) => (
                  <button
                    key={conv.conversationId}
                    onClick={() => setLocation('/coordinator/messages')}
                    className="w-full p-4 text-left hover:bg-muted/50 transition-colors border rounded-lg flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate">{conv.parentName}</p>
                        {conv.unreadCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {conv.unreadCount} new
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{conv.parentEmail}</p>
                      {conv.lastMessageAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last message: {new Date(conv.lastMessageAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <MessageSquare className="h-5 w-5 text-muted-foreground flex-shrink-0 ml-3" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Mail className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No messages from parents yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assigned Parents */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Assigned Families
            </CardTitle>
            <CardDescription>
              Access messages and schedules for the families you support
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assignmentsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : assignments && assignments.length > 0 ? (
              <div className="grid gap-4">
                {assignments.map((assignment: any) => (
                  <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold mb-1">
                            {assignment.parent?.firstName} {assignment.parent?.lastName}
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {assignment.parent?.email}
                          </p>
                          {assignment.notes && (
                            <p className="text-sm text-muted-foreground italic mb-4">
                              Note: {assignment.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button
                          onClick={() => setLocation(`/coordinator/parent/${assignment.parentId}/messages`)}
                          className="flex-1 w-full sm:w-auto"
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          View Messages
                        </Button>
                        <Button
                          onClick={() => setLocation(`/coordinator/parent/${assignment.parentId}/schedule`)}
                          variant="outline"
                          className="flex-1 w-full sm:w-auto"
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          View Schedule
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg text-muted-foreground mb-2">No families assigned yet</p>
                <p className="text-sm text-muted-foreground">
                  Contact an administrator to get started with family assignments
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
