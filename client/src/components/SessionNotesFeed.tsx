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
          <div className="space-y-4">
            {notes.map((note) => (
              <div key={note.id} className="p-4 sm:p-5 rounded-xl border-l-4 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">{note.tutorName || 'Tutor'}</h4>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-blue-700 dark:text-blue-300 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(note.scheduledAt), 'MMM d, yyyy')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3 w-3" />
                          {format(new Date(note.scheduledAt), 'h:mm a')}
                        </span>
                        {(note.courseTitle || note.courseSubject) && (
                          <span className="rounded-full bg-blue-200 dark:bg-blue-800 px-2 py-0.5 text-xs">
                            {note.courseTitle || note.courseSubject}
                          </span>
                        )}
                        {(note.studentFirstName || note.studentLastName) && (
                          <span className="rounded-full bg-blue-200 dark:bg-blue-800 px-2 py-0.5 text-xs">
                            {[note.studentFirstName, note.studentLastName].filter(Boolean).join(" ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes Content */}
                <div className="pl-4 border-l-2 border-blue-300 dark:border-blue-700 space-y-3">
                  {/* Progress Summary */}
                  {note.progressSummary && (
                    <div>
                      <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Session Summary</h5>
                      <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap break-words">
                        {note.progressSummary}
                      </p>
                    </div>
                  )}

                  {/* Homework */}
                  {note.homework && (
                    <div>
                      <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Homework</h5>
                      <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap break-words">
                        {note.homework}
                      </p>
                    </div>
                  )}

                  {/* Challenges */}
                  {note.challenges && (
                    <div>
                      <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Challenges</h5>
                      <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap break-words">
                        {note.challenges}
                      </p>
                    </div>
                  )}

                  {/* Next Steps */}
                  {note.nextSteps && (
                    <div>
                      <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">Next Steps</h5>
                      <p className="text-sm text-blue-900 dark:text-blue-50 leading-relaxed whitespace-pre-wrap break-words">
                        {note.nextSteps}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
