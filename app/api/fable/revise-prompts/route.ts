import { RevisePromptsRequestSchema } from "@/lib/fable/schemas";
import { revisePrompts } from "@/lib/fable/gemini-steps";
import { FableError, serializeRawError } from "@/lib/fable/errors";
import { GeminiError } from "@/lib/gemini/errors";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = RevisePromptsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { style, sharedStylePrompt, candidates, ops, model } = parsed.data;

  try {
    const result = await revisePrompts({ style, sharedStylePrompt, candidates, ops, model });
    return Response.json({
      candidates: result.candidates,
      sharedStylePrompt: result.sharedStylePrompt,
      usage: result.usage,
    });
  } catch (err) {
    console.error("[fable/revise-prompts]", err);
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
      { error: "An unexpected error occurred during prompt revision.", raw: serializeRawError(err) },
      { status: 500 },
    );
  }
}
