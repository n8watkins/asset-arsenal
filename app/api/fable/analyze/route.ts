import { AnalyzeStyleRequestSchema } from "@/lib/fable/schemas";
import { analyzeStyle } from "@/lib/fable/gemini-steps";
import { FableError, serializeRawError } from "@/lib/fable/errors";
import { GeminiError } from "@/lib/gemini/errors";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = AnalyzeStyleRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { imageBase64, guidance, maxIcons, model } = parsed.data;

  try {
    const { style, sharedStylePrompt, candidates, usage } = await analyzeStyle({
      imageBase64,
      guidance,
      maxIcons,
      model,
    });
    return Response.json({ style, sharedStylePrompt, candidates, usage });
  } catch (err) {
    console.error("[fable/analyze]", err);
    if (err instanceof FableError) {
      return Response.json(
        { error: err.message, usage: err.usage, raw: serializeRawError(err.rawError) },
        { status: 500 },
      );
    }
    if (err instanceof GeminiError) {
      return Response.json(
        { error: err.message, raw: serializeRawError(err.rawError) },
        { status: 500 },
      );
    }
    return Response.json(
      { error: "An unexpected error occurred during style analysis.", raw: serializeRawError(err) },
      { status: 500 },
    );
  }
}
