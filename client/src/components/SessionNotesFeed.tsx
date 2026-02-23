import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Calendar, Clock3 } from "lucide-react";
import { format } from "date-fns";

interface SessionNote {
  id: number;
  tutorName: string | null;
  subscriptionId?: number;
  progressSummary: string | null;
  homework: string | null;
  challenges: string | null;
  nextSteps: string | null;
  createdAt: Date;
  scheduledAt: number;
  studentFirstName?: string | null;
  studentLastName?: string | null;
  courseSubject?: string | null;
  courseTitle?: string | null;
}

interface SessionNotesFeedProps {
  notes: SessionNote[];
}

export function SessionNotesFeed({ notes }: SessionNotesFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Recent Session Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No session notes yet
          </div>
        ) : (
          <div className="space-y-6">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-4 rounded-lg border space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{note.tutorName || 'Tutor'}</h4>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(note.scheduledAt), 'MMM d, yyyy')}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-4 w-4" />
                        {format(new Date(note.scheduledAt), 'h:mm a')}
                      </span>
                      {(note.courseTitle || note.courseSubject) && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {note.courseTitle || note.courseSubject}
                        </span>
                      )}
                      {(note.studentFirstName || note.studentLastName) && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          Student: {[note.studentFirstName, note.studentLastName].filter(Boolean).join(" ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(note.createdAt), 'MMM d')}
                  </div>
                </div>

                {/* Progress Summary */}
                {note.progressSummary && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Notes</h5>
                    <p className="text-sm text-muted-foreground">
                      {note.progressSummary}
                    </p>
                  </div>
                )}

                {/* Homework */}
                {note.homework && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Homework</h5>
                    <p className="text-sm text-muted-foreground">
                      {note.homework}
                    </p>
                  </div>
                )}

                {/* Challenges */}
                {note.challenges && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Challenges</h5>
                    <p className="text-sm text-muted-foreground">
                      {note.challenges}
                    </p>
                  </div>
                )}

                {/* Next Steps */}
                {note.nextSteps && (
                  <div>
                    <h5 className="text-sm font-medium mb-1">Next Steps</h5>
                    <p className="text-sm text-muted-foreground">
                      {note.nextSteps}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
