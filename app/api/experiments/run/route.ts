import { z } from "zod";
import { ExperimentError } from "@/lib/experiments/errors";
import { runCell } from "@/lib/experiments/run-cell";
import { IconPipelineError } from "@/lib/icon/errors";
import { GeminiError } from "@/lib/gemini/errors";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";

const RunRequestSchema = z.object({
  model: z.string().min(1, "model is required."),
  text: z.string().min(1, "text/prompt is required."),
  image: z.string().optional(),
  settings: z
    .object({
      quality: z.enum(["low", "medium", "high"]).optional(),
      background: z.enum(["auto", "transparent", "opaque"]).optional(),
      size: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = RunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { image } = parsed.data;
  if (image) {
    const b64 = image.startsWith("data:") ? image.split(",")[1] ?? image : image;
    if (Math.floor((b64.length * 3) / 4) > MAX_FILE_SIZE_BYTES) {
      return Response.json(
        { error: `Image must be under ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB.` },
        { status: 400 },
      );
    }
  }

  try {
    const result = await runCell(parsed.data);
    return Response.json({ result });
  } catch (err) {
    console.error("[experiments/run]", err);
    // Provider key/validation errors carry user-friendly messages.
    if (
      err instanceof ExperimentError ||
      err instanceof IconPipelineError ||
      err instanceof GeminiError
    ) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred while running the cell." },
      { status: 500 },
    );
  }
}
