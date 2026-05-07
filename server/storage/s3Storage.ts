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
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "../_core/env";
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

  if (hasS3Credentials()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: ENV.awsS3Bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        // No ACL — public read is granted via bucket policy on profile-images/*
      })
    );
    return `https://${ENV.awsS3Bucket}.s3.${ENV.awsS3Region}.amazonaws.com/${key}`;
  }

  // Local dev fallback
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

/**
 * Upload a course file (PDF or Word doc) to S3.
 * S3 only — the existing bucket is always available in all environments.
 *
 * @param buffer  Raw file bytes
 * @param mimeType  e.g. "application/pdf"
 * @param originalFileName  Original filename, used to derive the extension
 * @returns  { url, key } — public S3 URL and the key needed for later deletion
 */
export async function uploadCourseFileToS3(
  buffer: Buffer,
  mimeType: string,
  originalFileName: string
): Promise<{ url: string; key: string }> {
  const ext = originalFileName.split(".").pop()?.toLowerCase() ?? "bin";
  const uuid = crypto.randomUUID();
  const key = `course-files/${uuid}.${ext}`;

  if (hasS3Credentials()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: ENV.awsS3Bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return {
      url: `https://${ENV.awsS3Bucket}.s3.${ENV.awsS3Region}.amazonaws.com/${key}`,
      key,
    };
  }

  // Local dev fallback
  const url = saveLocally(key, buffer, mimeType);
  return { url, key };
}

/**
 * Upload a messaging attachment to S3.
 * Same pattern as uploadCourseFileToS3 but stored under message-files/ prefix.
 */
export async function uploadMessageFileToS3(
  buffer: Buffer,
  mimeType: string,
  originalFileName: string
): Promise<{ url: string; key: string }> {
  const ext = originalFileName.split(".").pop()?.toLowerCase() ?? "bin";
  const uuid = crypto.randomUUID();
  const key = `message-files/${uuid}.${ext}`;

  if (hasS3Credentials()) {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: ENV.awsS3Bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return {
      url: `https://${ENV.awsS3Bucket}.s3.${ENV.awsS3Region}.amazonaws.com/${key}`,
      key,
    };
  }

  // Local dev fallback
  const url = saveLocally(key, buffer, mimeType);
  return { url, key };
}

/**
 * Delete a course file from S3 using its stored key.
 * Silently ignores errors so a failed delete never blocks the user.
 *
 * @param fileKey  The S3 key previously returned by uploadCourseFileToS3
 */
export async function deleteCourseFileFromS3(fileKey: string): Promise<void> {
  try {
    if (hasS3Credentials()) {
      await getS3Client().send(
        new DeleteObjectCommand({ Bucket: ENV.awsS3Bucket, Key: fileKey })
      );
    } else {
      deleteLocally(fileKey);
    }
  } catch (err) {
    console.error("[s3Storage] Course file delete failed (non-fatal):", err);
  }
}

/**
 * Generate a presigned PUT URL so the browser can upload a course file
 * directly to S3 without passing through the server.
 * Returns { uploadUrl, key, fileUrl } — uploadUrl is used by the browser,
 * fileUrl is the public S3 URL to store in the DB after upload completes.
 * Returns null in local dev (falls back to base64 upload path).
 */
export async function getCourseFileUploadPresignedUrl(
  originalFileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; key: string; fileUrl: string } | null> {
  if (!hasS3Credentials()) return null;
  const ext = originalFileName.split(".").pop()?.toLowerCase() ?? "bin";
  const uuid = crypto.randomUUID();
  const key = `course-files/${uuid}.${ext}`;
  const uploadUrl = await getSignedUrl(
    getS3Client(),
    new PutObjectCommand({ Bucket: ENV.awsS3Bucket, Key: key, ContentType: mimeType }),
    { expiresIn: 300 } // 5 minutes to complete the upload
  );
  const fileUrl = `https://${ENV.awsS3Bucket}.s3.${ENV.awsS3Region ?? "us-east-1"}.amazonaws.com/${key}`;
  return { uploadUrl, key, fileUrl };
}

/**
 * Generate a pre-signed URL for a course file (valid for 1 hour).
 * Falls back to the original URL in local dev.
 */
export async function getCourseFilePresignedUrl(fileKey: string, originalUrl: string): Promise<string> {
  if (!hasS3Credentials()) return originalUrl;
  return await getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: ENV.awsS3Bucket, Key: fileKey }),
    { expiresIn: 3600 }
  );
}
