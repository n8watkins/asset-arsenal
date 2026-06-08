import { z } from "zod";

// Mirrors IconManifest (PRD §13.4). Built for OpenAI strict structured outputs:
// no .default(), optionals expressed as .nullable(), confidence as an enum.
// See docs/API-CONTRACT.md.

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);

export const IconFamilyStyleSchema = z.object({
  summary: z.string(),
  colorPalette: z.array(z.string()),
  lineStyle: z.string(),
  shapeLanguage: z.string(),
  glowStyle: z.string().nullable(),
  backgroundRule: z.string(),
  negativeRules: z.array(z.string()),
});

export const DecomposedIconSchema = z.object({
  id: z.string(),
  name: z.string(),
  meaning: z.string(),
  locationInImage: z.string(),
  visualDescription: z.string(),
  styleNotes: z.string(),
  confidence: ConfidenceSchema,
});

export const IconManifestSchema = z.object({
  imageSummary: z.string(),
  iconCount: z.number(),
  iconFamilyStyle: IconFamilyStyleSchema,
  icons: z.array(DecomposedIconSchema),
  notes: z.array(z.string()),
});

export type IconManifestParsed = z.infer<typeof IconManifestSchema>;
