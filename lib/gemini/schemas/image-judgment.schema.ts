import { z } from "zod";
import { PromptCriterionSchema } from "./prompt-judgment.schema";

// The verdict Gemini returns when comparing two generated icon IMAGES against a
// brief (multimodal — needs a model that accepts image input, e.g. Flash-Lite).
// Reuses the per-criterion score shape from prompt judging.

export const ImageJudgmentSchema = z.object({
  winner: z.enum(["A", "B", "tie"]),
  confidence: z.number().min(0).max(1),
  // e.g. silhouette clarity, style match, background/transparency, subject accuracy.
  criteria: z.array(PromptCriterionSchema),
  rationale: z.string(),
  // Concrete advice for improving the weaker result's prompt next round.
  suggestions: z.string(),
});

export type ImageJudgment = z.infer<typeof ImageJudgmentSchema>;
