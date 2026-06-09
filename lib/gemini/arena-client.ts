// Client-side typed fetch wrappers for the prompt-arena API routes.
// Each throws Error(<friendly message>) on non-2xx so the UI can surface it.

import type { TokenUsage } from "@/types/icon-pipeline";
import type { PromptJudgment } from "./schemas/prompt-judgment.schema";
import type { ImageJudgment } from "./schemas/image-judgment.schema";

export type JudgePromptsResponse = {
  judgment: PromptJudgment;
  // The raw Gemini response text, verbatim — stored in the experiment ledger.
  raw: string;
  usage?: TokenUsage;
};

export type JudgeImagesResponse = {
  judgment: ImageJudgment;
  raw: string;
  usage?: TokenUsage;
};

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) || "Request failed.",
    );
  }
  return data as T;
}

/** Compare two icon-generation prompts (text-only Gemini judge). */
export function judgePrompts(args: {
  promptA: string;
  promptB: string;
  intent?: string;
  model?: string;
}): Promise<JudgePromptsResponse> {
  return postJSON<JudgePromptsResponse>("/api/prompts/judge", args);
}

/** Compare two generated icon images (multimodal Gemini judge). */
export function judgeImages(args: {
  imageA: string;
  imageB: string;
  intent?: string;
  promptA?: string;
  promptB?: string;
  model?: string;
}): Promise<JudgeImagesResponse> {
  return postJSON<JudgeImagesResponse>("/api/images/judge", args);
}
