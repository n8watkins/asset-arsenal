/**
 * Cloudflare R2 storage via the S3-compatible API.
 *
 * The S3 client is built lazily inside getR2() — never at module load — so the
 * app runs without R2 credentials. Guard callers with features.storage.
 *
 * Object key layout (storageKeys):
 *   users/{userId}/runs/{runId}/source.png
 *   users/{userId}/runs/{runId}/collection.png
 *   users/{userId}/runs/{runId}/icons/{iconId}.png
 *   users/{userId}/runs/{runId}/exports/icon-pack.zip
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv, requireEnv } from "@/lib/env";

let _r2: S3Client | null = null;

/** Lazily build the R2 (S3-compatible) client. */
export function getR2(): S3Client {
  if (_r2) return _r2;
  const accountId = requireEnv("R2_ACCOUNT_ID");
  _r2 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return _r2;
}

function bucket(): string {
  return requireEnv("R2_BUCKET");
}

/** Presigned PUT URL for a browser/direct upload. */
export async function presignUpload(
  key: string,
  contentType: string,
  expiresIn = 600,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getR2(), cmd, { expiresIn });
}

/** Presigned GET URL for downloading a private object. */
export async function presignDownload(
  key: string,
  expiresIn = 600,
): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: bucket(), Key: key });
  return getSignedUrl(getR2(), cmd, { expiresIn });
}

/** Public URL for an object served via the R2 public base (CDN/custom domain). */
export function publicUrl(key: string): string {
  const base = requireEnv("R2_PUBLIC_BASE_URL").replace(/\/$/, "");
  return `${base}/${key}`;
}

/** Public URL helper that tolerates a missing base (returns null in dev). */
export function maybePublicUrl(key: string): string | null {
  const base = getEnv("R2_PUBLIC_BASE_URL");
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/${key}`;
}

/** Canonical object-key builders for a user's run artifacts. */
export const storageKeys = {
  source: (userId: string, runId: string) =>
    `users/${userId}/runs/${runId}/source.png`,
  collection: (userId: string, runId: string) =>
    `users/${userId}/runs/${runId}/collection.png`,
  icon: (userId: string, runId: string, iconId: string) =>
    `users/${userId}/runs/${runId}/icons/${iconId}.png`,
  exportZip: (userId: string, runId: string) =>
    `users/${userId}/runs/${runId}/exports/icon-pack.zip`,
} as const;
