import { IconAnalysisRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { analyzeIcons } from "@/lib/openai/analyze-icons";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";

export async function POST(request: Request) {
  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // 2. Validate shape
  const parsed = IconAnalysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { imageBase64, fileName } = parsed.data;

  // 3. Guard: file size
  // Base64 encodes 3 bytes as 4 chars; strip data URL prefix if present.
  const b64Data = imageBase64.startsWith("data:")
    ? imageBase64.split(",")[1] ?? imageBase64
    : imageBase64;
  const estimatedBytes = Math.floor((b64Data.length * 3) / 4);
  if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      {
        error: `Image exceeds the maximum allowed size of ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB.`,
      },
      { status: 400 },
    );
  }

  // 4. Call service
  try {
    const manifest = await analyzeIcons(imageBase64, fileName);
    return Response.json({ manifest });
  } catch (err) {
    console.error("[icon-analysis]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during icon analysis." },
      { status: 500 },
    );
  }
}
