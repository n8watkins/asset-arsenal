import { z } from "zod";
import { GeminiError } from "@/lib/gemini/errors";
import { judgeImages } from "@/lib/gemini/judge-images";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";

const JudgeImagesRequestSchema = z.object({
  imageA: z.string().min(1, "imageA is required."),
  imageB: z.string().min(1, "imageB is required."),
  intent: z.string().optional(),
  promptA: z.string().optional(),
  promptB: z.string().optional(),
  model: z.string().optional(),
});

function tooLarge(dataUrl: string): boolean {
  const b64 = dataUrl.startsWith("data:")
    ? dataUrl.split(",")[1] ?? dataUrl
    : dataUrl;
  return Math.floor((b64.length * 3) / 4) > MAX_FILE_SIZE_BYTES;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = JudgeImagesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  if (tooLarge(parsed.data.imageA) || tooLarge(parsed.data.imageB)) {
    return Response.json(
      { error: `Each image must be under ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB.` },
      { status: 400 },
    );
  }

  try {
    const { judgment, raw, usage } = await judgeImages(parsed.data);
    return Response.json({ judgment, raw, usage });
  } catch (err) {
    console.error("[images/judge]", err);
    if (err instanceof GeminiError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred while judging images." },
      { status: 500 },
    );
  }
}
