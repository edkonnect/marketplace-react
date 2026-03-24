import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

interface TutorAssignmentDialogProps {
  courseId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function TutorAssignmentDialog({
  courseId,
  isOpen,
  onClose,
}: TutorAssignmentDialogProps) {
  const [selectedTutors, setSelectedTutors] = useState<Set<number>>(new Set());
  const [primaryTutor, setPrimaryTutor] = useState<number | null>(null);

  const { data: tutors } = trpc.adminCourses.getAllTutorsForAssignment.useQuery(undefined, {
    enabled: isOpen,
  });

  const { data: assignments, refetch: refetchAssignments } =
    trpc.adminCourses.getCourseAssignments.useQuery(
      { courseId: courseId! },
      { enabled: isOpen && courseId !== null }
    );

  const assignMutation = trpc.adminCourses.assignCourseToTutor.useMutation({
    onSuccess: () => {
      toast.success("Tutor assigned successfully!");
      refetchAssignments();
    },
    onError: (error: any) => {
      toast.error(`Failed to assign tutor: ${error.message}`);
    },
  });

  const unassignMutation = trpc.adminCourses.unassignCourseFromTutor.useMutation({
    onSuccess: () => {
      toast.success("Tutor unassigned successfully!");
      refetchAssignments();
    },
    onError: (error: any) => {
      toast.error(`Failed to unassign tutor: ${error.message}`);
    },
  });

  // Reset state when dialog opens for a different course
  useEffect(() => {
    if (!isOpen) {
      setSelectedTutors(new Set());
      setPrimaryTutor(null);
    }
  }, [isOpen, courseId]);

  // Initialize selected tutors from assignments
  useEffect(() => {
    if (assignments) {
      const assigned = new Set<number>(assignments.map((a: any) => a.tutorId));
      setSelectedTutors(assigned);
      const primary = assignments.find((a: any) => a.isPrimary);
      setPrimaryTutor(primary?.tutorId || null);
    } else if (isOpen && courseId !== null) {
      // Reset while loading new course assignments
      setSelectedTutors(new Set());
      setPrimaryTutor(null);
    }
  }, [assignments, isOpen, courseId]);

  const handleTutorToggle = (tutorId: number) => {
    if (courseId === null) return;

    const isCurrentlyAssigned = selectedTutors.has(tutorId);

    if (isCurrentlyAssigned) {
      // Unassign
      unassignMutation.mutate({
        courseId,
        tutorId,
      });
      const newSelected = new Set(selectedTutors);
      newSelected.delete(tutorId);
      setSelectedTutors(newSelected);
      if (primaryTutor === tutorId) {
        setPrimaryTutor(null);
      }
    } else {
      // Assign
      assignMutation.mutate({
        courseId,
        tutorId,
        isPrimary: false,
      });
      setSelectedTutors(new Set(selectedTutors).add(tutorId));
    }
  };

  const handleSetPrimary = (tutorId: number) => {
    if (courseId === null) return;

    assignMutation.mutate({
      courseId,
      tutorId,
      isPrimary: true,
    });
    setPrimaryTutor(tutorId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assign Tutors to Course</DialogTitle>
          <DialogDescription>
            Select tutors to assign to this course. Mark one as primary.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {tutors && tutors.length > 0 ? (
            tutors.map((tutor: any) => {
              const isAssigned = selectedTutors.has(tutor.id);
              const isPrimary = primaryTutor === tutor.id;

              return (
                <div
                  key={tutor.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isAssigned}
                      onCheckedChange={() => handleTutorToggle(tutor.id)}
                    />
                    <div>
                      <div className="font-medium">{tutor.name}</div>
                      <div className="text-sm text-muted-foreground">{tutor.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPrimary && <Badge>Primary</Badge>}
                    {isAssigned && !isPrimary && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSetPrimary(tutor.id)}
                      >
                        Set as Primary
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center text-muted-foreground py-8">
              No tutors available
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {selectedTutors.size} tutor(s) assigned
          </div>
          <Button onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
