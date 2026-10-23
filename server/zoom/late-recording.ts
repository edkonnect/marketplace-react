/**
 * Late / early recording finder
 *
 * findRecordingUuidBySessionTime only looks 30 minutes either side of the scheduled
 * start. When a class actually starts later or earlier than that (for example it ran an
 * hour late), no recording is found and the tutor sees "No recording found".
 *
 * This helper is the fallback. It looks up to 90 minutes either side in the same Zoom
 * room, but it only accepts a recording if the student's or parent's name is actually in
 * the transcript, so a neighbouring class is never attached by mistake.
 *
 * It returns null whenever it cannot be sure, so the caller shows the usual error.
 */

import { getZoomAccessToken, listZoomRecordings, fetchZoomTranscript } from "./zoom-service";
import type { ZoomRecording } from "./zoom-service";
import { checkTranscriptMatchesSession } from "./recording-match";

const ZOOM_API_BASE_URL = "https://api.zoom.us/v2";

export type LateRecordingMatch = {
  uuid: string;
  startTime: string;
  minutesFromSession: number;
  hit: string | null;
};

export async function findLateRecordingByNames(opts: {
  meetingId: string;
  sessionStartMs: number;
  /** Student first/last name, parent name, parent email name, etc. */
  names: Array<string | null | undefined>;
  /** How far either side of the scheduled start to look. Default 90 min. */
  windowMs?: number;
  /** How many candidate recordings to read transcripts for. Default 3. */
  maxCandidates?: number;
  /** Return true to skip a recording already linked to a different session. */
  isUuidTaken?: (uuid: string) => Promise<boolean>;
}): Promise<LateRecordingMatch | null> {
  const windowMs = opts.windowMs ?? 90 * 60 * 1000;
  const maxCandidates = opts.maxCandidates ?? 3;

  try {
    // Find the host of this Zoom room so we can list its recordings
    const accessToken = await getZoomAccessToken();
    let userId = "me";
    const infoRes = await fetch(`${ZOOM_API_BASE_URL}/meetings/${opts.meetingId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (infoRes.ok) {
      const info = await infoRes.json();
      if (info.host_email) userId = info.host_email;
    }

    // List the host's recordings around the session date
    const from = new Date(opts.sessionStartMs - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const to = new Date(opts.sessionStartMs + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const all: ZoomRecording[] = [];
    let nextPageToken: string | undefined;
    do {
      const res = await listZoomRecordings({ userId, from, to, pageSize: 100, nextPageToken });
      all.push(...res.meetings);
      nextPageToken = res.next_page_token || undefined;
    } while (nextPageToken);

    // Keep this room's recordings within the window, closest first
    const candidates = all
      .filter((m) => String(m.id) === String(opts.meetingId))
      .map((m) => ({ rec: m, diffMs: new Date(m.start_time).getTime() - opts.sessionStartMs }))
      .filter((c) => Math.abs(c.diffMs) <= windowMs)
      .sort((a, b) => Math.abs(a.diffMs) - Math.abs(b.diffMs))
      .slice(0, maxCandidates);

    for (const { rec, diffMs } of candidates) {
      try {
        if (opts.isUuidTaken && (await opts.isUuidTaken(rec.uuid))) continue;

        const transcriptData = await fetchZoomTranscript(rec.uuid);
        const match = checkTranscriptMatchesSession(transcriptData.transcript, opts.names);

        // No usable names means nothing to verify against: never accept
        if (match.unverifiable) return null;

        if (match.ok) {
          return {
            uuid: rec.uuid,
            startTime: rec.start_time,
            minutesFromSession: Math.round(diffMs / 60000),
            hit: match.hit,
          };
        }
      } catch (err) {
        console.warn(`[late-recording] Skipping uuid=${rec.uuid}:`, err instanceof Error ? err.message : err);
      }
    }

    return null;
  } catch (err) {
    console.error("[late-recording] Lookup failed:", err);
    return null;
  }
}