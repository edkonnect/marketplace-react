import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, ExternalLink } from "lucide-react";

export default function AcuitySyncPanel() {
  const [previewEnabled, setPreviewEnabled] = useState(false);

  const {
    data: preview,
    isFetching: loadingPreview,
    refetch: loadPreview,
  } = trpc.admin.previewAcuitySync.useQuery(undefined, {
    enabled: previewEnabled,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const syncMutation = trpc.admin.runAcuitySync.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Sync complete — inserted: ${result.inserted}, updated: ${result.updated}, cancelled: ${result.cancelled}, skipped: ${result.skipped}, ghost deleted: ${result.ghostDeleted}`
      );
      // Refresh preview after sync
      loadPreview();
    },
    onError: (err) => {
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  const skippedTotal = preview
    ? preview.skipped.noParent.length +
      preview.skipped.unmappedCalendar.reduce((s, x) => s + x.count, 0) +
      preview.skipped.unmappedType.reduce((s, x) => s + x.count, 0)
    : 0;

  const handleLoadPreview = () => {
    if (!previewEnabled) {
      setPreviewEnabled(true);
    } else {
      loadPreview();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Acuity Session Sync</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Preview sessions from Acuity that are missing from the platform, then sync them in one click.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleLoadPreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Load Preview
          </Button>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>
      </div>

      {preview && (
        <div className="flex gap-3 flex-wrap">
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {preview.toInsert.length} to add
          </Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {preview.toUpdateCount} to update
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {preview.toCancelCount} to cancel
          </Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">
            {skippedTotal} skipped
          </Badge>
        </div>
      )}

      {preview && preview.toInsert.length === 0 && !loadingPreview && (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          No missing sessions found. Platform is in sync with Acuity.
        </p>
      )}

      {preview && preview.toInsert.length > 0 && (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Tutor ID</th>
                <th className="px-4 py-3 text-left font-medium">Student</th>
                <th className="px-4 py-3 text-left font-medium">Date & Time (IST)</th>
                <th className="px-4 py-3 text-left font-medium">Duration</th>
                <th className="px-4 py-3 text-left font-medium">Course ID</th>
                <th className="px-4 py-3 text-left font-medium">Zoom</th>
              </tr>
            </thead>
            <tbody>
              {preview.toInsert.map((row) => (
                <tr key={row.acuityId} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">{row.tutorId}</td>
                  <td className="px-4 py-3">
                    <div>{row.studentName}</div>
                    <div className="text-xs text-muted-foreground">{row.parentEmail}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.scheduledAtIst}</td>
                  <td className="px-4 py-3">{row.durationMin} min</td>
                  <td className="px-4 py-3">{row.courseId ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    {row.meetingUrl ? (
                      <a
                        href={row.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                      >
                        Zoom <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Why sessions can't sync — actionable lists for the admin to fix */}
      {preview && skippedTotal > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Couldn't sync ({skippedTotal}) — fix these to bring them in
          </h3>

          {preview.skipped.unmappedType.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Unmapped appointment types</p>
              <p className="text-xs text-muted-foreground">
                Add these Acuity type IDs to APPT_TYPE_TO_COURSE in server/acuity-maps.ts.
              </p>
              <ul className="text-sm space-y-1">
                {preview.skipped.unmappedType.map((t) => (
                  <li key={t.typeID} className="flex gap-2">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{t.typeID}</span>
                    <span>{t.typeName || "(unknown name)"}</span>
                    <span className="text-muted-foreground">· {t.count} session{t.count === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.skipped.unmappedCalendar.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Unmapped tutor calendars</p>
              <p className="text-xs text-muted-foreground">
                Add these Acuity calendar IDs to CALENDAR_TO_TUTOR in server/acuity-maps.ts.
              </p>
              <ul className="text-sm space-y-1">
                {preview.skipped.unmappedCalendar.map((c) => (
                  <li key={c.calendarID} className="flex gap-2">
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{c.calendarID}</span>
                    <span className="text-muted-foreground">{c.count} session{c.count === 1 ? "" : "s"}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.skipped.noParent.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">
                Parent not in platform ({preview.skipped.noParent.length})
              </p>
              <p className="text-xs text-muted-foreground">
                These students' parent accounts don't exist yet — create them, then re-sync.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="px-2 py-1.5 text-left font-medium">Student</th>
                      <th className="px-2 py-1.5 text-left font-medium">Parent email(s)</th>
                      <th className="px-2 py-1.5 text-left font-medium">When (IST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.skipped.noParent.slice(0, 100).map((p, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1.5">{p.student}</td>
                        <td className="px-2 py-1.5 text-xs">{p.emails}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{p.whenIst}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!preview && !loadingPreview && (
        <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
          Click "Load Preview" to see which Acuity sessions are missing from the platform.
        </p>
      )}
    </div>
  );
}
