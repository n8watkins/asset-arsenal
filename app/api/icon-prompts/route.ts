import { IconPromptsRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { generateIconPrompts } from "@/lib/openai/generate-icon-prompts";

export async function POST(request: Request) {
  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // 2. Validate shape
  const parsed = IconPromptsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  // 3. Call service
  try {
    const promptPack = await generateIconPrompts(parsed.data.manifest);
    return Response.json({ promptPack });
  } catch (err) {
    console.error("[icon-prompts]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during prompt generation." },
      { status: 500 },
    );
  }
}
