import { z } from "zod";
import { generateSkin } from "@/lib/skins/generate";

export const maxDuration = 300;

const RequestSchema = z.object({ concept: z.string().trim().min(2).max(200) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "concept must be 2-200 characters." }, { status: 400 });
  }
  try {
    return Response.json(await generateSkin(parsed.data.concept));
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Skin generation failed." },
      { status: 502 },
    );
  }
}
