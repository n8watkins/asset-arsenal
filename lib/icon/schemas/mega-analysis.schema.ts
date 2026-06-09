import { z } from "zod";
import {
  SharedIconFamilyStyleSchema,
  ConfidenceSchema,
} from "./icon-manifest.schema";

// Bench V2 — the "collapsed" pipeline. One vision pass merges §1 (analyze),
// §2/§4 (compose prompts): for every icon it returns the manifest fields PLUS a
// ready-to-generate per-icon prompt, all derived from the source image alone (no
// collection image). Built for OpenAI strict structured outputs (no .default(),
// optionals as .nullable()). Mirrors MegaAnalysis in types/icon-pipeline.ts.

export const MegaAnalysisIconSchema = z.object({
  id: z.string(),
  name: z.string(),
  concept: z.string(),
  whereVisible: z.string(),
  visualDescription: z.string(),
  confidence: ConfidenceSchema,
  prompt: z.string(), // final per-icon image-generation prompt
});

export const MegaAnalysisSchema = z.object({
  iconCount: z.number(),
  sharedIconFamilyStyle: SharedIconFamilyStyleSchema,
  sharedStylePrompt: z.string(),
  icons: z.array(MegaAnalysisIconSchema),
  excludedAsNonIcons: z.array(z.string()),
});

export type MegaAnalysisParsed = z.infer<typeof MegaAnalysisSchema>;
