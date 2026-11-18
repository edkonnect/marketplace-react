import { Router } from "express";
import { Readable } from "node:stream";
import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { sessions } from "../../drizzle/schema";
import { getZoomAccessToken, getZoomRecording } from "./zoom-service";
import { verifiedRecordingUuid } from "../ai/parentChatbot";
import { authenticateRequest } from "../_core/services/authService";

// Streams a session's recording video to the logged-in parent who owns the session.
// The Zoom link and passcode are never sent to the browser.
const fileCache = new Map<string, { at: number; url: string }>();
const FILE_CACHE_MS = 10 * 60 * 1000;

async function getVideoUrl(uuid: string): Promise<string | null> {
  const cached = fileCache.get(uuid);
  if (cached && Date.now() - cached.at < FILE_CACHE_MS) return cached.url;
  const rec = await getZoomRecording(uuid);
  const mp4s = (rec.recording_files || []).filter((f) => f.file_type === "MP4" && f.status === "completed");
  const pick = mp4s.find((f) => String(f.recording_type).startsWith("shared_screen")) || mp4s[0];
  if (!pick) return null;
  fileCache.set(uuid, { at: Date.now(), url: pick.download_url });
  return pick.download_url;
}

export const recordingStreamRouter = Router();

recordingStreamRouter.get("/:sessionId", async (req, res) => {
  try {
    const sessionId = Number(req.params.sessionId);
    if (!Number.isInteger(sessionId)) return res.status(400).end();

    let user: any = null;
    try { user = await authenticateRequest(req); } catch { user = null; }
    if (!user || (user.role !== "parent" && user.role !== "admin")) return res.status(401).end();

    const db = await getDb();
    if (!db) return res.status(500).end();

    if (user.role === "parent") {
      const own = await db
        .select({ id: sessions.id })
        .from(sessions)
        .where(and(eq(sessions.id, sessionId), eq(sessions.parentId, user.id)))
        .limit(1);
      if (own.length === 0) return res.status(404).end();
    }

    const uuid = await verifiedRecordingUuid(db, sessionId);
    if (!uuid) return res.status(404).end();
    const videoUrl = await getVideoUrl(uuid);
    if (!videoUrl) return res.status(404).end();

    const token = await getZoomAccessToken();
    const headers: Record<string, string> = { Authorization: "Bearer " + token };
    if (req.headers.range) headers.Range = String(req.headers.range);
    const upstream = await fetch(videoUrl, { headers });
    if ((!upstream.ok && upstream.status !== 206) || !upstream.body) return res.status(502).end();

    res.status(upstream.status);
    for (const h of ["content-length", "content-range"]) {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");

    const body = Readable.fromWeb(upstream.body as any);
    req.on("close", () => body.destroy());
    body.pipe(res);
  } catch (err) {
    console.warn("[recording-stream] failed:", String((err as Error)?.message ?? err).slice(0, 160));
    if (!res.headersSent) res.status(500).end();
  }
});
