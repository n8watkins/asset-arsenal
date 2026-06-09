import type { TokenUsage } from "@/types/icon-pipeline";
import { GeminiError } from "./errors";
import { getGeminiClient } from "./client";
import { DEFAULT_JUDGE_MODEL } from "./models";

// Free-form multi-turn chat with Gemini for the analysis sidebar. Unlike the
// (legacy) structured judges, this returns plain text — it's a conversation.
// Multimodal: a user turn may carry attached images (e.g. two results to
// compare). System steer is light; the user drives.

const SYSTEM_INSTRUCTION = `You are a sharp, concise analysis assistant inside an
icon-generation workbench. The user pastes prompts and/or images and asks you to
compare or critique them (e.g. "compare these two prompts", "which image is the
better icon?"). When comparing prompts, end with the single best prompt on its
own line so it's easy to copy. Be direct; skip preamble.`;

export type ChatTurn = {
  role: "user" | "model";
  text: string;
  images?: string[]; // data URLs or bare base64 (user turns only)
};

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/png", data: dataUrl };
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

function toParts(turn: ChatTurn): Part[] {
  const parts: Part[] = [];
  if (turn.text.trim()) parts.push({ text: turn.text });
  for (const img of turn.images ?? []) {
    const { mimeType, data } = splitDataUrl(img);
    parts.push({ inlineData: { mimeType, data } });
  }
  // A turn must have at least one part.
  if (parts.length === 0) parts.push({ text: "" });
  return parts;
}

/** Send the full conversation; return Gemini's next reply + token usage. */
export async function chatWithGemini(args: {
  turns: ChatTurn[];
  model?: string;
}): Promise<{ reply: string; usage?: TokenUsage }> {
  const ai = getGeminiClient();
  const model = args.model ?? DEFAULT_JUDGE_MODEL;

  let res;
  try {
    res = await ai.models.generateContent({
      model,
      contents: args.turns.map((t) => ({ role: t.role, parts: toParts(t) })),
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });
  } catch (err) {
    throw new GeminiError(
      err instanceof Error ? err.message : "Gemini request failed.",
      err,
    );
  }

  const reply = res.text;
  if (!reply) throw new GeminiError("Gemini returned an empty response.");

  const meta = res.usageMetadata;
  const usage: TokenUsage | undefined = meta
    ? {
        inputTokens: meta.promptTokenCount ?? 0,
        outputTokens: meta.candidatesTokenCount ?? 0,
      }
    : undefined;

  return { reply, usage };
}
