import { ComposeIndividualPromptsRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { composeIndividualPrompts } from "@/lib/openai/compose-individual-prompts";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ComposeIndividualPromptsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  try {
    const individualPrompts = await composeIndividualPrompts(parsed.data);
    return Response.json({ individualPrompts });
  } catch (err) {
    console.error("[icons/compose-individual-prompts]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred while composing individual prompts." },
      { status: 500 },
    );
  }
}
