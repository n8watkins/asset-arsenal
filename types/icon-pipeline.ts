// Core domain types for the Asset Arsenal icon extraction pipeline (PRD §13).
// These are the canonical TypeScript types; Zod schemas in lib/icon/schemas
// mirror the subset that crosses the OpenAI boundary.

export type Confidence = "high" | "medium" | "low";

export type PipelineStep =
  | "idle"
  | "image_uploaded"
  | "analyzing_icons"
  | "manifest_ready"
  | "generating_prompts"
  | "prompts_ready"
  | "generating_icons"
  | "icons_ready"
  | "error";

export type SourceImage = {
  id: string;
  imageUrl: string; // object URL or data URL
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  uploadedAt: string;
};

export type DecomposedIcon = {
  id: string;
  name: string;
  meaning: string;
  locationInImage: string;
  visualDescription: string;
  styleNotes: string;
  confidence: Confidence;
};

export type IconFamilyStyle = {
  summary: string;
  colorPalette: string[];
  lineStyle: string;
  shapeLanguage: string;
  glowStyle?: string | null;
  backgroundRule: string;
  negativeRules: string[];
};

export type IconManifest = {
  imageSummary: string;
  iconCount: number;
  iconFamilyStyle: IconFamilyStyle;
  icons: DecomposedIcon[];
  notes: string[];
};

export type IconPrompt = {
  iconId: string;
  iconName: string;
  prompt: string;
  aspectRatio: "1:1";
  recommendedModel: "gpt-image-1-mini";
  notes?: string | null;
};

export type IconPromptPack = {
  sharedStyleSummary: string;
  prompts: IconPrompt[];
};

export type GeneratedIconStatus = "pending" | "generating" | "success" | "failed";

export type GeneratedIcon = {
  id: string;
  iconId: string;
  iconName: string;
  prompt: string;
  imageUrl: string; // data URL once generated, "" while pending
  modelUsed: string;
  status: GeneratedIconStatus;
  error?: string;
  createdAt: string;
};

export type PipelineErrorStep =
  | "upload"
  | "analysis"
  | "prompt_generation"
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
  promptPack?: IconPromptPack;
  generatedIcons: GeneratedIcon[];
  currentStep: PipelineStep;
  errors: PipelineError[];
  createdAt: string;
  updatedAt: string;
};

// ---- API request/response shapes (PRD §14) ----

export type IconAnalysisRequest = { imageBase64: string; fileName?: string };
export type IconAnalysisResponse = { manifest: IconManifest };

export type IconPromptsRequest = { manifest: IconManifest };
export type IconPromptsResponse = { promptPack: IconPromptPack };

export type GenerateIconRequest = {
  icon: DecomposedIcon;
  prompt: IconPrompt;
  iconFamilyStyle: IconFamilyStyle;
};
export type GenerateIconResponse = { generatedIcon: GeneratedIcon };

export type GenerateIconsBatchRequest = {
  manifest: IconManifest;
  promptPack: IconPromptPack;
};
export type GenerateIconsBatchResponse = { generatedIcons: GeneratedIcon[] };
