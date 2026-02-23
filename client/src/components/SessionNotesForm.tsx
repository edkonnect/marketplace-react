import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Save, Upload } from "lucide-react";
import { FileUpload } from "@/components/FileUpload";
import { useValidatedForm } from "@/hooks/useValidatedForm";
import { required } from "@/lib/validation";
import { FormTextarea } from "@/components/forms/FormInput";

interface SessionNotesFormProps {
  sessionId: number;
  parentId: number;
  existingNote?: {
    id: number;
    progressSummary: string;
    homework?: string | null;
    challenges?: string | null;
    nextSteps?: string | null;
  };
  onSuccess?: () => void;
}

export function SessionNotesForm({ sessionId, parentId, existingNote, onSuccess }: SessionNotesFormProps) {
  const initialValues = {
    progressSummary: existingNote?.progressSummary || "",
    homework: existingNote?.homework || "",
    challenges: existingNote?.challenges || "",
    nextSteps: existingNote?.nextSteps || "",
  };

  const form = useValidatedForm(initialValues, {
    progressSummary: required("Please provide a progress summary"),
  });

  const { values, register, validateForm, reset } = form;
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    reset(initialValues);
  }, [existingNote, reset]);

  const createMutation = trpc.sessionNotes.create.useMutation();
  const updateMutation = trpc.sessionNotes.update.useMutation();
  const uploadAttachmentMutation = trpc.sessionNotes.uploadAttachment.useMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid } = validateForm();
    if (!isValid) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    try {
      let noteId: number;

      if (existingNote) {
        await updateMutation.mutateAsync({
          id: existingNote.id,
          progressSummary: values.progressSummary,
          homework: values.homework || undefined,
          challenges: values.challenges || undefined,
          nextSteps: values.nextSteps || undefined,
        });
        noteId = existingNote.id;
        toast.success("Session notes updated successfully");
      } else {
        const created = await createMutation.mutateAsync({
          sessionId,
          parentId,
          progressSummary: values.progressSummary,
          homework: values.homework || undefined,
          challenges: values.challenges || undefined,
          nextSteps: values.nextSteps || undefined,
        });
        noteId = created.id;
        toast.success("Session notes created successfully");
      }

      // Upload files if any
      if (selectedFiles.length > 0) {
        setIsUploading(true);
        toast.info(`Uploading ${selectedFiles.length} file(s)...`);

        for (const file of selectedFiles) {
          const reader = new FileReader();
          await new Promise((resolve, reject) => {
            reader.onload = async () => {
              try {
                const base64Data = (reader.result as string).split(',')[1];
                await uploadAttachmentMutation.mutateAsync({
                  sessionNoteId: noteId,
                  fileName: file.name,
                  fileData: base64Data,
                  mimeType: file.type,
                });
                resolve(null);
              } catch (error) {
                reject(error);
              }
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        }

        setIsUploading(false);
        toast.success("Files uploaded successfully");
      }

      onSuccess?.();
    } catch (error: any) {
      setIsUploading(false);
      toast.error(error.message || "Failed to save session notes");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending || isUploading;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <CardTitle>{existingNote ? "Edit Session Notes" : "Add Session Notes"}</CardTitle>
        </div>
        <CardDescription>
          Document student progress, assign homework, and share feedback with parents
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormTextarea
            field={register("progressSummary")}
            label={
              <>
                Progress Summary <span className="text-destructive">*</span>
              </>
            }
            required
            placeholder="What did the student accomplish today? What concepts did they master?"
            rows={4}
          />

          <FormTextarea
            field={register("homework")}
            label="Homework Assigned"
            placeholder="Practice problems, reading assignments, or tasks to complete before next session"
            rows={3}
          />

          <FormTextarea
            field={register("challenges")}
            label="Challenges & Areas for Improvement"
            placeholder="Topics the student found difficult or needs more practice with"
            rows={3}
          />

          <FormTextarea
            field={register("nextSteps")}
            label="Next Steps & Recommendations"
            placeholder="What should we focus on in the next session? Any recommendations for parents?"
            rows={3}
          />

          {!existingNote && (
            <div className="space-y-2">
              <Label>
                <Upload className="h-4 w-4 inline mr-2" />
                Attach Files (Optional)
              </Label>
              <FileUpload
                onFilesSelected={setSelectedFiles}
                maxFiles={5}
                maxSizeMB={10}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isSubmitting}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Saving..." : existingNote ? "Update Notes" : "Save Notes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
