import { z } from "zod";
import { FABLE_INTENTS, FABLE_OP_KINDS, FABLE_STAGES } from "./types";

// Zod request schemas for all six Fable API routes.
// Mirror lib/icon/schemas/request.schema.ts style.
// imageBase64 fields accept both data URLs (data:image/...;base64,...) and
// bare base64 strings — the service layer handles both via splitDataUrl.

const imageBase64Field = z.string().min(1, "imageBase64 is required");

// Optional model overrides — catalog ids (lib/icon/model-reference.ts).
const modelField = z.string().min(1).optional();

// W4: every route accepts debug:true → include a scrubbed debugRaw on success.
const debugField = z.boolean().optional();

// POST /api/fable/agent
export const AgentRequestSchema = z.object({
  // Empty text is allowed — an image-only send routes to the agent, which
  // classifies it (typically "clarify": ask what to do with the image).
  text: z.string().default(""),
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
    newImageThisTurn: z.boolean().optional().default(false),
    // Last few user/assistant chat turns so the router can judge terse
    // messages and bare images against the recent conversation.
    recentMessages: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string() }))
      .optional()
      .default([]),
  }),
  model: modelField,
  debug: debugField,
});

// POST /api/fable/improve-source
export const ImproveSourceRequestSchema = z.object({
  imageBase64: imageBase64Field,
  instruction: z.string().min(1, "instruction is required"),
  model: modelField,
  imageModel: modelField,
  quality: z.enum(["low", "medium", "high"]).optional(),
  debug: debugField,
});

// POST /api/fable/analyze
export const AnalyzeStyleRequestSchema = z.object({
  imageBase64: imageBase64Field,
  guidance: z.string().optional(),
  maxIcons: z.number().int().min(1).optional(),
  model: modelField,
  debug: debugField,
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
  // B14: "transparent" | color; optional — older clients/projects omit it.
  iconBackground: z.string().optional(),
});

// IconCandidate sub-schema.
const IconCandidateSchema = z.object({
  id: z.string(),
  name: z.string(),
  concept: z.string(),
  rationale: z.string(),
  prompt: z.string(),
  status: z.enum(["active", "removed"]),
  // B15: client-derived crop metadata rides along on revise round-trips.
  sourceCrop: z.string().optional(),
  sourceBox: z
    .object({ x0: z.number(), y0: z.number(), x1: z.number(), y1: z.number() })
    .nullable()
    .optional(),
});

// POST /api/fable/revise-prompts
export const RevisePromptsRequestSchema = z.object({
  style: FableStyleSchema,
  sharedStylePrompt: z.string().min(1),
  candidates: z.array(IconCandidateSchema).min(1),
  ops: z.array(FableOpSchema).min(1),
  model: modelField,
  debug: debugField,
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
  // B14: "transparent" | color; absent → opaque default.
  background: z.string().optional(),
  imageModel: modelField,
  quality: z.enum(["low", "medium", "high"]).optional(),
  debug: debugField,
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
  sheetPosition: z.string().optional(),
  // B15: per-icon source crop as a SECOND reference image (data URL).
  sourceCropBase64: z.string().optional(),
  imageModel: modelField,
  quality: z.enum(["low", "medium", "high"]).optional(),
  debug: debugField,
});

// POST /api/fable/locate-icons (B15)
export const LocateIconsRequestSchema = z.object({
  imageBase64: imageBase64Field,
  candidates: z
    .array(z.object({ id: z.string(), name: z.string(), concept: z.string() }))
    .min(1),
  model: modelField,
  debug: debugField,
});

// Re-export sub-schemas for convenience.
export { FableOpSchema, FableStyleSchema, IconCandidateSchema };
