// POST /api/fable/locate-icons — B15 experimental source-icon crops.
//
// ONE Gemini vision call: the approved source image + the candidate list in,
// a normalized bounding box (or null) per candidate id out. The CLIENT does
// the actual cropping (free canvas work) — this route never touches pixels.

import { LocateIconsRequestSchema } from "@/lib/fable/schemas";
import { locateIcons } from "@/lib/fable/gemini-steps";
import { FableError, serializeRawError } from "@/lib/fable/errors";
import { GeminiError } from "@/lib/gemini/errors";
import { buildDebugRaw } from "@/lib/fable/debug";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = LocateIconsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { imageBase64, candidates, model, debug } = parsed.data;

  try {
    const { boxes, usage } = await locateIcons({ imageBase64, candidates, model });
    const payload = { boxes, usage };
    return Response.json(
      debug ? { ...payload, debugRaw: buildDebugRaw(parsed.data, payload) } : payload,
    );
  } catch (err) {
    console.error("[fable/locate-icons]", err);
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
      { error: "An unexpected error occurred while locating icons.", raw: serializeRawError(err) },
      { status: 500 },
    );
  }
}
