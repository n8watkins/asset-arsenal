import { z } from "zod";
import {
  IconManifestSchema,
  DecomposedIconSchema,
  IconFamilyStyleSchema,
} from "./icon-manifest.schema";
import { IconPromptSchema, IconPromptPackSchema } from "./icon-prompts.schema";

// Validation schemas for the four API route request bodies (PRD §14).
// Routes parse the incoming JSON with these before touching OpenAI.

export const IconAnalysisRequestSchema = z.object({
  imageBase64: z.string().min(1),
  fileName: z.string().optional(),
});

export const IconPromptsRequestSchema = z.object({
  manifest: IconManifestSchema,
});

export const GenerateIconRequestSchema = z.object({
  icon: DecomposedIconSchema,
  prompt: IconPromptSchema,
  iconFamilyStyle: IconFamilyStyleSchema,
});

export const GenerateIconsBatchRequestSchema = z.object({
  manifest: IconManifestSchema,
  promptPack: IconPromptPackSchema,
});
