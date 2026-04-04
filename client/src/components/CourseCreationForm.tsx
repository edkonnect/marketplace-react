import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import { required, positiveNumber } from "@/lib/validation";
import { FormInput, FormTextarea, FormSelect } from "@/components/forms/FormInput";
import { RichTextEditor } from "@/components/RichTextEditor";

interface CourseCreationFormProps {
  onSuccess?: () => void;
  editingCourse?: any;
}

export function CourseCreationForm({ onSuccess, editingCourse }: CourseCreationFormProps) {
  const [aiPowered, setAiPowered] = useState<boolean>(false);
  const [region, setRegion] = useState<"global" | "us" | "india">("global");
  const [courseType, setCourseType] = useState<"tutor" | "homework" | "test_prep">("tutor");
  const [selectedGradeLevels, setSelectedGradeLevels] = useState<string[]>([]);
  const [priceInr, setPriceInr] = useState<string>("");
  const [priceInrError, setPriceInrError] = useState<string>("");

  const emptyValues = {
    title: "",
    description: "",
    subject: "",
    price: "",
    duration: "",
    sessionsPerWeek: "1",
    totalSessions: "",
    imageUrl: "",
    curriculum: "",
    displayOrder: "0",
  };

  const initialValues = editingCourse
    ? {
        title: editingCourse?.title || "",
        description: editingCourse?.description || "",
        subject: editingCourse?.subject || "",
        price: editingCourse?.price?.toString() || "",
        duration: editingCourse?.duration?.toString() || "",
        sessionsPerWeek: editingCourse?.sessionsPerWeek?.toString() || "1",
        totalSessions: editingCourse?.totalSessions?.toString() || "",
        imageUrl: editingCourse?.imageUrl || "",
        curriculum: editingCourse?.curriculum || "",
        displayOrder: editingCourse?.displayOrder?.toString() ?? "0",
      }
    : emptyValues;

  const form = useValidatedForm(initialValues, {
    title: required("Course title is required"),
    subject: required("Subject is required"),
    price: [required("Price is required"), positiveNumber("Price must be greater than 0")],
    totalSessions: [required("Total sessions is required"), positiveNumber("Total sessions must be greater than 0")],
  });

  const { values, register, validateForm, reset } = form;

  useEffect(() => {
    reset(initialValues);
    setAiPowered(editingCourse?.aiPowered ?? false);
    setRegion(editingCourse?.region ?? "global");
    setCourseType(editingCourse?.courseType ?? "tutor");
    setPriceInr(editingCourse?.priceInr?.toString() || "");
    setPriceInrError("");
    setSelectedGradeLevels(
      editingCourse?.gradeLevel
        ? editingCourse.gradeLevel.split(",").map((g: string) => g.trim()).filter(Boolean)
        : []
    );
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
    setRegion("global");
    setCourseType("tutor");
    setSelectedGradeLevels([]);
    setPriceInr("");
    setPriceInrError("");
  };

  const toggleGradeLevel = (grade: string) => {
    setSelectedGradeLevels(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid } = validateForm();

    // Validate INR price for global region
    let inrValid = true;
    if (region === "global") {
      if (!priceInr || priceInr.trim() === "") {
        setPriceInrError("INR price is required");
        inrValid = false;
      } else if (parseFloat(priceInr) <= 0) {
        setPriceInrError("Price must be greater than 0");
        inrValid = false;
      } else {
        setPriceInrError("");
      }
    }

    if (!isValid || !inrValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const courseData = {
      ...values,
      subject: values.subject,
      gradeLevel: selectedGradeLevels.length > 0 ? selectedGradeLevels.join(",") : undefined,
      duration: values.duration ? parseInt(values.duration) : undefined,
      sessionsPerWeek: parseInt(values.sessionsPerWeek),
      totalSessions: parseInt(values.totalSessions),
      price: values.price,
      priceInr: region === "global" && priceInr ? priceInr : null,
      displayOrder: parseInt(values.displayOrder) || 0,
      aiPowered,
      region,
      courseType,
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Grade Level</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {gradeLevels.map((grade) => (
                  <div key={grade} className="flex items-center gap-1.5">
                    <Checkbox
                      id={`grade-${grade}`}
                      checked={selectedGradeLevels.includes(grade)}
                      onCheckedChange={() => toggleGradeLevel(grade)}
                    />
                    <Label htmlFor={`grade-${grade}`} className="cursor-pointer font-normal text-sm">
                      {grade}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Region</Label>
              <Select
                key={`region-${editingCourse?.id ?? "new"}-${region}`}
                value={region}
                onValueChange={(v) => { setRegion(v as typeof region); setPriceInrError(""); }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">🌐 Global</SelectItem>
                  <SelectItem value="us">🇺🇸 US Only</SelectItem>
                  <SelectItem value="india">🇮🇳 India Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Price fields — dynamic based on region */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <FormInput
              field={register("duration")}
              label="Duration (minutes)"
              type="number"
              placeholder="60"
            />

            <FormInput
              field={register("sessionsPerWeek")}
              label="Sessions Per Week"
              type="number"
              placeholder="1"
            />

            <FormInput
              field={register("totalSessions")}
              label="Total Sessions"
              required
              type="number"
              placeholder="12"
            />

            {region === "us" && (
              <FormInput
                field={register("price")}
                label="Price (USD $) *"
                required
                type="number"
                step="0.01"
                placeholder="99.99"
              />
            )}

            {region === "india" && (
              <FormInput
                field={register("price")}
                label="Price (INR ₹) *"
                required
                type="number"
                step="0.01"
                placeholder="8499"
              />
            )}

            {region === "global" && (
              <>
                <FormInput
                  field={register("price")}
                  label="Price (USD $) *"
                  required
                  type="number"
                  step="0.01"
                  placeholder="99.99"
                />
              </>
            )}
          </div>

          {region === "global" && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="sm:col-start-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Price (INR ₹) *</Label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="8499"
                    value={priceInr}
                    onChange={(e) => { setPriceInr(e.target.value); setPriceInrError(""); }}
                    className={`flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${priceInrError ? "border-destructive focus-visible:ring-destructive" : "border-input"}`}
                  />
                  {priceInrError && (
                    <p className="text-xs text-destructive">{priceInrError}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              field={register("imageUrl")}
              label="Image URL"
              placeholder="https://example.com/image.jpg"
            />

            <FormInput
              field={register("displayOrder")}
              label="Display Order"
              type="number"
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Curriculum</Label>
            <RichTextEditor
              key={editingCourse?.id ?? "new"}
              value={values.curriculum}
              onChange={(html) => register("curriculum").inputProps.onChange(html)}
              placeholder="Detailed curriculum outline — use formatting to organize topics, weeks, or units..."
            />
          </div>

          <div className="flex items-center gap-6 flex-wrap">
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

            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Course Type</Label>
              <Select key={`courseType-${editingCourse?.id ?? "new"}-${courseType}`} value={courseType} onValueChange={(v) => setCourseType(v as typeof courseType)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tutor">Tutor Prep</SelectItem>
                  <SelectItem value="homework">Homework</SelectItem>
                  <SelectItem value="test_prep">Test Prep</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
