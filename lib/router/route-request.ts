import { Type } from "@google/genai";
import type { TokenUsage } from "@/types/icon-pipeline";
import { getGeminiClient } from "@/lib/gemini/client";
import { GeminiError } from "@/lib/gemini/errors";
import { DEFAULT_JUDGE_MODEL } from "@/lib/gemini/models";
import {
  ROUTER_FLOWS,
  deriveStartingPoint,
  type RouterDecision,
  type RouterInput,
} from "./types";
import { RouterModelOutputSchema } from "./schema";

// Server-only. The router's single model call: given the SHAPE of the user's
// input (image present? icon list present?) and the TEXT of their request,
// classify which flow to run. It never sees the image — by design, routing is
// cheap and presence-based. Defaults to Gemini Flash-Lite (free tier).

const SYSTEM_INSTRUCTION = `You are the intake router for Asset Arsenal, a tool
that turns a design direction into a matching pack of icon assets. You do NOT
generate anything — you only decide which of a fixed set of flows best fits what
the user gave you. You never see the image itself, only whether one is attached.

Pick exactly one flow:

- extract_assets_from_image: an image is attached and reads as a finished/polished
  design the user wants icons pulled FROM. Default when there's an image and no
  sign it's rough or that they want it improved first.
- upgrade_design_first: an image is attached but the text says it's rough, a
  draft, a wireframe, or asks to improve/clean up/polish it before extracting.
- generate_style_reference_from_prompt: NO image, and the text describes a style,
  vibe, or look to create from scratch.
- build_icon_pack_from_list: the user supplied an explicit list of icons they
  want, with no image to match. Build those icons.
- use_uploaded_style_reference: an image IS attached AND the user supplied an
  explicit icon list — match the image's style for those specific icons.
- ask_for_clarification: genuinely too little signal (e.g. no image, no list,
  and vague/empty text). This is a LAST RESORT — strongly prefer a confident best
  guess. Only use it when you truly cannot tell what they want.

Return confidence in [0,1]. Set needsUserChoice true only when two flows are
realistically tied or the request is ambiguous enough that guessing wrong is
costly. Keep "reason" to one tight sentence aimed at a developer tuning the router.`;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    recommendedFlow: { type: Type.STRING, enum: [...ROUTER_FLOWS] },
    confidence: { type: Type.NUMBER },
    needsUserChoice: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
  },
  required: ["recommendedFlow", "confidence", "needsUserChoice", "reason"],
  propertyOrdering: ["recommendedFlow", "confidence", "needsUserChoice", "reason"],
};

function describeInput(input: RouterInput): string {
  const lines = [
    `Image attached: ${input.hasImage ? "yes" : "no"}`,
    input.iconList.length
      ? `Explicit icon list (${input.iconList.length}): ${input.iconList.join(", ")}`
      : "Explicit icon list: none",
    `User's text: ${input.text.trim() ? `"${input.text.trim()}"` : "(empty)"}`,
  ];
  return lines.join("\n");
}

export async function routeRequest(
  input: RouterInput,
  opts?: { model?: string },
): Promise<{ decision: RouterDecision; usage?: TokenUsage }> {
  const ai = getGeminiClient();
  const model = opts?.model ?? DEFAULT_JUDGE_MODEL;

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: describeInput(input),
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0,
      },
    });
  } catch (err) {
    throw new GeminiError(
      err instanceof Error ? err.message : "Router request failed.",
      err,
    );
  }

  const raw = res.text;
  if (!raw) throw new GeminiError("Router returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new GeminiError(`Router returned non-JSON: ${raw.slice(0, 200)}`);
  }

  const valid = RouterModelOutputSchema.safeParse(parsed);
  if (!valid.success) {
    throw new GeminiError(
      `Router output failed validation: ${valid.error.issues[0]?.message ?? "bad shape"}`,
    );
  }

  const meta = res.usageMetadata;
  const usage: TokenUsage | undefined = meta
    ? {
        inputTokens: meta.promptTokenCount ?? 0,
        outputTokens: meta.candidatesTokenCount ?? 0,
      }
    : undefined;

  return {
    decision: { ...valid.data, startingPoint: deriveStartingPoint(input) },
    usage,
  };
}
