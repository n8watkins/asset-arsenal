/**
 * POST /api/uploads
 * Accepts either:
 *   - multipart/form-data with a `file` field (the browser flow), or
 *   - JSON { filename, contentType } (presign-only flow).
 * Returns (storage on):  { uploadUrl, key, runId, publicUrl }
 * Returns (storage off): { uploadUrl: null, key, runId, publicUrl: null, mock: true }
 *
 * Requires a logged-in user (401 otherwise). Enforces basic upload guards:
 * allowed content types (png/jpeg/webp) and a max size of MAX_UPLOAD_BYTES.
 */

import { auth } from "@/lib/auth";
import { features } from "@/lib/env";
import { presignUpload, publicUrl, storageKeys } from "@/lib/storage/r2";
import {
  MAX_UPLOAD_BYTES,
  isAllowedUploadContentType,
} from "@/lib/limits";

export async function POST(req: Request) {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let contentType: string | undefined;
  let size: number | undefined;

  const reqContentType = req.headers.get("content-type") ?? "";
  if (reqContentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: "Invalid form body" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }
    contentType = file.type;
    size = file.size;
  } else {
    let body: { filename?: string; contentType?: string };
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.filename || !body.contentType) {
      return Response.json(
        { error: "filename and contentType are required" },
        { status: 400 },
      );
    }
    contentType = body.contentType;
  }

  // Abuse guards: type + size.
  if (!contentType || !isAllowedUploadContentType(contentType)) {
    return Response.json(
      { error: "Unsupported contentType (png, jpeg, or webp only)" },
      { status: 400 },
    );
  }
  if (typeof size === "number" && size > MAX_UPLOAD_BYTES) {
    return Response.json(
      { error: "Image exceeds the 10MB upload limit" },
      { status: 400 },
    );
  }

  const runId = crypto.randomUUID();
  const key = storageKeys.source(userId, runId);

  // No storage configured → mock so the front-end upload step still resolves.
  if (!features.storage) {
    return Response.json({
      uploadUrl: null,
      key,
      runId,
      publicUrl: null,
      mock: true,
    });
  }

  const uploadUrl = await presignUpload(key, contentType);
  return Response.json({
    uploadUrl,
    key,
    runId,
    publicUrl: publicUrl(key),
  });
}
