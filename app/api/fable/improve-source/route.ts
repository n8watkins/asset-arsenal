import { ImproveSourceRequestSchema } from "@/lib/fable/schemas";
import { improveSourceBrief } from "@/lib/fable/gemini-steps";
import { renderImprovedSource } from "@/lib/fable/openai-steps";
import { buildDebugRaw } from "@/lib/fable/debug";
import { FableError, serializeRawError } from "@/lib/fable/errors";
import { GeminiError } from "@/lib/gemini/errors";
import type { FableUsageRecord } from "@/lib/fable/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ImproveSourceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { imageBase64, instruction, model, imageModel, quality, debug } = parsed.data;
  const accumulatedUsage: FableUsageRecord[] = [];

  try {
    // Step 1: Gemini writes the critique + image prompt.
    const briefResult = await improveSourceBrief({ imageBase64, instruction, model });
    accumulatedUsage.push(...briefResult.usage);

    // Step 2: OpenAI renders the improved source image.
    const renderResult = await renderImprovedSource({
      imageBase64,
      imagePrompt: briefResult.imagePrompt,
      model: imageModel,
      quality,
    });
    accumulatedUsage.push(...renderResult.usage);

    const payload = {
      critique: briefResult.critique,
      imagePrompt: briefResult.imagePrompt,
      imageBase64: renderResult.imageBase64,
      usage: accumulatedUsage,
    };
    return Response.json(
      debug ? { ...payload, debugRaw: buildDebugRaw(parsed.data, payload) } : payload,
    );
  } catch (err) {
    console.error("[fable/improve-source]", err);
    if (err instanceof FableError) {
      return Response.json(
        {
          error: err.message,
          usage: [...accumulatedUsage, ...err.usage],
          raw: serializeRawError(err.rawError),
        },
        { status: 500 },
      );
    }
    if (err instanceof GeminiError) {
      return Response.json(
        { error: err.message, usage: accumulatedUsage, raw: serializeRawError(err.rawError) },
        { status: 500 },
      );
    }
    return Response.json(
      {
        error: "An unexpected error occurred during source improvement.",
        usage: accumulatedUsage,
        raw: serializeRawError(err),
      },
      { status: 500 },
    );
  }
}
