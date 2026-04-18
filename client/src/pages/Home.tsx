import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useFormatPrice } from "@/hooks/useFormatPrice";
import { useIsIndianUser } from "@/hooks/useIsIndianUser";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Link, useLocation } from "wouter";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Calendar,
  MessageSquare,
  CreditCard,
  Search,
  Star,
  Users,
  BookOpen,
  TrendingUp,
  Calculator,
  Shapes,
  Triangle,
  Code,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Gift,
  Share2,
  UserPlus,
  CheckCircle,
  Mail,
  User,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { motion, type Variants } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { StatNumber } from "@/components/motion-primitives/StatNumber";

// Icon mapping for featured courses
const iconMap: Record<string, React.ComponentType<any>> = {
  TrendingUp,
  Calculator,
  Shapes,
  Triangle,
  Code,
};

const features = [
  {
    icon: Users,
    title: "Find Perfect Matches",
    description:
      "Search and filter through qualified tutors by subject, grade level, availability, and pricing to find the perfect fit for your child's needs.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Book tutoring sessions with an intuitive calendar interface. View availability, schedule recurring sessions, and receive automatic reminders.",
  },
  {
    icon: MessageSquare,
    title: "In-App Messaging",
    description:
      "Communicate directly with tutors through our secure messaging platform. Discuss progress, share resources, and coordinate schedules.",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description:
      "Subscribe to courses or pay per session with confidence. Integrated Stripe payment processing ensures secure transactions.",
  },
  {
    icon: BookOpen,
    title: "Progress Tracking",
    description:
      "Monitor learning progress with session history, tutor feedback, and performance notes. Stay informed about your child's development.",
  },
  {
    icon: Star,
    title: "Ratings & Reviews",
    description:
      "Make informed decisions with tutor ratings and reviews from other parents. Share your own experiences to help the community.",
  },
];

const scrollReveal = {
  initial: { opacity: 0, y: 36 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0 },
  transition: { type: "spring", stiffness: 55, damping: 18, mass: 0.8 },
} as const;

const cardContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardChild: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 65, damping: 18 } },
};

const listItemReveal: Variants = {
  hidden: { opacity: 0, x: -28 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 70, damping: 18, delay: i * 0.1 },
  }),
};

const faqBulletPattern = /^\s*[-*•]\s+(.+)$/;

function renderFaqAnswer(answer: string) {
  const blocks: Array<
    | { type: "paragraph"; lines: string[] }
    | { type: "list"; items: string[] }
  > = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({ type: "paragraph", lines: paragraphLines });
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push({ type: "list", items: listItems });
    listItems = [];
  };

  for (const rawLine of answer.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      continue;
    }

    const bulletMatch = trimmedLine.match(faqBulletPattern);
    if (bulletMatch) {
      flushParagraph();
      listItems.push(bulletMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(trimmedLine);
  }

  flushParagraph();
  flushList();

  return blocks.map((block, blockIndex) => {
    if (block.type === "list") {
      return (
        <ul key={`faq-list-${blockIndex}`} className="list-disc space-y-2 pl-6 marker:text-foreground/70">
          {block.items.map((item, itemIndex) => (
            <li key={`faq-list-item-${blockIndex}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
    }

    return block.lines.map((line, lineIndex) => (
      <p key={`faq-paragraph-${blockIndex}-${lineIndex}`}>{line}</p>
    ));
  });
}

export default function Home() {
  const { isAuthenticated, user } = useAuth();
  const formatPrice = useFormatPrice();
  const [, setLocation] = useLocation();

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start" });

  const autoScrollDelay = 6000;
  const autoScrollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const resetAutoScroll = React.useCallback(() => {
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    autoScrollRef.current = setInterval(() => emblaApi?.scrollNext(), autoScrollDelay);
  }, [emblaApi]);

  React.useEffect(() => {
    if (!emblaApi) return;
    resetAutoScroll();
    return () => {
      if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    };
  }, [emblaApi, resetAutoScroll]);

  const scrollPrev = React.useCallback(() => {
    emblaApi?.scrollPrev();
    resetAutoScroll();
  }, [emblaApi, resetAutoScroll]);

  const scrollNext = React.useCallback(() => {
    emblaApi?.scrollNext();
    resetAutoScroll();
  }, [emblaApi, resetAutoScroll]);

  const [testimonialRef, testimonialApi] = useEmblaCarousel({ loop: true, align: "start", slidesToScroll: 1 });
  const testimonialPrev = React.useCallback(() => testimonialApi?.scrollPrev(), [testimonialApi]);
  const testimonialNext = React.useCallback(() => testimonialApi?.scrollNext(), [testimonialApi]);

  const [activeTestimonialModal, setActiveTestimonialModal] = useState<number | null>(null);

  const isIndian = useIsIndianUser();
  const exchangeRate = useExchangeRate();

  // Convert a stat value string like "$2,000" to compact INR for Indian users
  // e.g. $2,000 → ₹1.88L, $500 → ₹42K
  const localizeStatValue = (value: string) => {
    if (!isIndian) return value;
    const m = value.trim().match(/^\$\s*([\d,]+)(\+?)$/);
    if (!m) return value;
    const usd = parseFloat(m[1].replace(/,/g, ""));
    if (isNaN(usd)) return value;
    const inr = Math.round(usd * exchangeRate);
    const tail = m[2]; // "+" or ""
    if (inr >= 10_00_000) {
      // Crore
      const cr = inr / 10_00_000;
      return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr${tail}`;
    } else if (inr >= 1_00_000) {
      // Lakh
      const l = inr / 1_00_000;
      return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(2)}L${tail}`;
    } else if (inr >= 1_000) {
      // Thousand
      const k = inr / 1_000;
      return `₹${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K${tail}`;
    }
    return `₹${inr}${tail}`;
  };

  // Fetch home page data from database
  const { data: stats = [] } = trpc.home.stats.useQuery();
  const { data: featuredCoursesData = [] } = trpc.home.featuredCourses.useQuery();
  const { data: testimonialsData = [] } = trpc.home.testimonials.useQuery();
  const { data: faqsData = [] } = trpc.home.faqs.useQuery();
  const { data: blogPostsData = [], isLoading: blogPostsLoading } = trpc.home.blogPosts.useQuery({ limit: 20 });
  const [selectedBlogSlug, setSelectedBlogSlug] = useState<string | null>(null);
  const { data: selectedBlogPost } = trpc.home.blogPost.useQuery(
    { slug: selectedBlogSlug! },
    { enabled: !!selectedBlogSlug }
  );
  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Fetch all tutors and courses for instant search
  const { data: allTutors = [] } = trpc.tutorProfile.list.useQuery();
  const { data: allCourses = [] } = trpc.course.list.useQuery({});

  // Derived search results from local data
  const searchQuery = heroSearchQuery.trim().toLowerCase();
  const matchedTutors = searchQuery.length >= 2
    ? allTutors.filter((t: any) =>
        t.userName?.toLowerCase().includes(searchQuery) ||
        (typeof t.subjects === "string" ? t.subjects : JSON.stringify(t.subjects ?? ""))
          .toLowerCase().includes(searchQuery)
      ).slice(0, 4)
    : [];
  const matchedCourses = searchQuery.length >= 2
    ? allCourses
        .filter((c: any) =>
          c.title?.toLowerCase().includes(searchQuery) ||
          c.subject?.toLowerCase().includes(searchQuery) ||
          c.description?.toLowerCase().includes(searchQuery)
        )
        .sort((a: any, b: any) => {
          const aTitle = a.title?.toLowerCase() ?? "";
          const bTitle = b.title?.toLowerCase() ?? "";
          const aStarts = aTitle.startsWith(searchQuery) ? 0 : aTitle.includes(searchQuery) ? 1 : 2;
          const bStarts = bTitle.startsWith(searchQuery) ? 0 : bTitle.includes(searchQuery) ? 1 : 2;
          return aStarts - bStarts;
        })
        .slice(0, 4)
    : [];
  const hasResults = matchedTutors.length > 0 || matchedCourses.length > 0;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Referral state
  const [referralDialogOpen, setReferralDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [emailCheckResult, setEmailCheckResult] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const sendInviteMutation = trpc.referral.sendInvite.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setReferralDialogOpen(false);
      setInviteEmail("");
      setEmailCheckResult(null);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const checkEmailMutation = trpc.referral.checkEmail.useQuery(
    { email: inviteEmail },
    { enabled: false }
  );

  const handleCheckAndSendInvite = async () => {
    if (!inviteEmail) return;
    setIsCheckingEmail(true);
    try {
      const result = await checkEmailMutation.refetch();
      const check = result.data;
      if (!check) { setIsCheckingEmail(false); return; }
      setEmailCheckResult(check);
      if (check.available) {
        sendInviteMutation.mutate({ email: inviteEmail });
      }
    } catch {
      toast.error("Failed to check email. Please try again.");
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const learningFeatures = [
    {
      icon: Users,
      title: "Easy Enrollment",
      description:
        "Sign up in minutes and start browsing qualified tutors. Simple course enrollment with secure Stripe payment processing makes getting started effortless.",
    },
    {
      icon: Users,
      title: "Multi-Student Management",
      description:
        "Manage courses and sessions for multiple children from a single parent account. Track each student's progress individually with dedicated dashboards.",
    },
    {
      icon: LayoutDashboard,
      title: "Comprehensive Dashboard",
      description:
        "Intuitive dashboard to manage all your courses, view upcoming sessions, schedule new tutoring sessions, and communicate with tutors through in-app messaging.",
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking & Reports",
      description:
        "Monitor learning progress with detailed session history, tutor feedback, and performance metrics. Stay informed about your child's academic development.",
    },
  ];

  const animatedTestimonials = (testimonialsData ?? []).map((t) => ({
    quote: t.content,
    name: t.parentName,
    designation: t.parentRole ?? "Parent",
    initials: t.parentInitials,
    rating: t.rating ?? 5,
    src: t.parentImage ?? undefined,
  }));

  const getDashboardLink = () => {
    if (user?.role === "admin") return "/admin/dashboard";
    if (user?.role === "tutor") return "/tutor/dashboard";
    if (user?.role === "parent") return "/parent/dashboard";
    if (user?.role === "coordinator") return "/coordinator/dashboard";
    return "/role-selection";
  };

  const handleHeroSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchDropdownOpen(false);
    const query = heroSearchQuery.trim();
    if (!query) { setLocation("/tutors"); return; }
    // If exactly one tutor matched, go directly to their profile
    if (matchedTutors.length === 1 && matchedCourses.length === 0) {
      setLocation(`/tutor-profile/${(matchedTutors[0] as any).userId}`);
      return;
    }
    // If exactly one course matched, go directly to that course
    if (matchedCourses.length === 1 && matchedTutors.length === 0) {
      setLocation(`/course/${(matchedCourses[0] as any).id}`);
      return;
    }
    // Otherwise go to tutor listing with query
    setLocation(`/tutors?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/70 mt-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-16 top-0 h-64 w-64 rounded-full bg-blue-200/30 blur-3xl" />
          <div className="absolute right-0 top-20 h-80 w-80 rounded-full bg-sky-200/20 blur-3xl" />
        </div>

        <div className="container relative pt-8 pb-16 sm:pt-10 sm:pb-20 lg:pt-12 lg:pb-28">
          {/* Search bar — full width at the top */}
          <form onSubmit={handleHeroSearch} className="mb-10 w-full">
            <label htmlFor="hero-search" className="sr-only">
              Search by subject, grade, or need
            </label>

            <div ref={searchContainerRef} className="relative">
              {/* Search pill */}
              <div className="group flex items-center rounded-full border border-slate-200 bg-white pl-5 pr-2 py-2 shadow-[0_8px_40px_-12px_rgba(37,99,235,0.18)] ring-1 ring-transparent transition-all duration-200 focus-within:border-blue-400 focus-within:ring-blue-200 focus-within:shadow-[0_8px_48px_-10px_rgba(37,99,235,0.32)] hover:border-blue-300 hover:shadow-[0_8px_44px_-10px_rgba(37,99,235,0.24)]">
                <Search className="mr-3 h-5 w-5 shrink-0 text-slate-400 transition-colors duration-200 group-focus-within:text-blue-500" />
                <Input
                  id="hero-search"
                  type="text"
                  autoComplete="off"
                  value={heroSearchQuery}
                  onChange={(e) => {
                    setHeroSearchQuery(e.target.value);
                    setSearchDropdownOpen(e.target.value.trim().length >= 2);
                  }}
                  onFocus={() => { if (heroSearchQuery.trim().length >= 2) setSearchDropdownOpen(true); }}
                  placeholder="Search tutors or subjects..."
                  className="h-10 flex-1 border-0 bg-transparent p-0 text-base text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-0"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="ml-3 flex h-10 items-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.6)] transition-all duration-200 hover:bg-blue-700 hover:shadow-[0_6px_18px_-4px_rgba(37,99,235,0.7)] active:scale-95"
                >
                  <Search className="h-4 w-4" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>

              {/* Live dropdown */}
              {searchDropdownOpen && hasResults && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_-12px_rgba(15,23,42,0.22)]">
                  {matchedTutors.length > 0 && (
                    <div>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Tutors</p>
                      {matchedTutors.map((tutor: any) => (
                        <button
                          key={tutor.userId}
                          type="button"
                          onMouseDown={() => {
                            setSearchDropdownOpen(false);
                            setLocation(`/tutor-profile/${tutor.userId}`);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                            {tutor.profileImageUrl
                              ? <img src={tutor.profileImageUrl} alt={tutor.userName} className="h-8 w-8 rounded-full object-cover" />
                              : <User className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{tutor.userName}</p>
                            <p className="truncate text-xs text-slate-500">
                              {typeof tutor.subjects === "string"
                                ? JSON.parse(tutor.subjects || "[]").slice(0, 3).join(", ")
                                : (tutor.subjects ?? []).slice(0, 3).join(", ")}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {matchedCourses.length > 0 && (
                    <div className={matchedTutors.length > 0 ? "border-t border-slate-100" : ""}>
                      <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Courses</p>
                      {matchedCourses.map((course: any) => (
                        <button
                          key={course.id}
                          type="button"
                          onMouseDown={() => {
                            setSearchDropdownOpen(false);
                            setLocation(`/course/${course.id}`);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                            <BookOpen className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{course.title}</p>
                            <p className="truncate text-xs text-slate-500">{course.subject}{course.gradeLevel ? ` · ${course.gradeLevel}` : ""}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-slate-100 px-4 py-2.5">
                    <button type="submit" className="text-xs font-medium text-blue-600 hover:underline">
                      See all results for "{heroSearchQuery.trim()}"
                    </button>
                  </div>
                </div>
              )}

              {/* No results hint */}
              {searchDropdownOpen && !hasResults && searchQuery.length >= 2 && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-center shadow-[0_16px_48px_-12px_rgba(15,23,42,0.22)]">
                  <p className="text-sm text-slate-500">No tutors or courses found for <span className="font-semibold text-slate-700">"{heroSearchQuery.trim()}"</span></p>
                  <button type="submit" className="mt-1 text-xs font-medium text-blue-600 hover:underline">Browse all tutors</button>
                </div>
              )}
            </div>
          </form>

          {/* Heading + image side by side */}
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:gap-20">
            <div className="max-w-[39rem]">
              <h1 className="max-w-[34rem]">
                <span className="block text-xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Connect with expert tutors for
                </span>
                <span className="block text-4xl font-extrabold tracking-tight text-primary sm:text-3xl lg:text-[3.25rem] lg:leading-[1.1]">
                  Academic Excellence & Rigorous Test Prep
                </span>
              </h1>

              <p className="mt-5 max-w-[32rem] text-base leading-7 text-slate-600 sm:text-lg">
                Real human tutors powered by smart AI provide personalized, one-on-one learning through zoom that fits your schedule and convenience.
              </p>

              <div className="mt-6 flex items-center gap-3 text-sm font-medium text-slate-600 sm:text-base">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-50 text-amber-500 ring-1 ring-amber-200/70">
                  <Star className="h-4 w-4 fill-current" />
                </span>
                <span>Rated by parents {"\u2022"} 100K+ sessions completed</span>
              </div>

              {!isAuthenticated && (
                <div className="mt-7 flex items-center gap-4">
                  <Link href="/signup">
                    <button className="flex h-11 items-center gap-2 rounded-full bg-blue-600 px-7 text-sm font-semibold text-white shadow-[0_4px_14px_-4px_rgba(37,99,235,0.6)] transition-all duration-200 hover:bg-blue-700 hover:shadow-[0_6px_18px_-4px_rgba(37,99,235,0.7)] active:scale-95">
                      Get Started Free
                    </button>
                  </Link>
                  <Link href="/login">
                    <button className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-7 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-blue-300 hover:text-blue-600 active:scale-95">
                      Sign In
                    </button>
                  </Link>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-x-8 inset-y-12 rounded-[2.75rem] bg-gradient-to-br from-blue-200/45 via-sky-100/30 to-white blur-3xl" />

              <div className="relative mx-auto max-w-xl rounded-[2rem] border border-slate-200/80 bg-white/80 p-3 shadow-[0_34px_90px_-42px_rgba(15,23,42,0.45)] backdrop-blur-sm">
                <div className="relative overflow-hidden rounded-[1.5rem] bg-slate-200">
                  <img
                    src="/images/Hero-Image.jpg"
                    alt="Tutor supporting a student during a one-on-one learning session"
                    className="h-[340px] w-full object-cover sm:h-[430px] lg:h-[520px]"
                    loading="eager"
                    fetchPriority="high"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/10 via-transparent to-white/10" />
                  <div className="absolute bottom-5 left-5 hidden max-w-[400px] items-start gap-3 rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-[0_24px_55px_-30px_rgba(15,23,42,0.45)] sm:flex">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-900">✦ AI-Powered Session Management</p>
                        <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-600">New</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-700">
                        Smart AI-powered session management provides complete transparency on session details and a holistic view of the students progress.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Features Section */}
      <motion.section className="py-20 bg-muted/30" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything You Need for Successful Tutoring</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A comprehensive platform designed to make tutoring simple, effective, and enjoyable for both parents and tutors.
            </p>
          </div>

          <div className="relative">
            <div className="flex justify-end gap-3 mb-4">
              <Button variant="outline" size="icon" onClick={scrollPrev} aria-label="Previous feature">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={scrollNext} aria-label="Next feature">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex -mx-3">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  const isAccent = index % 2 === 1;

                  return (
                    <div
                      key={feature.title}
                      className="px-3 flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
                    >
                      <Card className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-elegant h-full">
                        <CardContent className="pt-6 h-full flex flex-col">
                          <div
                            className={`w-12 h-12 rounded-lg ${
                              isAccent ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                            } flex items-center justify-center mb-4`}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground flex-1">{feature.description}</p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Traction Statistics Section (animated numbers + keep new description field) */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Trusted by Thousands</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join a thriving community of learners and educators achieving remarkable results.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat) => (
              <Card key={stat.id} className="text-center p-8 hover:shadow-elegant transition-all duration-600 border-border/50">
                <CardContent className="p-0">
                  <StatNumber value={localizeStatValue(stat.value)} />
                  <div className="text-sm lg:text-base text-muted-foreground font-medium">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Courses Section */}
      <section className="py-20 bg-muted/30">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Popular Courses</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore our most sought-after courses with expert tutors ready to help you succeed.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCoursesData.map((course, index) => {
              const IconComponent = course.icon ? iconMap[course.icon] : TrendingUp;
              const isAccent = index % 2 === 1;

              return (
                <Card key={course.id} className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-elegant group h-full">
                  <CardContent className="pt-6">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${
                        isAccent ? "from-accent/20 to-accent/10" : "from-primary/20 to-primary/10"
                      } flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <IconComponent className={`w-7 h-7 ${isAccent ? "text-accent" : "text-primary"}`} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{course.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{course.description}</p>
                    <div className="flex items-center justify-end pt-4 border-t border-border">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xs text-muted-foreground font-normal">from</span>
                        <span className="text-lg font-bold text-primary">{formatPrice(course.priceFrom, "/hr")}</span>
                      </div>
                    </div>
                    <Button asChild className="w-full mt-4" variant="outline">
                      <Link href={`/courses?search=${encodeURIComponent(course.title.replace(/\b(tutoring|coding|prep|course|class|lessons?)\b/gi, "").trim())}`}>View Details</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Button asChild size="lg">
              <Link href="/courses">View All Courses</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <motion.section className="py-16 bg-gradient-to-br from-primary/5 via-accent/5 to-background" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-2">What Parents Are Saying</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Hear from families who have transformed their children's learning experience with EdKonnect Academy.
            </p>
          </div>

          {animatedTestimonials.length > 0 ? (
            <div className="relative">
              <div className="flex justify-end gap-3 mb-4">
                <Button variant="outline" size="icon" onClick={testimonialPrev} aria-label="Previous testimonial">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={testimonialNext} aria-label="Next testimonial">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="overflow-hidden" ref={testimonialRef}>
                <div className="flex -mx-3">
                  {animatedTestimonials.map((t, index) => {
                    const clampedRating = Math.max(0, Math.min(5, Number(t.rating ?? 0)));
                    const WORD_LIMIT = 30;
                    const words = t.quote.split(" ");
                    const isTruncatable = words.length > WORD_LIMIT;
                    const visibleQuote = isTruncatable
                      ? words.slice(0, WORD_LIMIT).join(" ") + "…"
                      : t.quote;
                    return (
                      <div key={index} className="px-3 flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]">
                        <Card className="h-full flex flex-col shadow-sm hover:shadow-md transition-shadow">
                          <CardContent className="flex flex-col gap-3 p-5 h-full">
                            {/* Stars */}
                            <div className="flex items-center gap-1">
                              {Array.from({ length: clampedRating }).map((_, i) => (
                                <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                              ))}
                              {clampedRating < 5 && Array.from({ length: 5 - clampedRating }).map((_, i) => (
                                <Star key={`e-${i}`} className="h-3.5 w-3.5 text-muted-foreground/30" />
                              ))}
                            </div>

                            {/* Quote */}
                            <div className="flex-1">
                              <p className="text-sm text-muted-foreground leading-relaxed break-words">
                                "{visibleQuote}"
                              </p>
                              {isTruncatable && (
                                <button
                                  onClick={() => setActiveTestimonialModal(index)}
                                  className="mt-1 text-xs font-medium text-primary hover:underline"
                                >
                                  Show more
                                </button>
                              )}
                            </div>

                            {/* Avatar + Name */}
                            <div className="flex items-center gap-3 pt-2 border-t border-border">
                              {t.src ? (
                                <img
                                  src={t.src}
                                  alt={t.name}
                                  className="h-9 w-9 rounded-full object-cover flex-shrink-0"
                                />
                              ) : (
                                <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                                  {t.initials || "U"}
                                </div>
                              )}
                              <div>
                                <p className="text-base font-bold text-foreground">{t.name}</p>
                                <p className="text-sm font-semibold text-muted-foreground">{t.designation}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">No testimonials yet.</div>
          )}
        </div>

        {/* Testimonial full-review modal */}
        {activeTestimonialModal !== null && (() => {
          const t = animatedTestimonials[activeTestimonialModal];
          const clampedRating = Math.max(0, Math.min(5, Number(t.rating ?? 0)));
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setActiveTestimonialModal(null)}
            >
              <div
                className="relative w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setActiveTestimonialModal(null)}
                  aria-label="Close"
                  className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  ✕
                </button>
                <div className="flex items-center gap-3 mb-4">
                  {t.src ? (
                    <img src={t.src} alt={t.name} className="h-11 w-11 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {t.initials || "U"}
                    </div>
                  )}
                  <div>
                    <p className="text-base font-bold text-foreground">{t.name}</p>
                    <p className="text-sm font-semibold text-muted-foreground">{t.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: clampedRating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                  {clampedRating < 5 && Array.from({ length: 5 - clampedRating }).map((_, i) => (
                    <Star key={`e-${i}`} className="h-4 w-4 text-muted-foreground/30" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-7">"{t.quote}"</p>
              </div>
            </div>
          );
        })()}
      </motion.section>

      {/* Features Section */}
      <motion.section className="py-20 bg-gradient-to-br from-primary/5 via-accent/5 to-background" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Powerful Features for Modern Learning</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage tutoring sessions, track progress, and achieve academic success—all in one platform.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Features List */}
            <div className="space-y-8">
              {learningFeatures.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    className="flex gap-4"
                    custom={index}
                    variants={listItemReveal}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Mobile Mockup */}
            <div className="flex justify-center lg:justify-end">
              <img
                src="/images/mobile-mockup.png"
                alt="EdKonnect Academy Mobile App Dashboard"
                className="w-full max-w-md drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* Referral Section */}
      <motion.section className="py-20 bg-gradient-to-br from-primary/10 via-accent/5 to-background" {...scrollReveal}>
        <div className="container max-w-5xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left — Copy */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
                <Gift className="w-4 h-4" />
                Referral Program
              </div>
              <h2 className="text-3xl lg:text-4xl font-bold mb-4">
                Invite a Friend,<br />Both of You Win
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Know someone who'd benefit from EdKonnect? Invite them via email. When they enroll in their first course, <strong>you both receive a discount coupon</strong> (up to $25 off) delivered straight to your inbox.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                {isAuthenticated ? (
                  <Button size="lg" className="gap-2" onClick={() => setReferralDialogOpen(true)}>
                    <Mail className="w-5 h-5" />
                    Invite a Friend
                  </Button>
                ) : (
                  <Link href="/signup">
                    <Button size="lg" className="gap-2">
                      <Mail className="w-5 h-5" />
                      Sign Up to Invite
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Right — How it works */}
            <div className="space-y-4">
              {[
                { icon: Share2, step: "1", title: "You send an invite", desc: "Enter your friend's email — we send them a personalised invitation with your referral link." },
                { icon: UserPlus, step: "2", title: "Friend signs up", desc: "They create an account using your referral link. No coupon yet — the reward comes after enrollment." },
                { icon: BookOpen, step: "3", title: "Friend enrolls in a course", desc: "Once they enroll in their first course, the reward is triggered automatically." },
                { icon: Gift, step: "4", title: "You both get a discount", desc: "A discount coupon (up to $25 off) is emailed to both of you — one-time use, never expires." },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 p-4 rounded-xl bg-background/70 border border-border/50">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{item.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Referral Invite Dialog */}
      <Dialog open={referralDialogOpen} onOpenChange={(open) => {
        setReferralDialogOpen(open);
        if (!open) { setInviteEmail(""); setEmailCheckResult(null); }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              Invite a Friend
            </DialogTitle>
            <DialogDescription>
              Enter your friend's email address. They'll receive an invitation with your referral link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Friend's Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={(e) => { setInviteEmail(e.target.value); setEmailCheckResult(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleCheckAndSendInvite()}
              />
              {emailCheckResult && !emailCheckResult.available && (
                <p className="text-sm text-destructive">{emailCheckResult.reason}</p>
              )}
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                When your friend enrolls in their first course, you'll both receive a <strong>discount coupon</strong> (up to $25 off) via email.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReferralDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={handleCheckAndSendInvite}
                disabled={!inviteEmail || isCheckingEmail || sendInviteMutation.isPending}
              >
                <Mail className="w-4 h-4" />
                {sendInviteMutation.isPending ? "Sending..." : isCheckingEmail ? "Checking..." : "Send Invite"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FAQ Section */}
      <motion.section id="faq" className="py-20" {...scrollReveal}>
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Quick answers about enrollment, scheduling, pricing, and working with tutors—plus ways to reach a human if you need more help.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-4">
              <Accordion type="single" collapsible>
                {faqsData.map((faq, index) => (
                  <AccordionItem
                    key={faq.id}
                    value={`item-${index + 1}`}
                    className="border border-border/60 rounded-xl px-6 bg-card/80 backdrop-blur"
                  >
                    <AccordionTrigger className="text-left hover:no-underline">
                      <span className="font-semibold text-base lg:text-lg">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-4 text-muted-foreground leading-relaxed">
                      {renderFaqAnswer(faq.answer)}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <Card className="border-border/60 sticky top-24 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Still need help?</h3>
                    <p className="text-sm text-muted-foreground">
                      Talk with our team for enrollment questions or to match with a tutor faster.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/60 p-4 space-y-3 text-sm text-muted-foreground">
                  <div className="flex flex-col gap-0.5">
                    <span>Live chat</span>
                    <span className="text-primary font-semibold">Mon – Fri, 9:00 AM – 6:00 PM ET</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span>Email</span>
                    <a href="mailto:contact@edkonnect-academy.com" className="font-semibold text-foreground hover:text-primary transition-colors">contact@edkonnect-academy.com</a>
                  </div>
                </div>

                <Button asChild className="w-full">
                  <Link href="/contact">Contact Support</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/tutors">Find a Tutor</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>

      {/* Blog Section */}
      <motion.section className="py-20 bg-muted/30" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Latest from Our Blog</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Insights, strategies, and tips to help you achieve academic excellence.
            </p>
          </div>

          {blogPostsLoading ? (
            <div className="grid md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded animate-pulse mb-4" />
                    <div className="h-6 bg-muted rounded animate-pulse mb-3" />
                    <div className="h-4 bg-muted rounded animate-pulse mb-3" />
                    <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : blogPostsData.length > 0 ? (
            <div className="relative overflow-hidden">
              <style>
                {`
                  @keyframes blog-marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                `}
              </style>

              {/* Edge fade masks for a smoother entrance/exit */}
              <div className="pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-muted/30 via-muted/10 to-transparent z-10" />
              <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-muted/30 via-muted/10 to-transparent z-10" />

              {/* Continuous marquee track */}
              <div
                className="flex gap-6 w-max"
                style={{ animation: "blog-marquee 60s linear infinite" }}
              >
                {[...blogPostsData, ...blogPostsData].map((post, idx) => (
                  <Link key={`${post.id}-${idx}`} href={`/blog/${post.slug}`}>
                  <Card
                    className="overflow-hidden hover:shadow-lg transition-shadow group min-w-[260px] md:min-w-[300px] lg:min-w-[320px] max-w-[320px] cursor-pointer h-full flex flex-col"
                  >
                    <CardContent className="p-6 flex flex-col flex-1">
                      {post.category && (
                        <span className="inline-block px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full mb-3 w-fit">
                          {post.category}
                        </span>
                      )}
                      <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{post.title}</h3>
                      <p className="text-muted-foreground mb-4 line-clamp-3 flex-1">{post.excerpt}</p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mt-auto pt-3 border-t border-border">
                        {post.readTime && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {post.readTime} min read
                          </span>
                        )}
                        {post.publishedAt && (
                          <span>
                            {new Date(post.publishedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No blog posts available at the moment.</p>
            </div>
          )}

          {blogPostsData.length > 0 && (
            <div className="text-center mt-10">
              <Button asChild size="lg" variant="outline">
                <Link href="/blog">View All Posts</Link>
              </Button>
            </div>
          )}
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section className="py-20 bg-gradient-to-br from-primary/10 via-accent/10 to-background" {...scrollReveal}>
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join EdKonnect Academy today and discover the perfect tutor for your child's learning journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Button asChild size="lg" className="text-lg px-8">
                  <Link href={getDashboardLink()}>Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="text-lg px-8">
                    <Link href="/signup">Sign Up Free</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="text-lg px-8">
                    <Link href="/tutors">Browse Tutors</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      <Footer />
    </div>
  );
}
