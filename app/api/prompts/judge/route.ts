import { z } from "zod";
import { GeminiError } from "@/lib/gemini/errors";
import { judgePrompts } from "@/lib/gemini/judge-prompts";

const JudgeRequestSchema = z.object({
  promptA: z.string().min(1, "promptA is required."),
  promptB: z.string().min(1, "promptB is required."),
  intent: z.string().optional(),
  model: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = JudgeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  try {
    const { judgment, raw, usage } = await judgePrompts(parsed.data);
    return Response.json({ judgment, raw, usage });
  } catch (err) {
    console.error("[prompts/judge]", err);
    if (err instanceof GeminiError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred while judging prompts." },
      { status: 500 },
    );
  }
}
