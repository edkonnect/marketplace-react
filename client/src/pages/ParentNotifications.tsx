import Navigation from "@/components/Navigation";
import { useAuth } from "@/_core/hooks/useAuth";
import { NotificationSettings } from "@/components/NotificationSettings";
import { LOGIN_PATH } from "@/const";

export default function ParentNotifications() {
  const { isAuthenticated, loading, user } = useAuth();

  if (!loading && !isAuthenticated) {
    window.location.href = LOGIN_PATH;
  }
  if (user && user.role !== "parent" && user.role !== "admin") {
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <div className="container py-8 space-y-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        <NotificationSettings />
      </div>
    </div>
  );
}
