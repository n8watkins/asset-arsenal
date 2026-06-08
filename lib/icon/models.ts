// Model roles for the 6-step pipeline. If a model ID is rejected by the live
// API, change it HERE and nowhere else.
//
// Steps 1 and 4 are vision calls (they read an image). Step 2 is text-only.
// Steps 3 and 5 are image generation via images.edit (they pass a reference
// image — the source image for the collection image, the collection image for icons).

export const MODEL_ROLES = {
  visionAnalyzerModel: "gpt-5.4-mini", // step 1: source image -> manifest JSON
  collectionPromptModel: "gpt-5.4-nano", // step 2: manifest -> collection prompt text
  collectionImageModel: "gpt-image-1-mini", // step 3: source + prompt -> collection image
  individualPromptModel: "gpt-5.4-mini", // step 4: collection image (vision) + manifest -> prompts JSON
  imageGeneratorModel: "gpt-image-1-mini", // step 5: collection image + prompt -> single icon
} as const;

export const COST_GUARDRAILS = {
  defaultVariantsPerIcon: 1,
  maxIconsPerRun: 25,
  hardMaxIconsPerRun: 40,
} as const;

export const DEFAULT_MAX_ICONS = COST_GUARDRAILS.maxIconsPerRun;
export const HARD_MAX_ICONS = COST_GUARDRAILS.hardMaxIconsPerRun;

export const IMAGE_UPLOAD_LIMITS = {
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] as const,
  maxFileSizeMB: 10,
} as const;

export const MAX_FILE_SIZE_BYTES = IMAGE_UPLOAD_LIMITS.maxFileSizeMB * 1024 * 1024;
