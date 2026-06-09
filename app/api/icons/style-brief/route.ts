import { StyleBriefRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { analyzeStyleBrief } from "@/lib/openai/analyze-style-brief";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = StyleBriefRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { imageBase64 } = parsed.data;
  const b64Data = imageBase64.startsWith("data:")
    ? imageBase64.split(",")[1] ?? imageBase64
    : imageBase64;
  if (Math.floor((b64Data.length * 3) / 4) > MAX_FILE_SIZE_BYTES) {
    return Response.json(
      { error: `Image exceeds the maximum allowed size of ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB.` },
      { status: 400 },
    );
  }

  try {
    const { brief, usage } = await analyzeStyleBrief(imageBase64, { model: parsed.data.model });
    return Response.json({ brief, usage });
  } catch (err) {
    console.error("[icons/style-brief]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json({ error: "An unexpected error occurred during style-brief analysis." }, { status: 500 });
  }
}
