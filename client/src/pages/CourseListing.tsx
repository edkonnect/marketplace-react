import Navigation from "@/components/Navigation";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, Clock, DollarSign, GraduationCap, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function CourseListing() {
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [gradeLevelFilter, setGradeLevelFilter] = useState<string>("all");
  const [priceSort, setPriceSort] = useState<string>("default");

  const { data: courses, isLoading } = trpc.course.list.useQuery();

  // Filter and sort courses
  const filteredCourses = courses
    ?.filter((course) => {
      const matchesSearch =
        searchQuery === "" ||
        course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (course.description && course.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        course.subject.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSubject = subjectFilter === "all" || course.subject === subjectFilter;
      const matchesGradeLevel = gradeLevelFilter === "all" || course.gradeLevel === gradeLevelFilter;

      return matchesSearch && matchesSubject && matchesGradeLevel;
    })
    .sort((a, b) => {
      if (priceSort === "low-high") {
        return parseFloat(a.price) - parseFloat(b.price);
      } else if (priceSort === "high-low") {
        return parseFloat(b.price) - parseFloat(a.price);
      }
      return 0;
    });

  // Get unique subjects and grade levels for filters
  const subjects = Array.from(new Set(courses?.map((c) => c.subject).filter((s): s is string => !!s) || []));
  const gradeLevels = Array.from(new Set(courses?.map((c) => c.gradeLevel).filter((g): g is string => !!g) || []));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      <main className="flex-1 mt-20">
        {/* Header Section */}
        <section className="bg-gradient-to-br from-primary/5 via-primary/10 to-background py-16 border-b border-border">
          <div className="container">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Browse All Courses
              </h1>
              <p className="text-lg text-muted-foreground mb-8">
                Explore our comprehensive selection of tutoring courses across all subjects and grade levels
              </p>
            </div>
          </div>
        </section>

        {/* Search and Filters */}
        <section className="py-8 border-b border-border bg-card/50">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search */}
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Subject Filter */}
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {subjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Grade Level Filter */}
              <Select value={gradeLevelFilter} onValueChange={setGradeLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Grade Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Grade Levels</SelectItem>
                  {gradeLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort and Results Count */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                {filteredCourses?.length || 0} courses found
              </p>
              <Select value={priceSort} onValueChange={setPriceSort}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="low-high">Price: Low to High</SelectItem>
                  <SelectItem value="high-low">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
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
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                    <CardFooter>
                      <Skeleton className="h-10 w-full" />
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : filteredCourses && filteredCourses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCourses.map((course) => (
                  <Card
                    key={course.id}
                    className="hover:shadow-lg transition-shadow duration-300 h-full flex flex-col"
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <Badge variant="secondary" className="mb-2">
                          {course.subject}
                        </Badge>
                        <div className="text-2xl font-bold text-primary">
                          ${course.price}
                        </div>
                      </div>
                      <CardTitle className="text-xl">{course.title}</CardTitle>
                      {course.gradeLevel && (
                        <CardDescription className="text-sm">
                          {course.gradeLevel}
                        </CardDescription>
                      )}
                    </CardHeader>

                    <CardContent className="space-y-3 flex-1">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {course.description || "No description available"}
                      </p>

                      {course.curriculum && (
                        <div className="border-t pt-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">Curriculum Preview:</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                            {course.curriculum}
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
                          <span>{course.duration} min</span>
                        </div>
                        {course.sessionsPerWeek && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <BookOpen className="h-4 w-4" />
                            <span>{course.sessionsPerWeek}x/week</span>
                          </div>
                        )}
                        {course.totalSessions && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            <span>{course.totalSessions} sessions</span>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    <CardFooter className="mt-auto">
                      <Button asChild className="w-full">
                        <Link href={`/course/${course.id}`}>
                          View Details
                        </Link>
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="py-16">
                <CardContent className="text-center">
                  <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-semibold mb-2">No courses found</h3>
                  <p className="text-muted-foreground mb-6">
                    Try adjusting your search or filters
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setSubjectFilter("all");
                      setGradeLevelFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-card/50">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 EdKonnect Academy. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
