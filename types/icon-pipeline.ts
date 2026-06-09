// Core domain types for the Asset Arsenal icon extraction pipeline.
//
// The pipeline is a 6-step artifact chain — each step explicitly consumes the
// artifacts the previous step produced:
//
//   sourceImage
//     → iconManifest                (step 1: analyze)
//     → collectionPrompt            (step 2: compose collection prompt)
//     → collectionImage             (step 3: generate the collection image)
//     → individualPrompts           (step 4: compose one prompt per icon)
//     → generatedIcons[]            (step 5: generate each icon)
//
// The collection image (collectionImage) is the visual style anchor: steps 4 and 5
// pass it to the model as a reference image so every icon matches the family.

export type Confidence = "high" | "medium" | "low";

// ---------------------------------------------------------------------------
// Step 0 — Source image
// ---------------------------------------------------------------------------

export type SourceImage = {
  id: string;
  imageUrl: string; // object URL or data URL
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  uploadedAt: string;
};

// ---------------------------------------------------------------------------
// Step 1 — Icon manifest (shape mirrors the analysis prompt's output JSON)
// ---------------------------------------------------------------------------

export type SharedIconFamilyStyle = {
  colorPalette: string[];
  lineStyle: string;
  shapeLanguage: string;
  glowStyle: string | null;
  backgroundRule: string;
  negativeRules: string[];
};

export type ManifestIcon = {
  id: string; // stable "icon_001", "icon_002", …
  name: string;
  concept: string;
  whereVisible: string;
  visualDescription: string;
  confidence: Confidence;
};

export type IconManifest = {
  iconCount: number;
  sharedIconFamilyStyle: SharedIconFamilyStyle;
  icons: ManifestIcon[];
  excludedAsNonIcons: string[];
};

// ---------------------------------------------------------------------------
// Step 2 — Icon collection (collection image) prompt
// ---------------------------------------------------------------------------

// The composer returns a single plain-text image-generation prompt.
export type CollectionPromptResult = {
  collectionPrompt: string;
};

// ---------------------------------------------------------------------------
// Step 3 — Icon collection image (the collection image)
// ---------------------------------------------------------------------------

export type CollectionImage = {
  id: string;
  imageUrl: string; // data URL
  promptUsed: string; // the collection prompt sent to the image model
  modelUsed: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Step 4 — Individual icon prompts (composed against the collection image)
// ---------------------------------------------------------------------------

export type IndividualIconPrompt = {
  iconId: string;
  iconName: string;
  concept: string;
  collectionImageReference: string;
  prompt: string;
};

export type IndividualIconPrompts = {
  sharedStylePrompt: string;
  iconPrompts: IndividualIconPrompt[];
};

// ---------------------------------------------------------------------------
// Step 5 — Generated icons
// ---------------------------------------------------------------------------

export type GeneratedIconStatus = "pending" | "generating" | "success" | "failed";

export type GeneratedIcon = {
  id: string;
  iconId: string;
  iconName: string;
  prompt: string; // the final wrapped prompt actually sent to the image model
  imageUrl: string; // data URL once generated, "" while pending
  modelUsed: string;
  status: GeneratedIconStatus;
  error?: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Pipeline state
// ---------------------------------------------------------------------------

export type PipelineStep =
  | "idle"
  | "image_uploaded"
  | "analyzing"
  | "manifest_ready"
  | "composing_collection_prompt"
  | "collection_prompt_ready"
  | "generating_collection_image"
  | "collection_image_ready"
  | "composing_individual_prompts"
  | "individual_prompts_ready"
  | "generating_icons"
  | "icons_ready"
  | "error";

export type PipelineErrorStep =
  | "upload"
  | "analysis"
  | "collection_prompt"
  | "collection_image"
  | "individual_prompts"
  | "icon_generation";

export type PipelineError = {
  step: PipelineErrorStep;
  message: string;
  rawError?: unknown;
  createdAt: string;
};

export type IconExtractionRun = {
  id: string;
  sourceImage: SourceImage;
  manifest?: IconManifest;
  collectionPrompt?: string;
  collectionImage?: CollectionImage;
  individualPrompts?: IndividualIconPrompts;
  generatedIcons: GeneratedIcon[];
  currentStep: PipelineStep;
  errors: PipelineError[];
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// API request / response shapes (one per step; see docs/API-CONTRACT.md)
// ---------------------------------------------------------------------------

// Token usage reported by text/vision calls — used to compute realized cost.
export type TokenUsage = { inputTokens: number; outputTokens: number };

// POST /api/icons/analyze
export type AnalyzeRequest = {
  imageBase64: string;
  fileName?: string;
  model?: string;
};
export type AnalyzeResponse = { manifest: IconManifest; usage?: TokenUsage };

// POST /api/icons/compose-collection-prompt
export type ComposeCollectionPromptRequest = {
  manifest: IconManifest;
  model?: string;
};
export type ComposeCollectionPromptResponse = {
  collectionPrompt: string;
  usage?: TokenUsage;
};

// POST /api/icons/generate-collection-image
export type GenerateCollectionImageRequest = {
  sourceImageBase64: string;
  manifest: IconManifest;
  collectionPrompt: string;
  model?: string;
  quality?: "low" | "medium" | "high";
};
export type GenerateCollectionImageResponse = { collectionImage: CollectionImage };

// POST /api/icons/compose-individual-prompts
export type ComposeIndividualPromptsRequest = {
  collectionImageBase64: string;
  manifest: IconManifest;
  model?: string;
};
export type ComposeIndividualPromptsResponse = {
  individualPrompts: IndividualIconPrompts;
  usage?: TokenUsage;
};

// POST /api/icons/generate-one
export type GenerateOneRequest = {
  collectionImageBase64: string;
  sharedStylePrompt: string;
  iconPrompt: IndividualIconPrompt;
  model?: string;
  quality?: "low" | "medium" | "high";
};
export type GenerateOneResponse = { generatedIcon: GeneratedIcon };

// POST /api/icons/generate-batch
export type GenerateBatchRequest = {
  collectionImageBase64: string;
  individualPrompts: IndividualIconPrompts;
  model?: string;
  quality?: "low" | "medium" | "high";
};
export type GenerateBatchResponse = { generatedIcons: GeneratedIcon[] };

// ---------------------------------------------------------------------------
// Bench V2 — collapsed pipeline (mega-analyze → generate, source as reference)
// ---------------------------------------------------------------------------

// One vision pass merges §1 (analyze) and §4 (per-icon prompts): every icon
// carries both its manifest fields and a ready-to-generate prompt, derived from
// the source image alone (there is no collection image in V2).
export type MegaAnalysisIcon = {
  id: string;
  name: string;
  concept: string;
  whereVisible: string;
  visualDescription: string;
  confidence: Confidence;
  prompt: string; // final per-icon generation prompt
};

export type MegaAnalysis = {
  iconCount: number;
  sharedIconFamilyStyle: SharedIconFamilyStyle;
  sharedStylePrompt: string;
  icons: MegaAnalysisIcon[];
  excludedAsNonIcons: string[];
};

// POST /api/icons/mega-analyze
export type MegaAnalyzeRequest = {
  imageBase64: string;
  fileName?: string;
  model?: string;
};
export type MegaAnalyzeResponse = { analysis: MegaAnalysis; usage?: TokenUsage };

// The minimal per-icon payload §5 needs in V2 (no collectionImageReference —
// the reference is the source image, not a collection image).
export type GenerateIconV2Item = {
  iconId: string;
  iconName: string;
  concept: string;
  prompt: string;
};

// POST /api/icons/generate-icons-v2
export type GenerateIconsV2Request = {
  referenceImageBase64: string;
  sharedStylePrompt: string;
  icons: GenerateIconV2Item[];
  model?: string;
  quality?: "low" | "medium" | "high";
};
export type GenerateIconsV2Response = { generatedIcons: GeneratedIcon[] };

// ---------------------------------------------------------------------------
// Bench V3 — grid pipeline (one grid image, sliced locally)
// ---------------------------------------------------------------------------

export type SliceMode = "cv" | "math";

// POST /api/icons/generate-grid
export type GenerateGridRequest = {
  referenceImageBase64: string;
  sharedStylePrompt: string;
  icons: GenerateIconV2Item[]; // up to rows×cols, in reading order
  rows: number;
  cols: number;
  mode: SliceMode;
  model?: string;
  quality?: "low" | "medium" | "high";
};
export type GenerateGridResponse = {
  gridImageBase64: string; // the raw generated grid (for re-rolls / inspection)
  generatedIcons: GeneratedIcon[]; // the sliced icons
  expectedCount: number;
  detectedCount: number;
  mode: SliceMode;
};

// ---------------------------------------------------------------------------
// Bench S — source generation (source → elevated "source material")
// ---------------------------------------------------------------------------

// A read of the source's EXISTING visual identity (not a redesign), used to
// ground prompts and reusable later as a brand kit.
export type StyleBrief = {
  summary: string;
  colorPalette: string[];
  typography: string;
  lineStyle: string;
  shapeLanguage: string;
  mood: string[];
  strengths: string[];
  improvements: string[]; // what a polished version should fix, identity preserved
};

// POST /api/icons/style-brief
export type StyleBriefRequest = { imageBase64: string; model?: string };
export type StyleBriefResponse = { brief: StyleBrief; usage?: TokenUsage };

// POST /api/icons/elevate-source
export type ElevateSourceRequest = {
  imageBase64: string;
  improvements?: string[];
  model?: string;
  quality?: "low" | "medium" | "high";
};
export type ElevateSourceResponse = { imageBase64: string };
