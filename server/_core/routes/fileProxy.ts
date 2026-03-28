/**
 * File Proxy — streams S3 course files through the server.
 *
 * Security model:
 * - S3 URLs and keys are never sent to the client
 * - Every request is authenticated (JWT cookie) and authorized (DB role check)
 * - Rate limited per authenticated user (not per IP)
 * - Filename sanitized to prevent header injection
 * - S3 stream is cleaned up on client abort
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { authenticateRequest } from "../services/authService";
import { ENV } from "../env";
import * as db from "../../db";

export const fileProxyRouter = express.Router();

// ── S3 client (singleton) ────────────────────────────────────────────────────

let _s3: S3Client | null = null;
function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: ENV.awsS3Region,
      credentials: {
        accessKeyId: ENV.awsAccessKeyId,
        secretAccessKey: ENV.awsSecretAccessKey,
      },
    });
  }
  return _s3;
}

// ── Auth middleware ──────────────────────────────────────────────────────────
// Runs BEFORE the rate limiter so userId is available for keying.

async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    (req as any).user = user;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

// ── Rate limiter (per authenticated user) ────────────────────────────────────
// Keyed by userId — set by requireAuth above, which runs first.
// 60 requests per minute is generous for normal use; a single user downloading
// the same file repeatedly will still hit this.

const fileLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => String((req as any).user?.id ?? req.ip),
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const PREVIEWABLE = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

/**
 * Sanitize a filename for use in Content-Disposition.
 * Removes characters that could break the header or inject new headers.
 */
function safeFilename(name: string): string {
  // Strip anything that isn't safe in a quoted filename parameter
  return name.replace(/["\r\n\\]/g, "_");
}

// ── Route ────────────────────────────────────────────────────────────────────

// Middleware order matters: auth → rate limit → handler
fileProxyRouter.get("/:fileId", requireAuth, fileLimiter, async (req, res) => {
  const user = (req as any).user;

  try {
    // 1. Validate fileId — numeric only, prevents trivial probing with strings
    const fileId = parseInt(req.params.fileId, 10);
    if (isNaN(fileId) || fileId <= 0) {
      return res.status(400).json({ error: "Invalid file ID" });
    }

    // 2. Fetch file record — S3 key comes from DB, never from the client
    const fileRecord = await db.getCourseFileById(fileId);
    if (!fileRecord) return res.status(404).json({ error: "File not found" });

    // 3. Authorize — role-based check (admin / tutor assigned / parent assigned)
    const hasAccess = await db.userHasAccessToCourseFile(user.id, user.role, fileRecord.id);
    if (!hasAccess) {
      console.warn(`[fileProxy] Unauthorized access attempt — userId=${user.id} fileId=${fileId}`);
      return res.status(403).json({ error: "Forbidden" });
    }

    // 4. Log access for audit trail
    console.info(`[fileProxy] Access — userId=${user.id} role=${user.role} fileId=${fileId}`);

    // 5. Build S3 command — pass Range header through for PDF seek support
    const range = req.headers.range;
    const command = new GetObjectCommand({
      Bucket: ENV.awsS3Bucket,
      Key: fileRecord.fileKey,
      ...(range ? { Range: range } : {}),
    });

    const s3Response = await getS3().send(command);

    // 6. Determine Content-Disposition:
    //    inline  → browser renders it (PDF, images)
    //    attachment → browser downloads it (Word, etc.)
    const mimeType = s3Response.ContentType ?? "application/octet-stream";
    const disposition = PREVIEWABLE.has(mimeType) ? "inline" : "attachment";
    const filename = safeFilename(fileRecord.fileName);

    // 7. Set response headers
    const status = range && s3Response.ContentRange ? 206 : 200;
    res.status(status);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Accept-Ranges", "bytes"); // tells browser it can send Range requests
    res.setHeader("Cache-Control", "private, max-age=3600, immutable");
    if (s3Response.ContentLength) res.setHeader("Content-Length", s3Response.ContentLength);
    if (s3Response.ContentRange) res.setHeader("Content-Range", s3Response.ContentRange);

    // 8. Stream S3 body to client with proper cleanup
    const stream = s3Response.Body as Readable;

    // Clean up the S3 stream if the client disconnects early (saves S3 bandwidth)
    req.on("close", () => {
      if (!res.writableEnded) stream.destroy();
    });

    // Surface stream errors without crashing the process
    stream.on("error", (err) => {
      console.error("[fileProxy] Stream error:", err);
      if (!res.headersSent) res.status(500).json({ error: "Stream failed" });
      else res.destroy();
    });

    stream.pipe(res);
  } catch (err) {
    console.error("[fileProxy] Error:", err);
    if (!res.headersSent) res.status(500).json({ error: "Failed to proxy file" });
  }
});
