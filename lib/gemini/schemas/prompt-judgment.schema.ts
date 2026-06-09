import { z } from "zod";

// The verdict Gemini returns when comparing two icon-generation prompts.
// Validated with zod after parsing the model's JSON output (the SDK is asked
// for application/json, but we never trust it blindly).

export const PromptCriterionSchema = z.object({
  name: z.string(),
  scoreA: z.number().min(0).max(10),
  scoreB: z.number().min(0).max(10),
  note: z.string(),
});

export const PromptJudgmentSchema = z.object({
  // Which candidate is the stronger icon-generation prompt.
  winner: z.enum(["A", "B", "tie"]),
  // 0..1 — how confident the judge is in the verdict.
  confidence: z.number().min(0).max(1),
  // Per-criterion breakdown (clarity, specificity, single-subject focus, etc.).
  criteria: z.array(PromptCriterionSchema),
  // One-paragraph overall rationale.
  rationale: z.string(),
  // The distilled best prompt — the winner tightened, or a merge of both.
  distilledPrompt: z.string(),
});

export type PromptCriterion = z.infer<typeof PromptCriterionSchema>;
export type PromptJudgment = z.infer<typeof PromptJudgmentSchema>;
