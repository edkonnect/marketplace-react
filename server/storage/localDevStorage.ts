/**
 * Local development storage shim.
 *
 * Mimics the Forge storage proxy API so that file uploads work in dev without
 * real cloud credentials.  Files are written to <project-root>/uploads/ and
 * served back at /uploads/<key>.
 *
 * This module is ONLY activated in development mode.
 */

import express, { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export function createLocalDevStorageRouter(baseUrl: string): Router {
  const router = Router();

  // POST /v1/storage/upload?path=<key>
  router.post("/v1/storage/upload", (req, res) => {
    const rawPath = (req.query.path as string) || "";
    if (!rawPath) {
      return res.status(400).json({ error: "Missing path query param" });
    }

    // Prevent path traversal
    const safePath = rawPath.replace(/\.\.[/\\]/g, "").replace(/^[/\\]+/, "");
    const destPath = path.join(UPLOADS_DIR, safePath.replace(/\//g, "_"));

    // Multer / busboy is heavy — use a simpler approach: read raw body.
    // express.json() / urlencoded won't handle multipart, so we read the
    // raw request buffer and extract the file part manually via a very
    // simple boundary parser.
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks);
        const contentType = req.headers["content-type"] || "";
        const boundaryMatch = contentType.match(/boundary=(.+)$/i);

        let fileBuffer: Buffer;

        if (boundaryMatch) {
          // Multipart: extract the file part
          const boundary = "--" + boundaryMatch[1];
          const boundaryBuf = Buffer.from(boundary);
          const start = indexOf(body, boundaryBuf);
          if (start === -1) {
            return res.status(400).json({ error: "Invalid multipart body" });
          }
          // Find the double CRLF that ends the part headers
          const headerEnd = indexOf(body, Buffer.from("\r\n\r\n"), start);
          if (headerEnd === -1) {
            return res.status(400).json({ error: "Malformed multipart headers" });
          }
          const fileStart = headerEnd + 4;
          // Find closing boundary
          const closingBoundary = Buffer.from("\r\n" + boundary + "--");
          const fileEnd = indexOf(body, closingBoundary, fileStart);
          fileBuffer = fileEnd !== -1
            ? body.slice(fileStart, fileEnd)
            : body.slice(fileStart);
        } else {
          // Raw body (fallback)
          fileBuffer = body;
        }

        // Ensure parent dirs exist
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(destPath, fileBuffer);

        const fileName = path.basename(destPath);
        const fileUrl = `${baseUrl}/uploads/${encodeURIComponent(fileName)}`;
        return res.json({ url: fileUrl, key: safePath });
      } catch (err) {
        console.error("[LocalDevStorage] Upload error:", err);
        return res.status(500).json({ error: "Upload failed" });
      }
    });
    req.on("error", (err) => {
      console.error("[LocalDevStorage] Request error:", err);
      res.status(500).json({ error: "Upload failed" });
    });
  });

  // GET /v1/storage/downloadUrl?path=<key>
  router.get("/v1/storage/downloadUrl", (req, res) => {
    const rawPath = (req.query.path as string) || "";
    if (!rawPath) {
      return res.status(400).json({ error: "Missing path query param" });
    }
    const safePath = rawPath.replace(/\.\.[/\\]/g, "").replace(/^[/\\]+/, "");
    const fileName = safePath.replace(/\//g, "_");
    const fileUrl = `${baseUrl}/uploads/${encodeURIComponent(fileName)}`;
    return res.json({ url: fileUrl, key: safePath });
  });

  return router;
}

// Serve uploaded files statically
export function createLocalDevStaticRouter(): Router {
  const router = Router();
  router.use("/uploads", express.static(UPLOADS_DIR));
  return router;
}

// Helper: find needle in haystack Buffer
function indexOf(haystack: Buffer, needle: Buffer, offset = 0): number {
  for (let i = offset; i <= haystack.length - needle.length; i++) {
    let found = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { found = false; break; }
    }
    if (found) return i;
  }
  return -1;
}
