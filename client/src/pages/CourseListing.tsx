import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { CoursePrice } from "@/components/CoursePrice";
import { useIsIndianUser } from "@/hooks/useIsIndianUser";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Clock, Layers, GraduationCap, Search, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { useState, useEffect } from "react";
import { Link, useSearch } from "wouter";
import { getCourseCategory, getCourseSortOrder, getTestPrepGroup, COURSE_CATEGORIES, TEST_PREP_GROUPS } from "@/lib/courseCategory";

const COURSES_PER_PAGE = 12;

type PublicTier = { maxPriceUsd: number | null; discountAmountUsd: number; discountAmountInr: number; sortOrder: number };

function getRefDiscount(priceUsd: number, tiers: PublicTier[]): PublicTier | null {
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const tier of sorted) {
    if (tier.maxPriceUsd === null || priceUsd <= tier.maxPriceUsd) return tier;
  }
  return sorted[sorted.length - 1] ?? null;
}

// FIX: the mega menu's titles come from a hand-typed sort-order map
// (courseCategory.ts) that isn't always spelled identically to the real
// course titles in the DB — e.g. "grade 10 mathematics" vs "grade-10
// biology". A strict substring match on that raw text can miss the real
// course entirely, leaving the grid blank. Normalizing both sides
// (collapsing hyphens/punctuation/extra spaces) makes the match tolerant
// of those formatting differences.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[-_/,.:()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// FIX: within the SAT/ACT group, the sheet order lists "act english" (194)
// ahead of "sat english" (220), so ACT courses were appearing before SAT
// courses by default — the opposite of what's required. SAT titles are now
// bumped to the front of the default sort; \bSAT\b intentionally does not
// match "PSAT" (no word boundary between P and S), so PSAT stays unaffected.
function isSatTitle(title: string): boolean {
  return /\bSAT\b/i.test(title);
}

// FIX: entering "Test Prep" with no explicit sub-group used to default to
// "all", which mixes SAT/ACT in with ACT-only, GRE/GMAT, IELTS, TOEFL, etc.
// (several of which sort ahead of "sat ..." in the sheet order), so SAT
// courses could end up buried past page 1. Business requirement: Test Prep
// should always open on SAT/ACT by default. "All Test Prep" is still
// selectable explicitly from the dropdown.
const DEFAULT_TEST_PREP_GROUP: (typeof TEST_PREP_GROUPS)[number] = "SAT/ACT";

export default function CourseListing() {
  const search = useSearch();
  const params = new URLSearchParams(search);

  const [searchQuery, setSearchQuery] = useState(params.get("search") ?? "");
  const [subjectFilter, setSubjectFilter] = useState<string>(params.get("subject") ?? "all");
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>(params.get("gradeLevel") ?? "all");
  const [categoryFilter, setCategoryFilter] = useState<string>(params.get("category") ?? "all");
  const [testPrepGroupFilter, setTestPrepGroupFilter] = useState<string>(
    params.get("testPrepGroup") ?? (params.get("category") === "Test Prep" ? DEFAULT_TEST_PREP_GROUP : "all")
  );
  const [priceSort, setPriceSort] = useState<string>("default");
  const [currentPage, setCurrentPage] = useState(1);

  // Sync state when URL changes (e.g. clicking mega menu links)
  useEffect(() => {
    const p = new URLSearchParams(search);
    const nextCategory = p.get("category") ?? "all";
    setSearchQuery(p.get("search") ?? "");
    setSubjectFilter(p.get("subject") ?? "all");
    setGradeLevelFilter(p.get("gradeLevel") ?? "all");
    setCategoryFilter(nextCategory);
    // If landing on Test Prep without an explicit sub-group in the URL,
    // default to SAT/ACT rather than showing every test prep type mixed together.
    setTestPrepGroupFilter(
      p.get("testPrepGroup") ?? (nextCategory === "Test Prep" ? DEFAULT_TEST_PREP_GROUP : "all")
    );
    setCurrentPage(1);
  }, [search]);

  const isIndian = useIsIndianUser();

  // FIX: previously this always requested courses scoped to the visitor's
  // detected region ("india" or "us"), which meant a course only tagged for
  // one region's catalog would never show up for a visitor from elsewhere —
  // e.g. a US-based visitor was only ever shown the India-region course set
  // (or vice versa), instead of the full catalog. The browse/listing page is
  // meant to show every course regardless of where the visitor is; region is
  // still used correctly downstream for price display via <CoursePrice />.
  const { data: courses, isLoading } = trpc.course.list.useQuery({ region: "global" });

  const { data: referralTiers = [] } = trpc.referral.getPublicTiers.useQuery(undefined, {
    staleTime: 60 * 60 * 1000,
  });

  const filteredCourses = courses
    ?.filter((course) => {
      const normalizedQuery = normalize(searchQuery);
      const matchesSearch =
        searchQuery === "" ||
        normalize(course.title).includes(normalizedQuery) ||
        (course.description && normalize(course.description).includes(normalizedQuery)) ||
        normalize(course.subject).includes(normalizedQuery);

      const matchesSubject = subjectFilter === "all" || course.subject === subjectFilter;

      const normalizeGradeLevel = (g: string | null | undefined) => {
        if (!g) return "";
        if (g.startsWith("Elementary")) return "Elementary (K-5)";
        if (g.startsWith("Middle School")) return "Middle School (6-8)";
        if (g.startsWith("High School")) return "High School (9-12)";
        return g;
      };
      const matchesGradeLevel =
        gradeLevelFilter === "all" ||
        course.gradeLevel?.split(",").some((g: string) => normalizeGradeLevel(g.trim()) === gradeLevelFilter);

      const matchesCategory =
        categoryFilter === "all" ||
        getCourseCategory({ title: course.title, subject: course.subject, gradeLevel: course.gradeLevel }) === categoryFilter;

      const matchesTestPrepGroup =
        testPrepGroupFilter === "all" ||
        getTestPrepGroup(course.title) === testPrepGroupFilter;

      return matchesSearch && matchesSubject && matchesGradeLevel && matchesCategory && matchesTestPrepGroup;
    })
    .sort((a, b) => {
      if (priceSort === "low-high") return parseFloat(a.price) - parseFloat(b.price);
      if (priceSort === "high-low") return parseFloat(b.price) - parseFloat(a.price);
      // Default: SAT titles first, then sheet order (matches xlsx tab order) as tiebreaker.
      const aSat = isSatTitle(a.title) ? 0 : 1;
      const bSat = isSatTitle(b.title) ? 0 : 1;
      if (aSat !== bSat) return aSat - bSat;
      return getCourseSortOrder(a.title) - getCourseSortOrder(b.title);
    });

  const totalPages = Math.ceil((filteredCourses?.length || 0) / COURSES_PER_PAGE);
  const paginatedCourses = filteredCourses?.slice(
    (currentPage - 1) * COURSES_PER_PAGE,
    currentPage * COURSES_PER_PAGE
  );

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const subjects = Array.from(new Set(courses?.map((c) => c.subject).filter((s): s is string => !!s) || []));
  const gradeLevels = [
    "Elementary (K-5)",
    "Middle School (6-8)",
    "High School (9-12)",
    "College",
    "Adult",
  ];

  const hasActiveFilters =
    categoryFilter !== "all" ||
    subjectFilter !== "all" ||
    gradeLevelFilter !== "all" ||
    testPrepGroupFilter !== "all" ||
    searchQuery !== "";

  const clearFilters = () => {
    setSearchQuery("");
    setSubjectFilter("all");
    setGradeLevelFilter("all");
    setCategoryFilter("all");
    setTestPrepGroupFilter("all");
    setCurrentPage(1);
  };

  const pageTitle =
    categoryFilter === "Test Prep" && testPrepGroupFilter !== "all"
      ? `${testPrepGroupFilter} Courses`
      : categoryFilter !== "all"
      ? `${categoryFilter} Courses`
      : "Browse All Courses";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 mt-20">
        {/* Header */}
        <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-background py-16 border-b border-border">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {pageTitle}
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Explore our comprehensive selection of tutoring courses across all subjects and grade levels
              </p>
            </div>
          </div>
        </section>

        {/* Filters */}
        <section className="py-8 border-b border-border bg-card/50">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="md:col-span-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="pl-10"
                />
              </div>

              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setCategoryFilter(v);
                  // Default Test Prep to SAT/ACT rather than "all" when selected manually too.
                  setTestPrepGroupFilter(v === "Test Prep" ? DEFAULT_TEST_PREP_GROUP : "all");
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {COURSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {categoryFilter === "Test Prep" ? (
                <Select value={testPrepGroupFilter} onValueChange={(v) => { setTestPrepGroupFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All Test Prep" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Test Prep</SelectItem>
                    {TEST_PREP_GROUPS.map((group) => (
                      <SelectItem key={group} value={group}>{group}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={subjectFilter} onValueChange={(v) => { setSubjectFilter(v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map((subject) => (
                      <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={gradeLevelFilter} onValueChange={(v) => { setGradeLevelFilter(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All Grade Levels" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grade Levels</SelectItem>
                  {gradeLevels.map((level) => (
                    <SelectItem key={level} value={level}>{level}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={priceSort} onValueChange={setPriceSort}>
                <SelectTrigger><SelectValue placeholder="Sort by" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="low-high">Price: Low to High</SelectItem>
                  <SelectItem value="high-low">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {categoryFilter === "Test Prep" && testPrepGroupFilter !== "all" && (
              <div className="flex items-center gap-1.5 mt-3 text-sm text-amber-600">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                Showing {testPrepGroupFilter} courses
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {filteredCourses?.length || 0} courses found
                {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
              </p>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-sm text-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Course Grid */}
        <section className="py-12">
          <div className="container">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent><Skeleton className="h-20 w-full" /></CardContent>
                    <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                  </Card>
                ))}
              </div>
            ) : filteredCourses && filteredCourses.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedCourses!.map((course) => (
                    <Card key={course.id} className="hover:shadow-lg transition-shadow duration-300 h-full flex flex-col">
                      <CardHeader>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex flex-col gap-1">
                            <Badge variant="secondary">{getCourseCategory({ title: course.title, subject: course.subject, gradeLevel: course.gradeLevel })}</Badge>
                            {course.aiPowered && (
                              <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px] w-fit">
                                ✦ AI Powered
                              </Badge>
                            )}
                          </div>
                          <CoursePrice
                            price={course.price}
                            priceInr={course.priceInr}
                            region={course.region ?? "global"}
                            totalSessions={course.totalSessions}
                            referralDiscountUsd={getRefDiscount(parseFloat(course.price), referralTiers)?.discountAmountUsd}
                            referralDiscountInr={getRefDiscount(parseFloat(course.price), referralTiers)?.discountAmountInr}
                            priceClassName="text-2xl font-bold text-primary"
                          />
                        </div>
                        <CardTitle className="text-xl">{course.title}</CardTitle>
                        {course.gradeLevel && (
                          <CardDescription className="text-sm">{course.gradeLevel}</CardDescription>
                        )}
                      </CardHeader>

                      <CardContent className="space-y-3 flex-1">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {course.description || "No description available"}
                        </p>
                        {course.curriculum && (
                          <div className="border-t pt-3">
                            <p className="text-xs font-semibold text-muted-foreground mb-1">Curriculum Preview:</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {course.curriculum.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <GraduationCap className="h-4 w-4" />
                            <span>{course.gradeLevel}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>{course.duration ? `${course.duration} min` : "—"}</span>
                          </div>
                          {course.sessionsPerWeek && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <BookOpen className="h-4 w-4" />
                              <span>{course.sessionsPerWeek}x/week</span>
                            </div>
                          )}
                          {course.totalSessions && (
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Layers className="h-4 w-4" />
                              <span>{course.totalSessions} sessions</span>
                            </div>
                          )}
                        </div>
                      </CardContent>

                      <CardFooter className="mt-auto">
                        <Button asChild className="w-full">
                          <Link href={`/course/${course.id}`}>View Details</Link>
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-1 mt-10">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                      <span className="hidden sm:inline">Previous</span>
                    </Button>
                    {getPageNumbers().map((page, index) =>
                      page === "..." ? (
                        <span key={`ellipsis-${index}`} className="px-1 text-muted-foreground">...</span>
                      ) : (
                        <Button key={page} variant={currentPage === page ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(page as number)} className="w-8 sm:w-9">
                          {page}
                        </Button>
                      )
                    )}
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <span className="hidden sm:inline">Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Card className="py-16">
                <CardContent className="text-center">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No courses found</h3>
                  <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}