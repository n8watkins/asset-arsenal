import { FinalIconRequestSchema } from "@/lib/fable/schemas";
import { renderFinalIcon } from "@/lib/fable/openai-steps";
import { buildFinalIconWrapper } from "@/lib/fable/prompts";
import { FableError, serializeRawError } from "@/lib/fable/errors";
import { FABLE_MODELS } from "@/lib/fable/types";
import type { FableFinalIcon } from "@/lib/fable/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = FinalIconRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { referenceImageBase64, sharedStylePrompt, icon, sheetPosition, imageModel, quality } =
    parsed.data;

  // Assemble the wrapped prompt in code — no model call needed.
  const wrappedPrompt = buildFinalIconWrapper({
    sharedStylePrompt,
    name: icon.name,
    concept: icon.concept,
    prompt: icon.prompt,
    sheetPosition,
  });

  try {
    const { imageBase64, usage } = await renderFinalIcon({
      referenceImageBase64,
      wrappedPrompt,
      model: imageModel,
      quality,
    });

    const final: FableFinalIcon = {
      id: crypto.randomUUID(),
      iconId: icon.id,
      name: icon.name,
      prompt: wrappedPrompt,
      imageUrl: imageBase64,
      model: imageModel ?? FABLE_MODELS.image,
      quality: quality ?? "medium",
      status: "success",
      createdAt: new Date().toISOString(),
    };

    return Response.json({ final, usage });
  } catch (err) {
    console.error("[fable/final-icon]", err);
    if (err instanceof FableError) {
      return Response.json(
        { error: err.message, usage: err.usage, raw: serializeRawError(err.rawError) },
        { status: 500 },
      );
    }
    return Response.json(
      {
        error: "An unexpected error occurred during final icon rendering.",
        raw: serializeRawError(err),
      },
      { status: 500 },
    );
  }
}
