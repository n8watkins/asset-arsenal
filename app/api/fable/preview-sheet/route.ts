import { PreviewSheetRequestSchema } from "@/lib/fable/schemas";
import { renderPreviewSheet } from "@/lib/fable/openai-steps";
import { buildPreviewSheetPrompt } from "@/lib/fable/prompts";
import { FableError, serializeRawError } from "@/lib/fable/errors";
import { gridFor } from "@/lib/fable/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = PreviewSheetRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { referenceImageBase64, style, sharedStylePrompt, icons, instruction, imageModel, quality } =
    parsed.data;

  // Grid shape is derived from icon count — deterministic, no model needed.
  const grid = gridFor(icons.length);

  // Sheet prompt is assembled in code (deterministic — no Gemini call for this step).
  const sheetPrompt = buildPreviewSheetPrompt({ style, sharedStylePrompt, icons, grid, instruction });

  try {
    const { imageBase64, usage } = await renderPreviewSheet({
      referenceImageBase64,
      sheetPrompt,
      model: imageModel,
      quality,
    });
    return Response.json({ sheetPrompt, imageBase64, grid, usage });
  } catch (err) {
    console.error("[fable/preview-sheet]", err);
    if (err instanceof FableError) {
      return Response.json(
        { error: err.message, usage: err.usage, raw: serializeRawError(err.rawError) },
        { status: 500 },
      );
    }
    return Response.json(
      {
        error: "An unexpected error occurred during preview sheet rendering.",
        raw: serializeRawError(err),
      },
      { status: 500 },
    );
  }
}
