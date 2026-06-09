import { MegaAnalyzeRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { megaAnalyze } from "@/lib/openai/mega-analyze";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = MegaAnalyzeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { imageBase64, fileName } = parsed.data;

  // Guard: file size. Base64 encodes 3 bytes as 4 chars; strip the prefix.
  const b64Data = imageBase64.startsWith("data:")
    ? imageBase64.split(",")[1] ?? imageBase64
    : imageBase64;
  const estimatedBytes = Math.floor((b64Data.length * 3) / 4);
  if (estimatedBytes > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { error: `Image exceeds the maximum allowed size of ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB.` },
      { status: 400 },
    );
  }

  try {
    const { analysis, usage } = await megaAnalyze(imageBase64, fileName, {
      model: parsed.data.model,
    });
    return Response.json({ analysis, usage });
  } catch (err) {
    console.error("[icons/mega-analyze]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during mega-analysis." },
      { status: 500 },
    );
  }
}
