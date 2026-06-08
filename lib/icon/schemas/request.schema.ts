import { z } from "zod";
import { IconManifestSchema } from "./icon-manifest.schema";
import {
  IndividualIconPromptSchema,
  IndividualIconPromptsSchema,
} from "./individual-prompts.schema";

// Validation schemas for the six API route request bodies (one per step).
// Routes parse the incoming JSON with these before touching OpenAI.

// POST /api/icons/analyze
export const AnalyzeRequestSchema = z.object({
  imageBase64: z.string().min(1),
  fileName: z.string().optional(),
});

// POST /api/icons/compose-collection-prompt
export const ComposeCollectionPromptRequestSchema = z.object({
  manifest: IconManifestSchema,
});

// POST /api/icons/generate-collection-image
export const GenerateCollectionImageRequestSchema = z.object({
  sourceImageBase64: z.string().min(1),
  manifest: IconManifestSchema,
  collectionPrompt: z.string().min(1),
});

// POST /api/icons/compose-individual-prompts
export const ComposeIndividualPromptsRequestSchema = z.object({
  collectionImageBase64: z.string().min(1),
  manifest: IconManifestSchema,
});

// POST /api/icons/generate-one
export const GenerateOneRequestSchema = z.object({
  collectionImageBase64: z.string().min(1),
  sharedStylePrompt: z.string(),
  iconPrompt: IndividualIconPromptSchema,
});

// POST /api/icons/generate-batch
export const GenerateBatchRequestSchema = z.object({
  collectionImageBase64: z.string().min(1),
  individualPrompts: IndividualIconPromptsSchema,
});
