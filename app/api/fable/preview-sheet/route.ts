import { PreviewSheetRequestSchema } from "@/lib/fable/schemas";
import { renderPreviewSheet } from "@/lib/fable/openai-steps";
import { buildPreviewSheetPrompt } from "@/lib/fable/prompts";
import { FableError, serializeRawError } from "@/lib/fable/errors";
import { gridFor } from "@/lib/fable/types";
import { buildDebugRaw } from "@/lib/fable/debug";

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

  const {
    referenceImageBase64,
    style,
    sharedStylePrompt,
    icons,
    instruction,
    background,
    imageModel,
    quality,
    debug,
  } = parsed.data;

  // Grid shape is derived from icon count — deterministic, no model needed.
  const grid = gridFor(icons.length);

  // Sheet prompt is assembled in code (deterministic — no Gemini call for this step).
  // B14: explicit request param wins; else the style's own iconBackground.
  const effectiveBackground = background ?? style.iconBackground;
  const sheetPrompt = buildPreviewSheetPrompt({
    style,
    sharedStylePrompt,
    icons,
    grid,
    instruction,
    background: effectiveBackground,
  });

  try {
    const { imageBase64, usage } = await renderPreviewSheet({
      referenceImageBase64,
      sheetPrompt,
      background: effectiveBackground,
      model: imageModel,
      quality,
    });
    const payload = { sheetPrompt, imageBase64, grid, usage };
    return Response.json(
      debug ? { ...payload, debugRaw: buildDebugRaw(parsed.data, payload) } : payload,
    );
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
