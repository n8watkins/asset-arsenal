import { RouterRequestSchema } from "@/lib/router/schema";
import { routeRequest } from "@/lib/router/route-request";
import { GeminiError } from "@/lib/gemini/errors";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = RouterRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { hasImage, text, iconList, model } = parsed.data;

  try {
    const { decision, usage } = await routeRequest({ hasImage, text, iconList }, { model });
    return Response.json({ decision, usage });
  } catch (err) {
    console.error("[router]", err);
    if (err instanceof GeminiError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred while routing." },
      { status: 500 },
    );
  }
}
