import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { LOGIN_PATH } from "@/const";
import { ZoomMeetingSetup } from "@/components/ZoomMeetingSetup";
import { VideoUploadManager } from "@/components/VideoUploadManager";
import { User } from "lucide-react";

export default function TutorProfile() {
  const { user, isAuthenticated, loading } = useAuth();

  const { data: tutorProfile } = trpc.tutorProfile.getMy.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "tutor",
  });

  if (!loading && !isAuthenticated) {
    window.location.href = LOGIN_PATH;
    return null;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <Navigation />
      <div className="container max-w-3xl pt-24 pb-12 px-4">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <User className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Profile Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Zoom meeting setup and introduction video
          </p>
        </div>

        <ZoomMeetingSetup tutorProfile={tutorProfile} />
        <VideoUploadManager currentVideoUrl={(tutorProfile as any)?.introVideoUrl} />
      </div>
    </div>
  );
}
