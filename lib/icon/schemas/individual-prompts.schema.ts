import { z } from "zod";

// Mirrors IndividualIconPrompts (step 4 output). Strict-mode friendly.
// See docs/API-CONTRACT.md.

export const IndividualIconPromptSchema = z.object({
  iconId: z.string(),
  iconName: z.string(),
  concept: z.string(),
  collectionImageReference: z.string(),
  prompt: z.string(),
});

export const IndividualIconPromptsSchema = z.object({
  sharedStylePrompt: z.string(),
  iconPrompts: z.array(IndividualIconPromptSchema),
});

export type IndividualIconPromptsParsed = z.infer<
  typeof IndividualIconPromptsSchema
>;
