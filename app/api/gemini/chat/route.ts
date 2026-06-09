import { z } from "zod";
import { GeminiError } from "@/lib/gemini/errors";
import { chatWithGemini } from "@/lib/gemini/chat";

const ChatRequestSchema = z.object({
  turns: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string(),
        images: z.array(z.string()).optional(),
      }),
    )
    .min(1, "At least one turn is required."),
  model: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  try {
    const { reply, usage } = await chatWithGemini(parsed.data);
    return Response.json({ reply, usage });
  } catch (err) {
    console.error("[gemini/chat]", err);
    if (err instanceof GeminiError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during the chat." },
      { status: 500 },
    );
  }
}
