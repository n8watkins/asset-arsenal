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
