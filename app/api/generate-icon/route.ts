import { GenerateIconRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { generateIcon } from "@/lib/openai/generate-icon";

export async function POST(request: Request) {
  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // 2. Validate shape
  const parsed = GenerateIconRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  // 3. Call service
  try {
    const generatedIcon = await generateIcon(parsed.data);
    return Response.json({ generatedIcon });
  } catch (err) {
    console.error("[generate-icon]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during icon generation." },
      { status: 500 },
    );
  }
}
