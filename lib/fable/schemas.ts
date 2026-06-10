import { z } from "zod";
import { FABLE_INTENTS, FABLE_OP_KINDS, FABLE_STAGES } from "./types";

// Zod request schemas for all six Fable API routes.
// Mirror lib/icon/schemas/request.schema.ts style.
// imageBase64 fields accept both data URLs (data:image/...;base64,...) and
// bare base64 strings — the service layer handles both via splitDataUrl.

const imageBase64Field = z.string().min(1, "imageBase64 is required");

// POST /api/fable/agent
export const AgentRequestSchema = z.object({
  text: z.string().min(1, "text is required"),
  imageBase64: imageBase64Field.nullable(),
  state: z.object({
    stage: z.enum(FABLE_STAGES),
    hasOriginal: z.boolean(),
    hasImproved: z.boolean(),
    sourceApproved: z.boolean(),
    candidateCount: z.number().int().min(0),
    candidates: z.array(z.object({ id: z.string(), name: z.string() })),
    sheetCount: z.number().int().min(0),
    sheetApproved: z.boolean(),
    finalsCount: z.number().int().min(0),
  }),
});

// POST /api/fable/improve-source
export const ImproveSourceRequestSchema = z.object({
  imageBase64: imageBase64Field,
  instruction: z.string().min(1, "instruction is required"),
  quality: z.enum(["low", "medium", "high"]).optional(),
});

// POST /api/fable/analyze
export const AnalyzeStyleRequestSchema = z.object({
  imageBase64: imageBase64Field,
  guidance: z.string().optional(),
  maxIcons: z.number().int().min(1).optional(),
});

// FableOp sub-schema — flat shape mirroring the types.ts definition.
const FableOpSchema = z.object({
  op: z.enum(FABLE_OP_KINDS),
  iconId: z.string().nullable(),
  name: z.string().nullable(),
  instruction: z.string().nullable(),
});

// FableStyle sub-schema.
const FableStyleSchema = z.object({
  styleName: z.string(),
  summary: z.string(),
  colorPalette: z.array(z.string()),
  lineStyle: z.string(),
  shapeLanguage: z.string(),
  lighting: z.string(),
  background: z.string(),
  mood: z.array(z.string()),
  negativeRules: z.array(z.string()),
});

// IconCandidate sub-schema.
const IconCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  concept: z.string(),
  rationale: z.string(),
  prompt: z.string(),
  status: z.enum(["active", "removed"]),
});

// POST /api/fable/revise-prompts
export const RevisePromptsRequestSchema = z.object({
  style: FableStyleSchema,
  sharedStylePrompt: z.string().min(1),
  candidates: z.array(IconCandidateSchema).min(1),
  ops: z.array(FableOpSchema).min(1),
});

// POST /api/fable/preview-sheet
const PreviewSheetIconSchema = z.object({
  id: z.string(),
  name: z.string(),
  concept: z.string(),
  prompt: z.string(),
});

export const PreviewSheetRequestSchema = z.object({
  referenceImageBase64: imageBase64Field,
  style: FableStyleSchema,
  sharedStylePrompt: z.string().min(1),
  icons: z.array(PreviewSheetIconSchema).min(1),
  sheetIndex: z.number().int().min(0),
  instruction: z.string().optional(),
  quality: z.enum(["low", "medium", "high"]).optional(),
});

// POST /api/fable/final-icon
export const FinalIconRequestSchema = z.object({
  referenceImageBase64: imageBase64Field,
  sharedStylePrompt: z.string().min(1),
  icon: z.object({
    id: z.string(),
    name: z.string(),
    concept: z.string(),
    prompt: z.string(),
  }),
  quality: z.enum(["low", "medium", "high"]).optional(),
});

// Re-export sub-schemas for convenience.
export { FableOpSchema, FableStyleSchema, IconCandidateSchema };
