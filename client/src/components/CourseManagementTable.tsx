import { useState } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Pencil, Trash2, Users } from "lucide-react";
import { CourseCreationForm } from "./CourseCreationForm";

interface CourseManagementTableProps {
  onAssignTutors?: (courseId: number) => void;
}

export function CourseManagementTable({ onAssignTutors }: CourseManagementTableProps) {
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: courses, isLoading, refetch } = trpc.adminCourses.getAllCoursesWithTutors.useQuery({
    search: search || undefined,
    subject: subjectFilter || undefined,
    isActive: statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined,
  });

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

  const subjects = [
    "Mathematics",
    "Science",
    "English",
    "History",
    "Foreign Language",
    "Computer Science",
    "Art",
    "Music",
    "Test Prep",
    "Other",
  ];

  if (isLoading) {
    return <div className="p-4 text-center">Loading courses...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search courses..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All subjects" />
          </SelectTrigger>
          <SelectContent>
            {subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>
                {subject}
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
        {(search || subjectFilter || statusFilter) && (
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setSubjectFilter(undefined);
              setStatusFilter(undefined);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
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
            {courses && courses.length > 0 ? (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{course.title}</div>
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {course.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{course.subject}</TableCell>
                  <TableCell>{course.gradeLevel || "—"}</TableCell>
                  <TableCell>${course.price}</TableCell>
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
                <TableCell colSpan={7} className="text-center text-muted-foreground">
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
