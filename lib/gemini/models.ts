// Client-safe Gemini model catalog for the prompt arena. No SDK import here, so
// this is safe to pull into client components (unlike lib/gemini/client.ts).

export type JudgeModel = {
  id: string;
  label: string;
  blurb: string;
};

// Ordered cheapest → strongest. Flash-Lite is the default triage judge; reach
// for a heavier model when two candidates are genuinely close.
export const JUDGE_MODELS: readonly JudgeModel[] = [
  { id: "gemini-3.1-flash-lite", label: "Flash-Lite", blurb: "cheap & fast — default" },
  { id: "gemini-3.1-flash", label: "Flash", blurb: "stronger reasoning" },
  { id: "gemini-3.1-pro", label: "Pro", blurb: "best for close calls" },
] as const;

export const DEFAULT_JUDGE_MODEL = JUDGE_MODELS[0].id;
