import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { LOGIN_PATH } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  BookOpen,
  BookCheck,
  CalendarDays,
  CreditCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquareQuote,
  PanelLeft,
  Share2,
  ShieldCheck,
  Users,
  UserSquare2,
  Wallet,
  ClipboardList,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

export type AdminSection =
  | "analytics"
  | "users"
  | "enrollments"
  | "sessions"
  | "payout-requests"
  | "payments"
  | "registered-tutors"
  | "availability"
  | "course-approval"
  | "courses"
  | "course-files"
  | "testimonials"
  | "coordinators"
  | "email"
  | "referrals"
  | "session-notes"
  | "login-report"
  | "security";

type NavItem = {
  icon: React.ElementType;
  label: string;
  section: AdminSection;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { icon: BarChart3, label: "Analytics", section: "analytics" },
    ],
  },
  {
    label: "Operations",
    items: [
      { icon: Users, label: "Users", section: "users" },
      { icon: BookOpen, label: "Enrollments", section: "enrollments" },
      { icon: CalendarDays, label: "Sessions", section: "sessions" },
      { icon: Wallet, label: "Payout Requests", section: "payout-requests" },
      { icon: FileText, label: "Session Notes", section: "session-notes" },
      { icon: ClipboardList, label: "Login Report", section: "login-report" },
    ],
  },
  {
    label: "Billing",
    items: [
      { icon: CreditCard, label: "Payments", section: "payments" },
    ],
  },
  {
    label: "Tutors",
    items: [
      { icon: GraduationCap, label: "Registered Tutors", section: "registered-tutors" },
      { icon: CalendarDays, label: "Availability", section: "availability" },
      { icon: BookCheck, label: "Course Approval", section: "course-approval" },
    ],
  },
  {
    label: "Content",
    items: [
      { icon: BookOpen, label: "Courses", section: "courses" },
      { icon: FileText, label: "Course Files", section: "course-files" },
      { icon: MessageSquareQuote, label: "Testimonials", section: "testimonials" },
    ],
  },
  {
    label: "Settings",
    items: [
      { icon: UserSquare2, label: "Coordinators", section: "coordinators" },
      { icon: Mail, label: "Email Settings", section: "email" },
      { icon: Share2, label: "Referrals", section: "referrals" },
      { icon: ShieldCheck, label: "Security", section: "security" },
    ],
  },
];

const SIDEBAR_WIDTH_KEY = "admin-sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

type DashboardLayoutProps = {
  children: React.ReactNode;
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
};

export default function DashboardLayout({
  children,
  activeSection,
  onSectionChange,
}: DashboardLayoutProps) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication.
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = LOGIN_PATH; }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent
        setSidebarWidth={setSidebarWidth}
        activeSection={activeSection}
        onSectionChange={onSectionChange}
      >
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  activeSection,
  onSectionChange,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const activeItem = navGroups
    .flatMap((g) => g.items)
    .find((item) => item.section === activeSection);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r bg-sidebar">
          {/* Header */}
          <SidebarHeader className="h-16 justify-center border-b">
            <div className="flex items-center gap-3 px-2">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  <LayoutDashboard className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold tracking-tight truncate text-sm">
                    Admin Dashboard
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          {/* Nav groups */}
          <SidebarContent className="gap-0 py-2">
            {navGroups.map((group, gi) => (
              <div key={group.label}>
                {gi > 0 && <SidebarSeparator className="my-1" />}
                <SidebarGroup className="py-0">
                  {!isCollapsed && (
                    <SidebarGroupLabel className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {group.label}
                    </SidebarGroupLabel>
                  )}
                  <SidebarMenu className="px-2">
                    {group.items.map((item) => {
                      const isActive = activeSection === item.section;
                      return (
                        <SidebarMenuItem key={item.section}>
                          <SidebarMenuButton
                            isActive={isActive}
                            onClick={() => onSectionChange(item.section)}
                            tooltip={item.label}
                            className="h-9 font-normal"
                          >
                            <item.icon
                              className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                            />
                            <span className="truncate">{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroup>
              </div>
            ))}
          </SidebarContent>

          {/* Footer */}
          <SidebarFooter className="p-3 border-t">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8 border shrink-0">
                    <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate leading-none">
                        {user?.name || "-"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {user?.email || "-"}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* Resize handle */}
        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors"
            onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
            style={{ zIndex: 50 }}
          />
        )}
      </div>

      <SidebarInset className="bg-muted/20 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <span className="text-sm font-medium text-foreground">
                {activeItem?.label ?? "Dashboard"}
              </span>
            </div>
          </div>
        )}

        {/* Page title bar */}
        {!isMobile && (
          <div className="flex items-center gap-3 border-b h-14 px-6 bg-background/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            {activeItem && (
              <>
                <activeItem.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">
                  {activeItem.label}
                </span>
              </>
            )}
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </SidebarInset>
    </>
  );
}