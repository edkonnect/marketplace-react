/**
 * S3 storage helpers for profile image upload/delete.
 *
 * In production: uploads to AWS S3 and returns a public object URL.
 * In local dev (no S3 creds): saves to uploads/ via the local dev shim
 *   and returns a localhost URL — no AWS account needed for development.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";
import path from "path";
import fs from "fs";
import crypto from "crypto";

// ── S3 client (lazily created only when creds are present) ──────────────────

let _s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: ENV.awsS3Region,
      credentials: {
        accessKeyId: ENV.awsAccessKeyId,
        secretAccessKey: ENV.awsSecretAccessKey,
      },
    });
  }
  return _s3Client;
}

function hasS3Credentials(): boolean {
  return !!(ENV.awsAccessKeyId && ENV.awsSecretAccessKey && ENV.awsS3Bucket);
}

// ── Local dev fallback ───────────────────────────────────────────────────────

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

function saveLocally(key: string, buffer: Buffer, _mimeType: string): string {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const safeFileName = key.replace(/\//g, "_");
  const destPath = path.join(UPLOADS_DIR, safeFileName);
  fs.writeFileSync(destPath, buffer);
  // Return a localhost URL; the static middleware serves /uploads/*
  const baseUrl = ENV.forgeApiUrl || "http://localhost:3000";
  return `${baseUrl}/uploads/${encodeURIComponent(safeFileName)}`;
}

function deleteLocally(key: string): void {
  try {
    const safeFileName = key.replace(/\//g, "_");
    const filePath = path.join(UPLOADS_DIR, safeFileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Upload an image buffer to S3 (prod) or local uploads/ (dev).
 *
 * @param buffer  Raw image bytes
 * @param mimeType  e.g. "image/jpeg"
 * @param userId  Used to build the S3 key: profile-images/<userId>/<uuid>.jpg
 * @returns  Public URL of the uploaded image
 */
export async function uploadProfileImageToS3(
  buffer: Buffer,
  mimeType: string,
  userId: number
): Promise<string> {
  const ext = mimeType === "image/png" ? "png" : "jpg";
  const uuid = crypto.randomUUID();
  const key = `profile-images/${userId}/${uuid}.${ext}`;

  console.log(`[s3Storage] uploadProfileImageToS3 called — userId=${userId}, mimeType=${mimeType}, bufferSize=${buffer.length}`);
  console.log(`[s3Storage] hasS3Credentials=${hasS3Credentials()}, bucket="${ENV.awsS3Bucket}", region="${ENV.awsS3Region}", keyId="${ENV.awsAccessKeyId ? ENV.awsAccessKeyId.slice(0, 8) + '...' : 'MISSING'}"`);

  if (hasS3Credentials()) {
    console.log(`[s3Storage] Uploading to S3 key: ${key}`);
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: ENV.awsS3Bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // No ACL — public read is granted via bucket policy on profile-images/*
      })
    );
    const url = `https://${ENV.awsS3Bucket}.s3.${ENV.awsS3Region}.amazonaws.com/${key}`;
    console.log(`[s3Storage] Upload successful: ${url}`);
    return url;
  }

  // Local dev fallback
  console.log("[s3Storage] No S3 credentials — saving to local uploads/");
  return saveLocally(key, buffer, mimeType);
}

/**
 * Delete a profile image from S3 (prod) or local uploads/ (dev).
 * Silently ignores errors so a failed delete never blocks the user.
 *
 * @param imageUrl  The URL previously returned by uploadProfileImageToS3
 */
export async function deleteProfileImageFromS3(
  imageUrl: string
): Promise<void> {
  try {
    if (hasS3Credentials()) {
      // Extract the S3 key from the URL
      // URL format: https://<bucket>.s3.<region>.amazonaws.com/<key>
      const url = new URL(imageUrl);
      const key = url.pathname.replace(/^\//, "");
      if (!key) return;
      await getS3Client().send(
        new DeleteObjectCommand({ Bucket: ENV.awsS3Bucket, Key: key })
      );
    } else {
      // Local dev: extract filename from URL
      const url = new URL(imageUrl);
      const fileName = decodeURIComponent(path.basename(url.pathname));
      // Convert flat filename back to key
      const key = fileName.replace(/_/g, "/"); // rough reverse — enough for cleanup
      deleteLocally(key);
    }
  } catch (err) {
    console.error("[s3Storage] Delete failed (non-fatal):", err);
  }
}
