import type { TokenUsage } from "@/types/icon-pipeline";
import { GeminiError } from "./errors";
import { getGeminiClient } from "./client";
import { DEFAULT_JUDGE_MODEL } from "./models";
import {
  ImageJudgmentSchema,
  type ImageJudgment,
} from "./schemas/image-judgment.schema";

const SYSTEM_INSTRUCTION = `You are an expert visual critic for an AI icon-extraction workbench.
You are shown two candidate icon images (A then B) and judge which better satisfies
the brief as a clean, production-ready icon. Weigh:
- silhouette clarity & readability at small sizes
- style match to the stated intent
- background / transparency cleanliness (no stray pixels, no baked-in background)
- subject accuracy (is it unmistakably the intended thing?)
- single-subject focus (no clutter)

Score each criterion 0-10 for both images. Pick a winner ("A", "B", or "tie") with a
confidence 0-1. Then give concrete suggestions for improving the weaker image's prompt
next round. Respond ONLY with JSON matching the requested schema.`;

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (m) return { mimeType: m[1], data: m[2] };
  // Bare base64 — assume PNG.
  return { mimeType: "image/png", data: dataUrl };
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return trimmed;
}

/**
 * Multimodal image-pair judge. Compares two icon images against an intent and
 * returns a structured verdict + improvement suggestions. promptA/promptB are
 * optional context (the prompts that produced each image).
 */
export async function judgeImages(args: {
  imageA: string; // data URL or bare base64
  imageB: string;
  intent?: string;
  promptA?: string;
  promptB?: string;
  model?: string;
}): Promise<{ judgment: ImageJudgment; raw: string; usage?: TokenUsage }> {
  const ai = getGeminiClient();
  const model = args.model ?? DEFAULT_JUDGE_MODEL;
  const a = splitDataUrl(args.imageA);
  const b = splitDataUrl(args.imageB);

  const ctx = [
    args.intent?.trim() ? `Intent / brief:\n${args.intent.trim()}` : "",
    args.promptA?.trim() ? `Prompt that produced Image A:\n${args.promptA.trim()}` : "",
    args.promptB?.trim() ? `Prompt that produced Image B:\n${args.promptB.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: [
        { text: `${ctx}${ctx ? "\n\n" : ""}Image A:` },
        { inlineData: { mimeType: a.mimeType, data: a.data } },
        { text: "Image B:" },
        { inlineData: { mimeType: b.mimeType, data: b.data } },
      ],
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
  if (!raw) throw new GeminiError("Gemini returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    throw new GeminiError("Gemini returned invalid JSON.", raw);
  }

  const result = ImageJudgmentSchema.safeParse(parsed);
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

  return { judgment: result.data, raw, usage };
}
