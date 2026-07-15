import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { GraduationCap, MessageSquare, LayoutDashboard, LogOut, Play, Bell, CreditCard, Settings, User, Calendar, Menu, X, ChevronDown, Star, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";
import VideoModal from "@/components/VideoModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/NotificationBell";
import {
  COURSE_CATEGORIES,
  CATEGORY_COURSE_TITLES,
  TEST_PREP_GROUPS,
  STARRED_CATEGORIES,
  getTestPrepGroupTitles,
  type CourseCategory,
  type TestPrepGroup,
} from "@/lib/courseCategory";

const GRADE_LEVELS = [
  "Elementary (K-5)",
  "Middle School (6-8)",
  "High School (9-12)",
  "College",
  "Adult",
];

// Mega menu shows every board/program except Test Prep (which gets its
// own dedicated, starred section up top). Used for all regions.
const BOARD_CATEGORIES = COURSE_CATEGORIES.filter((cat) => cat !== "Test Prep");

type HoveredItem =
  | { kind: "testprep"; group: TestPrepGroup }
  | { kind: "category"; cat: CourseCategory }
  | null;

function StarBadge() {
  return <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />;
}

export default function Navigation() {
  const { user, isAuthenticated, loading } = useAuth();
  const role: "parent" | "tutor" | "admin" | "coordinator" | null = user?.role ?? null;
  const [location] = useLocation();
  const [isVideoModalOpen, setIsVideoModalOpen] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(true);
  const [lastScrollY, setLastScrollY] = React.useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [coursesMenuOpen, setCoursesMenuOpen] = React.useState(false);
  const [mobileCoursesOpen, setMobileCoursesOpen] = React.useState(false);
  const [hoveredItem, setHoveredItem] = React.useState<HoveredItem>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailPaneRef = React.useRef<HTMLDivElement | null>(null);
  const logoutMutation = trpc.auth.logout.useMutation();

  // Fetch tutor profile for avatar photo (tutors only)
  const { data: tutorProfile } = trpc.tutorProfile.getMy.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "tutor",
    staleTime: 60_000,
  });
  const avatarImageUrl = user?.role === "tutor" ? (tutorProfile?.profileImageUrl ?? null) : null;

  const openCoursesMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setCoursesMenuOpen(true);
  };
  const scheduleCloseCoursesMenu = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      setCoursesMenuOpen(false);
      setHoveredItem(null);
    }, 150);
  };
  const closeMenusAnd = (fn?: () => void) => () => {
    setCoursesMenuOpen(false);
    setHoveredItem(null);
    fn?.();
  };

  // Scroll behavior for show/hide navbar
  React.useEffect(() => {
    const controlNavbar = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY || currentScrollY < 10) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      }
      setLastScrollY(currentScrollY);
    };
    window.addEventListener('scroll', controlNavbar, { passive: true });
    return () => { window.removeEventListener('scroll', controlNavbar); };
  }, [lastScrollY]);

  // FIX: while the mega menu is open, lock the page's own scroll so a wheel
  // scroll over the menu's columns doesn't bubble up and scroll the whole
  // page behind it (which left the menu looking disconnected/floating).
  React.useEffect(() => {
    if (coursesMenuOpen) {
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
  }, [coursesMenuOpen]);

  // FIX: reset the detail pane's scroll position whenever the hovered item
  // changes, otherwise it keeps the previous scroll offset and opens with
  // its top content cut off (visible bug in the mega menu).
  React.useEffect(() => {
    if (detailPaneRef.current) {
      detailPaneRef.current.scrollTop = 0;
    }
  }, [hoveredItem]);

  const { data: unreadData } = trpc.messaging.getUnreadMessageCount.useQuery(
    undefined,
    {
      enabled: isAuthenticated && (role === "parent" || role === "tutor" || role === "coordinator"),
      refetchOnWindowFocus: true,
      refetchInterval: 15_000,
    }
  );
  const unreadCount = unreadData?.count ?? 0;

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/";
  };

  const getDashboardLink = () => {
    if (role === "admin") return "/admin/dashboard";
    if (role === "tutor") return "/tutor/dashboard";
    if (role === "parent") return "/parent/dashboard";
    if (role === "coordinator") return "/coordinator/dashboard";
    return "/";
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const publicPages = ["/", "/tutors", "/courses", "/tutor-registration", "/about", "/contact", "/privacy-policy", "/blog"];
  const isPublicPage = publicPages.some(page => location === page || (page === "/" && location === "/")) || location.startsWith("/blog");
  const isAuthPage = location.startsWith(LOGIN_PATH) || location.startsWith("/signup");

  if (isAuthPage) return null;
  if (!isAuthenticated && !isPublicPage && !loading) return null;

  // ── Detail pane content for whatever is currently hovered ──────────────
  const detailPane = (() => {
    if (!hoveredItem) {
      return (
        <div className="h-full flex items-center justify-center text-center px-4">
          <p className="text-xs text-muted-foreground">
            Hover an exam or board to see the courses under it
          </p>
        </div>
      );
    }
    if (hoveredItem.kind === "testprep") {
      const titles = getTestPrepGroupTitles(hoveredItem.group);
      return (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            {hoveredItem.group === "SAT/ACT" && <StarBadge />}
            {hoveredItem.group}
          </p>
          <div className="flex flex-col gap-0.5">
            {titles.map((title) => (
              <Link
                key={title}
                href={`/courses?category=Test%20Prep&search=${encodeURIComponent(title)}`}
                onClick={closeMenusAnd()}
                className="text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 rounded-md px-2 py-1 transition-colors"
              >
                {title}
              </Link>
            ))}
          </div>
        </div>
      );
    }
    const cat = hoveredItem.cat;
    const titles = CATEGORY_COURSE_TITLES[cat] ?? [];
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
          {STARRED_CATEGORIES.includes(cat) && <StarBadge />}
          {cat}
        </p>
        <div className="flex flex-col gap-0.5">
          {titles.map((title) => (
            <Link
              key={title}
              href={`/courses?category=${encodeURIComponent(cat)}&search=${encodeURIComponent(title)}`}
              onClick={closeMenusAnd()}
              className="text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 rounded-md px-2 py-1 transition-colors"
            >
              {title}
            </Link>
          ))}
        </div>
      </div>
    );
  })();

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="mx-4 mt-4">
        <div
          className="container mx-auto rounded-2xl border border-primary/25 bg-gradient-to-r from-white/92 via-primary/8 to-white/92
                     dark:from-slate-900/90 dark:via-primary/15 dark:to-slate-900/90
                     backdrop-blur-lg shadow-xl shadow-primary/10"
        >
          <div className="flex items-center justify-between h-16 px-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary hover:text-primary/80 transition-colors">
              <img src="/images/Edkonnect_legacy_image.jpg" alt="EdKonnect" className="h-8 w-auto" />
              <span>EdKonnect Academy</span>
            </Link>

            {/* Navigation Links */}
            <div className="hidden lg:flex items-center gap-6">
              {role === "coordinator" ? (
                <Link href={getDashboardLink()} className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                  location.includes("/dashboard") ? "text-primary" : "text-muted-foreground"
                }`}>
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/tutors" className={`text-sm font-medium transition-colors hover:text-primary ${
                    location === "/tutors" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    Find Tutors
                  </Link>

                  {/* Browse Courses mega menu */}
                  <div
                    className="relative"
                    onMouseEnter={openCoursesMenu}
                    onMouseLeave={scheduleCloseCoursesMenu}
                  >
                    <Link
                      href="/courses"
                      className={`flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary ${
                        location === "/courses" ? "text-primary" : "text-muted-foreground"
                      }`}
                      onClick={closeMenusAnd()}
                    >
                      Browse Courses
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${coursesMenuOpen ? "rotate-180" : ""}`} />
                    </Link>

                    {coursesMenuOpen && (
                      <div
                        className="absolute left-1/2 top-full -translate-x-1/2 pt-3 w-[800px]"
                        onMouseEnter={openCoursesMenu}
                        onMouseLeave={scheduleCloseCoursesMenu}
                      >
                        <div className="rounded-xl border border-border bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-hidden">
                          {/* ── Unified: nav list (Test Prep → Board) | detail pane | Grade Level ── */}
                          <div className="flex gap-6 items-stretch">
                            {/* Column A: unified nav list */}
                            <div className="w-56 shrink-0 max-h-[26rem] overflow-y-auto pr-1">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                                <StarBadge /> Test Prep
                              </p>
                              <div className="flex flex-col gap-0.5">
                                {TEST_PREP_GROUPS.map((group) => (
                                  <Link
                                    key={group}
                                    href={`/courses?category=Test%20Prep&testPrepGroup=${encodeURIComponent(group)}`}
                                    onClick={closeMenusAnd()}
                                    onMouseEnter={() => setHoveredItem({ kind: "testprep", group })}
                                    className={`flex items-center justify-between gap-1 text-sm rounded-md px-2 py-1.5 transition-colors ${
                                      hoveredItem?.kind === "testprep" && hoveredItem.group === group
                                        ? "text-primary bg-primary/5"
                                        : "text-foreground/80 hover:text-primary hover:bg-primary/5"
                                    }`}
                                  >
                                    <span className="flex items-center gap-1.5">
                                      {group === "SAT/ACT" && <StarBadge />}
                                      {group}
                                    </span>
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                  </Link>
                                ))}
                              </div>
                              

                              <div className="h-px bg-border mb-4" />

                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                Browse by Board / Program
                              </p>
                              <div className="flex flex-col gap-0.5">
                                {BOARD_CATEGORIES.map((cat) => {
                                  const hasCourses = (CATEGORY_COURSE_TITLES[cat] ?? []).length > 0;
                                  const starred = STARRED_CATEGORIES.includes(cat);
                                  const active = hoveredItem?.kind === "category" && hoveredItem.cat === cat;
                                  return (
                                    <Link
                                      key={cat}
                                      href={`/courses?category=${encodeURIComponent(cat)}`}
                                      onClick={closeMenusAnd()}
                                      onMouseEnter={() => setHoveredItem({ kind: "category", cat })}
                                      className={`flex items-center justify-between gap-1 text-sm rounded-md px-2 py-1.5 transition-colors ${
                                        active ? "text-primary bg-primary/5" : "text-foreground/80 hover:text-primary hover:bg-primary/5"
                                      }`}
                                    >
                                      <span className="flex items-center gap-1.5">
                                        {starred && <StarBadge />}
                                        {cat}
                                      </span>
                                      {hasCourses && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Separator */}
                            <div className="w-px bg-border shrink-0" />

                            {/* Column B: reserved detail pane (no overlap, no absolute positioning) */}
                            <div
                              ref={detailPaneRef}
                              className="w-64 shrink-0 max-h-[26rem] overflow-y-auto"
                            >
                              {detailPane}
                            </div>

                            {/* Separator */}
                            <div className="w-px bg-border shrink-0" />

                            {/* Column C: Grade Level */}
                            <div className="w-40 shrink-0 self-start">
                              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                                By Grade Level
                              </p>
                              <div className="flex flex-col gap-0.5">
                                {GRADE_LEVELS.map((level) => (
                                  <Link
                                    key={level}
                                    href={`/courses?gradeLevel=${encodeURIComponent(level)}`}
                                    onClick={closeMenusAnd()}
                                    className="text-sm text-foreground/80 hover:text-primary hover:bg-primary/5 rounded-md px-2 py-1.5 transition-colors"
                                  >
                                    {level}
                                  </Link>
                                ))}
                              </div>
                              <Link
                                href="/courses"
                                onClick={closeMenusAnd()}
                                className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
                              >
                                View all courses →
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {role !== "tutor" && (
                    <Link href="/tutor-registration" className={`text-sm font-medium transition-colors hover:text-primary ${
                      location === "/tutor-registration" ? "text-primary" : "text-muted-foreground"
                    }`}>
                      Become a Tutor
                    </Link>
                  )}

                  {isAuthenticated && (
                    <>
                      <Link href={getDashboardLink()} className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                        location.includes("/dashboard") ? "text-primary" : "text-muted-foreground"
                      }`}>
                        <LayoutDashboard className="w-4 h-4" />
                        Dashboard
                      </Link>

                      <Link href={role === ('coordinator' as typeof role) ? '/coordinator/messages' : '/messages'} className={`flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary ${
                        (role === ('coordinator' as typeof role) ? location === "/coordinator/messages" : location === "/messages") ? "text-primary" : "text-muted-foreground"
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

                  <Link href="/blog" className={`text-sm font-medium transition-colors hover:text-primary ${
                    location.startsWith("/blog") ? "text-primary" : "text-muted-foreground"
                  }`}>
                    Blog
                  </Link>

                  <Link href="/about" className={`text-sm font-medium transition-colors hover:text-primary ${
                    location === "/about" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    About
                  </Link>

                  <Link href="/contact" className={`text-sm font-medium transition-colors hover:text-primary ${
                    location === "/contact" ? "text-primary" : "text-muted-foreground"
                  }`}>
                    Contact Us
                  </Link>
                </>
              )}
            </div>

            {/* Auth Section */}
            <div className="flex items-center gap-2 lg:gap-4">
              {loading ? (
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
              ) : isAuthenticated && user ? (
                <>
                  <NotificationBell />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="relative h-10 w-10 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <Avatar>
                          {avatarImageUrl && (
                            <AvatarImage src={avatarImageUrl} alt={user.name ?? "Profile photo"} />
                          )}
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
                        <p className="text-xs text-muted-foreground capitalize">{user.role} Account</p>
                      </div>
                      <DropdownMenuSeparator />
                      {user.role !== 'admin' && (
                        <DropdownMenuItem asChild>
                          <Link href={getDashboardLink()} className="flex items-center w-full cursor-pointer">
                            <LayoutDashboard className="w-4 h-4 mr-2" />
                            Dashboard
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link href={user.role === 'coordinator' ? '/coordinator/messages' : '/messages'} className="flex items-center w-full cursor-pointer">
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
                      {user.role !== 'admin' && (
                        <DropdownMenuItem asChild>
                          <Link href="/settings" className="flex items-center w-full cursor-pointer">
                            <Settings className="w-4 h-4 mr-2" />
                            Settings
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
                            <Link href="/tutor/profile" className="flex items-center w-full cursor-pointer">
                              <User className="w-4 h-4 mr-2" />
                              Profile
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href="/tutor/availability" className="flex items-center w-full cursor-pointer">
                              <Calendar className="w-4 h-4 mr-2" />
                              Availability
                            </Link>
                          </DropdownMenuItem>
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
              <button
                className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
                onClick={() => setMobileMenuOpen(prev => !prev)}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-border px-6 py-4 flex flex-col gap-3">
              {role === "coordinator" ? (
                <Link href={getDashboardLink()} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-sm font-medium py-2 hover:text-primary transition-colors">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
              ) : (
                <>
                  <Link href="/tutors" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium py-2 hover:text-primary transition-colors">Find Tutors</Link>

                  {/* Browse Courses collapsible (mobile) */}
                  <div>
                    <div className="flex items-center justify-between py-2">
                      <Link href="/courses" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium hover:text-primary transition-colors">
                        Browse Courses
                      </Link>
                      <button onClick={() => setMobileCoursesOpen(p => !p)}>
                        <ChevronDown className={`w-4 h-4 transition-transform ${mobileCoursesOpen ? "rotate-180" : ""}`} />
                      </button>
                    </div>

                    {mobileCoursesOpen && (
                      <div className="pl-3 border-l border-border ml-1 mb-2 flex flex-col gap-2">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                            <StarBadge /> Test Prep
                          </p>
                          <div className="flex flex-col gap-0.5">
                            {TEST_PREP_GROUPS.map((group) => (
                              <Link
                                key={group}
                                href={`/courses?category=Test%20Prep&testPrepGroup=${encodeURIComponent(group)}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors py-1 flex items-center gap-1.5"
                              >
                                {group === "SAT/ACT" && <StarBadge />}
                                {group}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-border pt-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Board / Program</p>
                          <div className="flex flex-col gap-0.5">
                            {BOARD_CATEGORIES.map((cat) => (
                              <Link
                                key={cat}
                                href={`/courses?category=${encodeURIComponent(cat)}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors py-1 flex items-center gap-1.5"
                              >
                                {STARRED_CATEGORIES.includes(cat) && <StarBadge />}
                                {cat}
                              </Link>
                            ))}
                          </div>
                        </div>
                        <div className="border-t border-border pt-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Grade Level</p>
                          <div className="flex flex-col gap-0.5">
                            {GRADE_LEVELS.map((level) => (
                              <Link
                                key={level}
                                href={`/courses?gradeLevel=${encodeURIComponent(level)}`}
                                onClick={() => setMobileMenuOpen(false)}
                                className="text-sm text-muted-foreground hover:text-primary transition-colors py-1"
                              >
                                {level}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {role !== "tutor" && (
                    <Link href="/tutor-registration" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium py-2 hover:text-primary transition-colors">Become a Tutor</Link>
                  )}
                  <button
                    onClick={() => { setIsVideoModalOpen(true); setMobileMenuOpen(false); }}
                    className="flex items-center gap-2 text-sm font-medium py-2 hover:text-primary transition-colors text-left"
                  >
                    <Play className="w-4 h-4" /> What's EdKonnect
                  </button>
                  {isAuthenticated && (
                    <>
                      <Link href={getDashboardLink()} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-sm font-medium py-2 hover:text-primary transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Dashboard
                      </Link>
                      <Link href={role === ('coordinator' as typeof role) ? '/coordinator/messages' : '/messages'} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 text-sm font-medium py-2 hover:text-primary transition-colors">
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
                </>
              )}
              {!isAuthenticated && !loading && (
                <a href={LOGIN_PATH} className="text-sm font-medium py-2 hover:text-primary transition-colors">Sign In</a>
              )}
            </div>
          )}
        </div>
        <VideoModal open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen} />
      </div>
    </nav>
  );
}