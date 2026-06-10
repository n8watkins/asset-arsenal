// Fable Bench — usage-record construction + cost estimation.
// Server-safe and client-safe (no SDK imports). OpenAI image pricing is reused
// read-only from the existing model-reference catalog; Gemini flash-lite runs
// on the free tier, so its estimated cost is $0 (tokens are still recorded —
// they're what the paid tier would bill).

import { imageCostUSD } from "@/lib/icon/model-reference";
import type {
  FableStepKey,
  FableUsageRecord,
  ImageQuality,
} from "./types";

/** Build a usage record for a Gemini text/JSON call. Free tier → $0. */
export function geminiUsageRecord(args: {
  step: FableStepKey;
  model: string;
  inputType: string; // "text" | "image+text"
  outputType: string; // "json" | "text"
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
  ok: boolean;
  error?: string;
  promptPreview?: string;
}): FableUsageRecord {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    provider: "gemini",
    kind: "text",
    estCostUSD: 0,
    ...args,
  };
}

/** Build a usage record for an OpenAI image generation call. */
export function openaiImageUsageRecord(args: {
  step: FableStepKey;
  model: string;
  quality: ImageQuality;
  imageCount: number;
  durationMs?: number;
  ok: boolean;
  error?: string;
  promptPreview?: string;
}): FableUsageRecord {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    provider: "openai",
    kind: "image",
    inputType: "image+text",
    outputType: "image",
    estCostUSD: args.ok ? imageCostUSD(args.model, args.quality, args.imageCount) : 0,
    ...args,
  };
}

/** First ~300 chars of a prompt for the ledger; full prompts live on artifacts. */
export function previewOf(prompt: string): string {
  return prompt.length > 300 ? `${prompt.slice(0, 300)}…` : prompt;
}

/** Total estimated spend, optionally per provider. */
export function totalCostUSD(
  usage: FableUsageRecord[],
  provider?: "gemini" | "openai",
): number {
  return usage
    .filter((u) => !provider || u.provider === provider)
    .reduce((sum, u) => sum + u.estCostUSD, 0);
}
