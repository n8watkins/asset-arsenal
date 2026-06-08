import { z } from "zod";

// Mirrors IconManifest. Built for OpenAI strict structured outputs:
// no .default(), optionals expressed as .nullable(), confidence as an enum.
// See docs/API-CONTRACT.md.

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const SharedIconFamilyStyleSchema = z.object({
  colorPalette: z.array(z.string()),
  lineStyle: z.string(),
  shapeLanguage: z.string(),
  glowStyle: z.string().nullable(),
  backgroundRule: z.string(),
  negativeRules: z.array(z.string()),
});

export const ManifestIconSchema = z.object({
  id: z.string(),
  name: z.string(),
  concept: z.string(),
  whereVisible: z.string(),
  visualDescription: z.string(),
  confidence: ConfidenceSchema,
});

export const IconManifestSchema = z.object({
  iconCount: z.number(),
  sharedIconFamilyStyle: SharedIconFamilyStyleSchema,
  icons: z.array(ManifestIconSchema),
  excludedAsNonIcons: z.array(z.string()),
});

export type IconManifestParsed = z.infer<typeof IconManifestSchema>;
