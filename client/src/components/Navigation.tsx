import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { GraduationCap, MessageSquare, LayoutDashboard, LogOut, Play, Bell, CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc";
import VideoModal from "@/components/VideoModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";

export default function Navigation() {
  const { user, isAuthenticated, loading } = useAuth();
  const [location] = useLocation();
  const [isVideoModalOpen, setIsVideoModalOpen] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(true);
  const [lastScrollY, setLastScrollY] = React.useState(0);
  const logoutMutation = trpc.auth.logout.useMutation();

  // Scroll behavior for show/hide navbar
  React.useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;

      // Show navbar when scrolling up or at top
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setIsVisible(true);
      }
      // Hide navbar when scrolling down and not at top
      else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', controlNavbar, { passive: true });

    return () => {
      window.removeEventListener('scroll', controlNavbar);
    };
  }, [lastScrollY]);

  const { data: unreadData } = trpc.messaging.getUnreadMessageCount.useQuery(
    undefined,
    {
      enabled: isAuthenticated && (user?.role === "parent" || user?.role === "tutor"),
      // Avoid constant polling; refresh on tab focus and every 60s instead of ~5–10s
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    }
  );
  const unreadCount = unreadData?.count ?? 0;

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/";
  };

  const getDashboardLink = () => {
    if (user?.role === "admin") return "/admin/dashboard";
    if (user?.role === "tutor") return "/tutor/dashboard";
    if (user?.role === "parent") return "/parent/dashboard";
    return "/"; // Default to home if no role assigned
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  // Public pages where navbar should always show (even when not authenticated)
  const publicPages = ["/", "/tutors", "/courses", "/tutor-registration"];
  const isPublicPage = publicPages.some(page => location === page || (page === "/" && location === "/"));

  // Auth pages (login/signup) should NEVER show navbar
  const isAuthPage = location.startsWith(LOGIN_PATH) || location.startsWith("/signup");

  if (isAuthPage) {
    return null;
  }

  // On protected pages (dashboards, messages, etc), hide navbar if not authenticated
  // This handles the case when tokens expire and user becomes null
  if (!isAuthenticated && !isPublicPage && !loading) {
    return null;
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="mx-4 mt-4">
        <div className="container mx-auto bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl shadow-lg">
          <div className="flex items-center justify-between h-16 px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary hover:text-primary/80 transition-colors">
            <GraduationCap className="w-8 h-8" />
            <span>EdKonnect Academy</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/tutors" className={`text-sm font-medium transition-colors hover:text-primary ${
              location === "/tutors" ? "text-primary" : "text-muted-foreground"
            }`}>
              Find Tutors
            </Link>

            <Link href="/courses" className={`text-sm font-medium transition-colors hover:text-primary ${
              location === "/courses" ? "text-primary" : "text-muted-foreground"
            }`}>
              Browse Courses
            </Link>

            {user?.role !== "tutor" && (
              <Link href="/tutor-registration" className={`text-sm font-medium transition-colors hover:text-primary ${
                location === "/tutor-registration" ? "text-primary" : "text-muted-foreground"
              }`}>
                Become a Tutor
              </Link>
            )}

            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary text-muted-foreground"
            >
              <Play className="w-4 h-4" />
              What's EdKonnect
            </button>

            {isAuthenticated && (
              <>
                <Link href={getDashboardLink()} className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                  location.includes("/dashboard") ? "text-primary" : "text-muted-foreground"
                }`}>
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>

                <Link href="/messages" className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                  location === "/messages" ? "text-primary" : "text-muted-foreground"
                }`}>
                  <span className="relative">
                    <MessageSquare className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </span>
                  Messages
                </Link>
              </>
            )}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : isAuthenticated && user ? (
              <>
                {/* Notification Bell */}
                <NotificationBell />

                <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative h-10 w-10 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="flex flex-col space-y-1 p-2">
                    <p className="text-sm font-medium">{user.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user.role} Account
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={getDashboardLink()} className="flex items-center w-full cursor-pointer">
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/messages" className="flex items-center w-full cursor-pointer">
                      <span className="relative mr-2">
                        <MessageSquare className="w-4 h-4" />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}
                      </span>
                      Messages
                      {unreadCount > 0 && (
                        <span className="ml-auto text-xs font-semibold text-red-500">{unreadCount} new</span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin/dashboard" className="flex items-center w-full cursor-pointer">
                        <LayoutDashboard className="w-4 h-4 mr-2" />
                        Admin Panel
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Log out
                  </DropdownMenuItem>
                  {user.role === 'parent' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/parent/payments" className="flex items-center w-full cursor-pointer">
                          <CreditCard className="w-4 h-4 mr-2" />
                          Billing
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/parent/notifications" className="flex items-center w-full cursor-pointer">
                          <Bell className="w-4 h-4 mr-2" />
                          Notifications
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  {user.role === 'tutor' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/tutor/payments" className="flex items-center w-full cursor-pointer">
                          <CreditCard className="w-4 h-4 mr-2" />
                          Billing
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/tutor/notifications" className="flex items-center w-full cursor-pointer">
                          <Bell className="w-4 h-4 mr-2" />
                          Notifications
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              </>
            ) : (
              <Button asChild>
                <a href={LOGIN_PATH}>Sign In</a>
              </Button>
            )}
          </div>
        </div>
      </div>
      <VideoModal open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen} />
    </div>
    </nav>
  );
}
