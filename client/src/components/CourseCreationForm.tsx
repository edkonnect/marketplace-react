import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectItem } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import { required, positiveNumber } from "@/lib/validation";
import { FormInput, FormTextarea, FormSelect } from "@/components/forms/FormInput";

interface CourseCreationFormProps {
  onSuccess?: () => void;
  editingCourse?: any;
}

export function CourseCreationForm({ onSuccess, editingCourse }: CourseCreationFormProps) {
  const [aiPowered, setAiPowered] = useState<boolean>(false);

  const emptyValues = {
    title: "",
    description: "",
    subject: "",
    gradeLevel: "",
    price: "",
    duration: "",
    sessionsPerWeek: "1",
    totalSessions: "",
    imageUrl: "",
    curriculum: "",
  };

  const initialValues = editingCourse
    ? {
        title: editingCourse?.title || "",
        description: editingCourse?.description || "",
        subject: editingCourse?.subject || "",
        gradeLevel: editingCourse?.gradeLevel || "",
        price: editingCourse?.price?.toString() || "",
        duration: editingCourse?.duration?.toString() || "",
        sessionsPerWeek: editingCourse?.sessionsPerWeek?.toString() || "1",
        totalSessions: editingCourse?.totalSessions?.toString() || "",
        imageUrl: editingCourse?.imageUrl || "",
        curriculum: editingCourse?.curriculum || "",
      }
    : emptyValues;

  const form = useValidatedForm(initialValues, {
    title: required("Course title is required"),
    subject: required("Subject is required"),
    price: [required("Price is required"), positiveNumber("Price must be greater than 0")],
  });

  const { values, register, validateForm, reset } = form;

  useEffect(() => {
    reset(initialValues);
    setAiPowered(editingCourse?.aiPowered ?? false);
  }, [editingCourse, reset]);

  const createMutation = trpc.adminCourses.createCourse.useMutation({
    onSuccess: () => {
      toast.success("Course created successfully!");
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to create course: ${error.message}`);
    },
  });

  const updateMutation = trpc.adminCourses.updateCourse.useMutation({
    onSuccess: () => {
      toast.success("Course updated successfully!");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(`Failed to update course: ${error.message}`);
    },
  });

  const resetForm = () => {
    reset(emptyValues);
    setAiPowered(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid } = validateForm();
    if (!isValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const courseData = {
      ...values,
      subject: values.subject,
      duration: values.duration ? parseInt(values.duration) : undefined,
      sessionsPerWeek: parseInt(values.sessionsPerWeek),
      totalSessions: values.totalSessions ? parseInt(values.totalSessions) : undefined,
      price: values.price,
      aiPowered,
    };

    if (editingCourse) {
      updateMutation.mutate({
        id: editingCourse.id,
        ...courseData,
      });
    } else {
      createMutation.mutate(courseData);
    }
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

  const gradeLevels = [
    "Elementary (K-5)",
    "Middle School (6-8)",
    "High School (9-12)",
    "College",
    "Adult",
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editingCourse ? "Edit Course" : "Create New Course"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormInput
              field={register("title")}
              label="Course Title *"
              required
              placeholder="e.g., SAT Math Prep"
            />

            <FormSelect
              field={register("subject")}
              label="Subject *"
              required
              placeholder="Select subject"
            >
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </FormSelect>
          </div>

          <FormTextarea
            field={register("description")}
            label="Description"
            placeholder="Describe what students will learn..."
            rows={3}
          />

          <div className="grid grid-cols-3 gap-4">
            <FormSelect
              field={register("gradeLevel")}
              label="Grade Level"
              placeholder="Select grade"
            >
              {gradeLevels.map((grade) => (
                <SelectItem key={grade} value={grade}>
                  {grade}
                </SelectItem>
              ))}
            </FormSelect>

            <FormInput
              field={register("price")}
              label="Price ($) *"
              required
              type="number"
              step="0.01"
              placeholder="99.99"
            />

            <FormInput
              field={register("duration")}
              label="Duration (minutes)"
              type="number"
              placeholder="60"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              field={register("sessionsPerWeek")}
              label="Sessions Per Week"
              type="number"
              placeholder="1"
            />

            <FormInput
              field={register("totalSessions")}
              label="Total Sessions"
              type="number"
              placeholder="12"
            />
          </div>

          <FormInput
            field={register("imageUrl")}
            label="Image URL"
            placeholder="https://example.com/image.jpg"
          />

          <FormTextarea
            field={register("curriculum")}
            label="Curriculum"
            placeholder="Detailed curriculum outline..."
            rows={5}
          />

          <div className="flex items-center gap-2">
            <Checkbox
              id="aiPowered"
              checked={aiPowered}
              onCheckedChange={(checked) => setAiPowered(checked === true)}
            />
            <Label htmlFor="aiPowered" className="cursor-pointer">
              AI Powered
            </Label>
          </div>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingCourse ? "Update Course" : "Create Course"}
            </Button>
            {!editingCourse && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Reset
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
