import { z } from "zod";

// Bench S — the style brief produced from a source image. Built for OpenAI
// strict structured outputs (no .default()). Mirrors StyleBrief in
// types/icon-pipeline.ts.

export const StyleBriefSchema = z.object({
  summary: z.string(),
  colorPalette: z.array(z.string()),
  typography: z.string(),
  lineStyle: z.string(),
  shapeLanguage: z.string(),
  mood: z.array(z.string()),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
});

export type StyleBriefParsed = z.infer<typeof StyleBriefSchema>;
