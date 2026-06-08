import { ComposeCollectionPromptRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { composeCollectionPrompt } from "@/lib/openai/compose-collection-prompt";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ComposeCollectionPromptRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  try {
    const collectionPrompt = await composeCollectionPrompt(parsed.data.manifest);
    return Response.json({ collectionPrompt });
  } catch (err) {
    console.error("[icons/compose-collection-prompt]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred while composing the collection prompt." },
      { status: 500 },
    );
  }
}
