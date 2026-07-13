import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2, ExternalLink, CheckCircle, AlertTriangle, XCircle, HelpCircle } from "lucide-react";

export default function AcuitySyncPanel() {
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [missingEnabled, setMissingEnabled] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const {
    data: preview,
    isFetching: loadingPreview,
    refetch: loadPreview,
  } = trpc.admin.previewAcuitySync.useQuery(undefined, {
    enabled: previewEnabled,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const {
    data: missingData,
    isFetching: loadingMissing,
    refetch: reloadMissing,
  } = trpc.admin.getMissingAcuitySessions.useQuery(undefined, {
    enabled: missingEnabled,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  const syncMutation = trpc.admin.runAcuitySync.useMutation({
    onSuccess: (result) => {
      toast.success(
        `Sync complete — inserted: ${result.inserted}, updated: ${result.updated}, cancelled: ${result.cancelled}, skipped: ${result.skipped}, ghost deleted: ${result.ghostDeleted}`
      );
      loadPreview();
      if (missingEnabled) reloadMissing();
    },
    onError: (err) => {
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  const syncOneMutation = trpc.admin.syncAcuitySession.useMutation({
    onSuccess: (result) => {
      setSyncingId(null);
      if (result.ok) {
        toast.success(`Session synced (${result.action})`);
      } else {
        toast.error(`Sync failed: ${result.error}`);
      }
      reloadMissing();
    },
    onError: (err) => {
      setSyncingId(null);
      toast.error(`Sync failed: ${err.message}`);
    },
  });

  const syncAllMutation = trpc.admin.syncAllMatchedAcuitySessions.useMutation({
    onSuccess: (r) => {
      toast.success(`Synced ${r.succeeded} session${r.succeeded !== 1 ? "s" : ""}${r.failed > 0 ? `, ${r.failed} failed` : ""}`);
      reloadMissing();
    },
    onError: (err) => toast.error(`Sync all failed: ${err.message}`),
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

  const handleLoadMissing = () => {
    if (!missingEnabled) {
      setMissingEnabled(true);
    } else {
      reloadMissing();
    }
  };

  const readyIds = missingData?.sessions.filter((s) => s.matchStatus === "ready").map((s) => s.acuityId) ?? [];

  const statusCounts = missingData
    ? {
        ready: missingData.sessions.filter((s) => s.matchStatus === "ready").length,
        no_subscription: missingData.sessions.filter((s) => s.matchStatus === "no_subscription").length,
        ambiguous: missingData.sessions.filter((s) => s.matchStatus === "ambiguous").length,
        no_course: missingData.sessions.filter((s) => s.matchStatus === "no_course").length,
      }
    : null;

  return (
    <div className="space-y-6">
      {/* ── Header + action buttons ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Acuity Session Sync</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Preview sessions from Acuity that are missing from the platform, then sync them in one click.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleLoadPreview} disabled={loadingPreview}>
            {loadingPreview ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Load Preview
          </Button>
          <Button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
            {syncMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Sync Now
          </Button>
        </div>
      </div>

      {/* ── Preview section (existing) ── */}
      {preview && (
        <div className="flex gap-3 flex-wrap">
          <Badge variant="secondary" className="text-sm px-3 py-1">{preview.toInsert.length} to add</Badge>
          <Badge variant="secondary" className="text-sm px-3 py-1">{preview.toUpdateCount} to update</Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">{preview.toCancelCount} to cancel</Badge>
          <Badge variant="outline" className="text-sm px-3 py-1">{skippedTotal} skipped</Badge>
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
                      <a href={row.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
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

      {preview && skippedTotal > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Couldn't sync ({skippedTotal}) — fix these to bring them in
          </h3>

          {preview.skipped.unmappedType.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">Unmapped appointment types</p>
              <p className="text-xs text-muted-foreground">Add these Acuity type IDs to APPT_TYPE_TO_COURSE in server/acuity-maps.ts.</p>
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
              <p className="text-xs text-muted-foreground">Add these Acuity calendar IDs to CALENDAR_TO_TUTOR in server/acuity-maps.ts.</p>
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
              <p className="text-sm font-medium">Parent not in platform ({preview.skipped.noParent.length})</p>
              <p className="text-xs text-muted-foreground">These students' parent accounts don't exist yet — create them, then re-sync.</p>
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

      {/* ── Missing Sessions section (new) ── */}
      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Missing Sessions (Registered Parents Only)</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sessions in Acuity that aren't on the platform — with subscription match status.
              {missingData && (
                <span className="ml-1 text-xs text-muted-foreground">
                  Last loaded: {new Date(missingData.fetchedAt).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleLoadMissing} disabled={loadingMissing}>
              {loadingMissing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {missingEnabled ? "Reload" : "Load Missing Sessions"}
            </Button>
            {readyIds.length > 0 && (
              <Button
                onClick={() => syncAllMutation.mutate({ acuityIds: readyIds })}
                disabled={syncAllMutation.isPending}
              >
                {syncAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Sync All Matched ({readyIds.length})
              </Button>
            )}
          </div>
        </div>

        {/* Summary badges */}
        {statusCounts && (
          <div className="flex gap-3 flex-wrap">
            {statusCounts.ready > 0 && (
              <Badge className="bg-green-100 text-green-800 border-green-200 text-sm px-3 py-1">
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                {statusCounts.ready} ready to sync
              </Badge>
            )}
            {statusCounts.no_subscription > 0 && (
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-sm px-3 py-1">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                {statusCounts.no_subscription} no active subscription
              </Badge>
            )}
            {statusCounts.ambiguous > 0 && (
              <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-sm px-3 py-1">
                <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                {statusCounts.ambiguous} ambiguous match
              </Badge>
            )}
            {statusCounts.no_course > 0 && (
              <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-sm px-3 py-1">
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
                {statusCounts.no_course} type not mapped
              </Badge>
            )}
          </div>
        )}

        {/* Missing sessions table */}
        {missingData && missingData.sessions.length === 0 && !loadingMissing && (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            No missing sessions for registered parents in the sync window.
          </p>
        )}

        {missingData && missingData.sessions.length > 0 && (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Tutor</th>
                  <th className="px-4 py-3 text-left font-medium">Student</th>
                  <th className="px-4 py-3 text-left font-medium">Date & Time (IST)</th>
                  <th className="px-4 py-3 text-left font-medium">Course</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {missingData.sessions.map((row) => (
                  <tr key={row.acuityId} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-3 whitespace-nowrap">{row.tutorName}</td>
                    <td className="px-4 py-3">
                      <div>{row.studentName}</div>
                      <div className="text-xs text-muted-foreground">{row.parentEmail}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{row.scheduledAtIst}</td>
                    <td className="px-4 py-3">
                      {row.courseName ? (
                        <div>
                          <div>{row.courseName}</div>
                          <div className="text-xs text-muted-foreground">{row.appointmentTypeName}</div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground text-xs">{row.appointmentTypeName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.matchStatus === "ready" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle className="h-3 w-3" /> Ready
                        </span>
                      )}
                      {row.matchStatus === "no_subscription" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                          <AlertTriangle className="h-3 w-3" /> No subscription
                        </span>
                      )}
                      {row.matchStatus === "ambiguous" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700 bg-orange-50 px-2 py-1 rounded-full">
                          <HelpCircle className="h-3 w-3" /> Multiple subscriptions
                        </span>
                      )}
                      {row.matchStatus === "no_course" && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                          <XCircle className="h-3 w-3" /> Type not mapped
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={row.matchStatus !== "ready" || syncingId === row.acuityId || syncAllMutation.isPending}
                        onClick={() => {
                          setSyncingId(row.acuityId);
                          syncOneMutation.mutate({ acuityAppointmentId: row.acuityId });
                        }}
                      >
                        {syncingId === row.acuityId ? <Loader2 className="h-3 w-3 animate-spin" /> : "Sync"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!missingData && !loadingMissing && (
          <p className="text-sm text-muted-foreground py-8 text-center border rounded-lg">
            Click "Load Missing Sessions" to check what's in Acuity but not on the platform.
          </p>
        )}
      </div>
    </div>
  );
}
