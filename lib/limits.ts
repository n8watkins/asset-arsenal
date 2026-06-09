/**
 * Basic abuse guards.
 *
 * NOTE: These are intentionally BASIC, in-DB caps — they enforce per-user
 * limits via Drizzle queries against the existing tables. For production you'd
 * upgrade to a per-edge rate limiter (e.g. Upstash Ratelimit) sitting in front
 * of these so abusive traffic never reaches the DB. Auth is the primary guard
 * against free anonymous use; these caps bound an authenticated user's volume.
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { iconRuns } from "@/lib/db/schema";

/** Max icons generated in a single run. */
export const MAX_ICONS_PER_RUN = 50;

/** Max icon runs a single user may create per rolling hour. */
export const MAX_RUNS_PER_HOUR = 20;

/** Max source-image upload size, in bytes (10MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Max number of free signup-bonus grants allowed from a single IP per window. */
export const MAX_FREE_GRANTS_PER_IP = 3;

/** Rolling window for the per-IP free-grant cap (24 hours, in seconds). */
export const FREE_GRANT_IP_WINDOW_SECONDS = 24 * 60 * 60;

/** Allowed source-image content types. */
export const ALLOWED_UPLOAD_CONTENT_TYPES = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

/** True when the content type is an allowed image type. */
export function isAllowedUploadContentType(contentType: string): boolean {
  return ALLOWED_UPLOAD_CONTENT_TYPES.has(contentType);
}

/**
 * Count this user's icon_run rows created within the last hour. createdAt is
 * stored as unix seconds.
 */
export async function countRunsLastHour(userId: string): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - 3600;
  const row = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(iconRuns)
    .where(and(eq(iconRuns.userId, userId), gte(iconRuns.createdAt, cutoff)))
    .get();
  return row?.count ?? 0;
}

/**
 * True when the user has hit/exceeded the hourly run cap. Fails open (returns
 * false) on a DB error so a transient issue never hard-blocks a legit user.
 */
export async function isOverRunRateLimit(userId: string): Promise<boolean> {
  try {
    return (await countRunsLastHour(userId)) >= MAX_RUNS_PER_HOUR;
  } catch {
    return false;
  }
}
