import { z } from "zod";

// Mirrors IconPromptPack (PRD §13.6). Strict-mode friendly.
// See docs/API-CONTRACT.md.

export const IconPromptSchema = z.object({
  iconId: z.string(),
  iconName: z.string(),
  prompt: z.string(),
  aspectRatio: z.literal("1:1"),
  recommendedModel: z.literal("gpt-image-1-mini"),
  notes: z.string().nullable(),
});

export const IconPromptPackSchema = z.object({
  sharedStyleSummary: z.string(),
  prompts: z.array(IconPromptSchema),
});

export type IconPromptPackParsed = z.infer<typeof IconPromptPackSchema>;
