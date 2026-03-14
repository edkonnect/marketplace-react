import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe } from "lucide-react";
import { toast } from "sonner";

export function ZoomMeetingSetup({ tutorProfile }: { tutorProfile: any }) {
  const [isCreating, setIsCreating] = useState(false);

  const createZoomMeeting = trpc.tutorProfile.createZoomMeeting.useMutation({
    onSuccess: () => {
      toast.success("Zoom meeting created successfully!");
      window.location.reload();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create Zoom meeting");
      setIsCreating(false);
    },
  });

  const handleCreateZoomMeeting = async () => {
    setIsCreating(true);
    try {
      await createZoomMeeting.mutateAsync();
    } catch {
      // handled by onError
    }
  };

  const hasZoomMeeting = tutorProfile?.zoomJoinUrl;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Zoom Meeting Setup
        </CardTitle>
        <CardDescription>
          {hasZoomMeeting
            ? "Your permanent Zoom meeting room for all tutoring sessions"
            : "Create your permanent Zoom meeting link to use for all sessions"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasZoomMeeting ? (
          <>
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Student Join URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input readOnly value={tutorProfile.zoomJoinUrl} className="font-mono text-sm" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tutorProfile.zoomJoinUrl); toast.success("Join URL copied to clipboard!"); }}>
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Share this link with your students</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Your Host URL</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input readOnly value={tutorProfile.zoomHostUrl} className="font-mono text-sm" />
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(tutorProfile.zoomHostUrl); toast.success("Host URL copied to clipboard!"); }}>
                    Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Use this link to start your meetings</p>
              </div>

              {tutorProfile.zoomMeetingPassword && (
                <div>
                  <Label className="text-sm font-medium">Meeting Password</Label>
                  <Input readOnly value={tutorProfile.zoomMeetingPassword} className="font-mono text-sm mt-1" />
                </div>
              )}

              <div className="pt-2">
                <Badge variant="secondary" className="text-xs">
                  ✅ Permanent Meeting Room - Use for all sessions
                </Badge>
              </div>
            </div>

            <Button variant="outline" size="sm" onClick={handleCreateZoomMeeting} disabled={isCreating}>
              {isCreating ? "Creating..." : "Recreate Zoom Meeting"}
            </Button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <p className="text-sm">
                <strong>Why create a permanent Zoom link?</strong>
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>One consistent link for all your tutoring sessions</li>
                <li>Students can easily save and reuse the same link</li>
                <li>Automatic cloud recording for session transcripts</li>
                <li>Students can join before you arrive</li>
              </ul>
            </div>
            <Button onClick={handleCreateZoomMeeting} disabled={isCreating} className="w-full">
              {isCreating ? "Creating Zoom Meeting..." : "Create My Zoom Meeting Room"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
