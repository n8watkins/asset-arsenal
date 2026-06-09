import type { TokenUsage } from "@/types/icon-pipeline";
import { GeminiError } from "./errors";
import { getGeminiClient, DEFAULT_JUDGE_MODEL } from "./client";
import {
  PromptJudgmentSchema,
  type PromptJudgment,
} from "./schemas/prompt-judgment.schema";

const SYSTEM_INSTRUCTION = `You are an expert prompt critic for an AI icon-extraction workbench.
You compare two candidate prompts that will be sent to an image model to generate
a clean, transparent, single-subject icon. Judge the PROMPTS themselves — not any
image — on how reliably each would yield a good icon. Weigh:
- clarity & lack of ambiguity
- specificity of subject and visual style
- single-subject focus (no scenes, no clutter)
- explicit handling of background/transparency
- consistency with any stated intent

Score each criterion 0-10 for both prompts. Pick a winner ("A", "B", or "tie")
and give a confidence 0-1. Then write a single distilled prompt: the winner
tightened, or a merge of the best of both. Respond ONLY with JSON matching the
requested schema.`;

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return trimmed;
}

/**
 * Text-only prompt judge. Compares two icon-generation prompts with Gemini and
 * returns a structured verdict + a distilled prompt. No images involved.
 */
export async function judgePrompts(args: {
  promptA: string;
  promptB: string;
  intent?: string;
  model?: string;
}): Promise<{ judgment: PromptJudgment; usage?: TokenUsage }> {
  const ai = getGeminiClient();
  const model = args.model ?? DEFAULT_JUDGE_MODEL;

  const intentLine = args.intent?.trim()
    ? `Stated intent / brief:\n${args.intent.trim()}\n\n`
    : "";
  const userText =
    `${intentLine}Prompt A:\n${args.promptA}\n\nPrompt B:\n${args.promptB}`;

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: userText,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });
  } catch (err) {
    throw new GeminiError(
      err instanceof Error ? err.message : "Gemini request failed.",
      err,
    );
  }

  const raw = res.text;
  if (!raw) {
    throw new GeminiError("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    throw new GeminiError("Gemini returned invalid JSON.", raw);
  }

  const result = PromptJudgmentSchema.safeParse(parsed);
  if (!result.success) {
    throw new GeminiError(
      `Gemini verdict failed validation: ${result.error.issues[0]?.message ?? "unknown"}`,
      parsed,
    );
  }

  const meta = res.usageMetadata;
  const usage: TokenUsage | undefined = meta
    ? {
        inputTokens: meta.promptTokenCount ?? 0,
        outputTokens: meta.candidatesTokenCount ?? 0,
      }
    : undefined;

  return { judgment: result.data, usage };
}
