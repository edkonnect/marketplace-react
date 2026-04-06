import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pencil, Trash2, Users } from "lucide-react";
import { CourseCreationForm } from "./CourseCreationForm";

interface CourseManagementTableProps {
  onAssignTutors?: (courseId: number) => void;
}

type Category =
  | "cbse"
  | "icse"
  | "igcse"
  | "ib"
  | "ap"
  | "alevel"
  | "test_prep"
  | "middle_school"
  | "elementary"
  | "high_school"
  | "computer_science"
  | "languages"
  | "other";

const CATEGORY_LABELS: Record<Category, string> = {
  cbse: "CBSE",
  icse: "ICSE / ISC",
  igcse: "IGCSE",
  ib: "IB",
  ap: "AP",
  alevel: "A Level",
  test_prep: "Test Prep",
  middle_school: "Middle School",
  elementary: "Elementary",
  high_school: "High School",
  computer_science: "Computer Science",
  languages: "Languages",
  other: "Other",
};

const TEST_PREP_KEYWORDS = [
  "sat", "act", "psat", "gre", "gmat", "toefl", "ielts", "pte", "oet",
  "neet", "jee", "iit", "bitsat", "eapcet", "eamcet", "kcet", "lsat",
  "clat", "cat", "cuet", "isee", "ssat", "hspt", "staar", "det",
  "spelling bee", "duolingo", "occupational english", "pearson",
];

function getCourseCategory(title: string, subject: string): Category {
  const t = title.toLowerCase();

  if (t.startsWith("cbse")) return "cbse";
  if (t.startsWith("icse") || t.startsWith("isc ")) return "icse";
  if (t.startsWith("igcse")) return "igcse";
  if (t.startsWith("ib ") || t.startsWith("ib dp") || t.startsWith("ib myp") || t.startsWith("ib mathematics")) return "ib";
  if (t.startsWith("ap ") || t.startsWith("ap calculus") || t.startsWith("ap computer") || t.startsWith("ap world") || t.startsWith("ap united") || t.startsWith("ap comparative") || t.startsWith("ap human") || t.startsWith("ap macro") || t.startsWith("ap micro") || t.startsWith("ap psychology") || t.startsWith("ap biology") || t.startsWith("ap chemistry") || t.startsWith("ap environmental") || t.startsWith("ap physics") || t.startsWith("ap statistics") || t.startsWith("ap french") || t.startsWith("ap german") || t.startsWith("ap italian") || t.startsWith("ap spanish") || t.startsWith("ap language")) return "ap";
  if (t.startsWith("a level")) return "alevel";
  if (t.startsWith("middle school")) return "middle_school";
  if (t.startsWith("elementary")) return "elementary";
  if (t.startsWith("high school")) return "high_school";

  if (TEST_PREP_KEYWORDS.some((kw) => t.includes(kw))) return "test_prep";

  if (subject === "Computer Science") return "computer_science";
  if (subject === "Foreign Language" || subject === "Spanish" || t.includes("language course")) return "languages";

  return "other";
}

export function CourseManagementTable({ onAssignTutors }: CourseManagementTableProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: allCourses, isLoading, refetch } = trpc.adminCourses.getAllCoursesWithTutors.useQuery({});

  const courses = useMemo(() => {
    if (!allCourses) return [];
    const q = search.toLowerCase().trim();
    return allCourses
      .filter((c) => {
        if (q && !c.title.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q)) return false;
        if (categoryFilter && categoryFilter !== "all") {
          if (getCourseCategory(c.title, c.subject ?? "") !== categoryFilter) return false;
        }
        if (statusFilter === "active" && !c.isActive) return false;
        if (statusFilter === "inactive" && c.isActive) return false;
        if (letterFilter && c.title.trim()[0]?.toUpperCase() !== letterFilter) return false;
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [allCourses, search, categoryFilter, statusFilter, letterFilter]);

  const activeLetters = useMemo(() => {
    if (!allCourses) return new Set<string>();
    return new Set(allCourses.map((c) => c.title.trim()[0]?.toUpperCase()).filter(Boolean));
  }, [allCourses]);

  const deleteMutation = trpc.adminCourses.deleteCourse.useMutation({
    onSuccess: () => {
      toast.success("Course deleted successfully!");
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to delete course: ${error.message}`);
    },
  });

  const handleDelete = (courseId: number, courseName: string) => {
    if (confirm(`Are you sure you want to delete "${courseName}"? This action cannot be undone.`)) {
      deleteMutation.mutate({ id: courseId });
    }
  };

  const handleEdit = (course: any) => {
    setEditingCourse(course);
    setIsEditDialogOpen(true);
  };

  const handleEditSuccess = async () => {
    await refetch();
    setIsEditDialogOpen(false);
    setEditingCourse(null);
  };

  const hasFilters = search || (categoryFilter && categoryFilter !== "all") || statusFilter || letterFilter;

  if (isLoading) {
    return <div className="p-4 text-center">Loading courses...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setCategoryFilter("all");
              setStatusFilter(undefined);
              setLetterFilter(null);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* A–Z letter filter */}
      <div className="flex flex-wrap items-center gap-1 border rounded-lg px-3 py-2 bg-muted/30">
        <button
          onClick={() => setLetterFilter(null)}
          className={`px-2 py-0.5 rounded text-sm font-medium transition-colors ${
            letterFilter === null
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
          const hasEntries = activeLetters.has(letter);
          const isActive = letterFilter === letter;
          return (
            <button
              key={letter}
              onClick={() => hasEntries && setLetterFilter(isActive ? null : letter)}
              disabled={!hasEntries}
              className={`px-2 py-0.5 rounded text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : hasEntries
                  ? "text-foreground hover:bg-muted"
                  : "text-muted-foreground/30 cursor-default"
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        Showing {courses.length} course{courses.length !== 1 ? "s" : ""}
        {hasFilters ? " (filtered)" : ""}
      </p>

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background">Course</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Grade</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Region</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned Tutors</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length > 0 ? (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="sticky left-0 z-10 bg-background">
                    <div>
                      <div className="font-medium">{course.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
                        {course.description?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="whitespace-nowrap">
                      {CATEGORY_LABELS[getCourseCategory(course.title, course.subject ?? "")]}
                    </Badge>
                  </TableCell>
                  <TableCell>{course.subject}</TableCell>
                  <TableCell>{course.gradeLevel ? course.gradeLevel.split(",").map((g: string) => g.trim()).join(", ") : "—"}</TableCell>
                  <TableCell>{course.region === "india" ? "₹" : "$"}{course.price}</TableCell>
                  <TableCell>
                    {course.region === "us" ? "🇺🇸 US" : course.region === "india" ? "🇮🇳 India" : "🌐 Global"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={course.isActive ? "default" : "secondary"}>
                      {course.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {course.assignedTutors?.length || 0} tutor(s)
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAssignTutors?.(course.id)}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(course)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(course.id, course.title)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No courses found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update course details and curriculum
            </DialogDescription>
          </DialogHeader>
          <CourseCreationForm
            editingCourse={editingCourse}
            onSuccess={handleEditSuccess}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
