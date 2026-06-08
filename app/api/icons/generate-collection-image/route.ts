import { GenerateCollectionImageRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { generateCollectionImage } from "@/lib/openai/generate-collection-image";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = GenerateCollectionImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  try {
    const collectionImage = await generateCollectionImage(parsed.data);
    return Response.json({ collectionImage });
  } catch (err) {
    console.error("[icons/generate-collection-image]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred while generating the collection image." },
      { status: 500 },
    );
  }
}
