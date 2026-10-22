/**
 * Room overlap helper
 *
 * The transcript name check exists to stop another class in the same Zoom room
 * from being attached to the wrong session. That can only happen when two
 * sessions use the same Zoom room at around the same time.
 *
 * So if NO other active session uses this Zoom room within the window, the recording
 * found for the time slot can only be this class, and the name check isn't needed
 * (families often join under names that look nothing like the student's).
 *
 * If anything goes wrong, this returns true ("there is an overlap"), which keeps the
 * strict name check in place.
 */

import { sql } from "drizzle-orm";

export async function hasOverlappingSession(
  database: any,
  opts: {
    meetingId: string;
    sessionId: number | string;
    scheduledAtMs: number;
    /** Sessions starting less than this far apart are treated as overlapping. Default 60 min. */
    windowMs?: number;
  }
): Promise<boolean> {
  const windowMs = opts.windowMs ?? 60 * 60 * 1000;

  try {
    const result: any = await database.execute(sql`
      SELECT COUNT(*) AS c
      FROM sessions
      WHERE id <> ${opts.sessionId}
        AND status <> 'cancelled'
        AND meetingUrl LIKE ${"%/j/" + String(opts.meetingId) + "%"}
        AND ABS(scheduledAt - ${opts.scheduledAtMs}) < ${windowMs}
    `);

    const rows: any[] = Array.isArray(result)
      ? Array.isArray(result[0])
        ? result[0]
        : result
      : result?.rows ?? [];

    const count = Number(rows?.[0]?.c ?? 0);
    return count > 0;
  } catch (err) {
    console.error("[hasOverlappingSession] query failed, keeping strict name check:", err);
    return true;
  }
}