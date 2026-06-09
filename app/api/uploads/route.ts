/**
 * POST /api/uploads
 * Body: { filename, contentType }
 * Returns (storage on):  { uploadUrl, key, runId, publicUrl }
 * Returns (storage off): { uploadUrl: null, key, publicUrl: null, mock: true }
 *
 * Mints a runId and a presigned PUT URL so the browser can upload the source
 * image directly to R2. In dev (no R2 creds) it returns a mock so the flow is
 * still clickable.
 */

import { auth } from "@/lib/auth";
import { features } from "@/lib/env";
import { presignUpload, publicUrl, storageKeys } from "@/lib/storage/r2";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export async function POST(req: Request) {
  let body: { filename?: string; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, contentType } = body;
  if (!filename || !contentType) {
    return Response.json(
      { error: "filename and contentType are required" },
      { status: 400 },
    );
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return Response.json(
      { error: "Unsupported contentType (png, jpeg, or webp only)" },
      { status: 400 },
    );
  }

  const userId = (await auth())?.user?.id ?? "demo-user";
  const runId = crypto.randomUUID();
  const key = storageKeys.source(userId, runId);

  // No storage configured → mock so the front-end upload step still resolves.
  if (!features.storage) {
    return Response.json({ uploadUrl: null, key, runId, publicUrl: null, mock: true });
  }

  const uploadUrl = await presignUpload(key, contentType);
  return Response.json({
    uploadUrl,
    key,
    runId,
    publicUrl: publicUrl(key),
  });
}
