// Model roles and cost guardrails (PRD §7, §8, §18).
// If a model ID is rejected by the live API, change it HERE and nowhere else.

export const MODEL_ROLES = {
  visionAnalyzerModel: "gpt-5.4-mini", // image -> manifest JSON
  promptWriterModel: "gpt-5.4-nano", // manifest -> prompt pack JSON
  imageGeneratorModel: "gpt-image-1-mini", // prompt -> icon image
} as const;

export const COST_GUARDRAILS = {
  defaultVariantsPerIcon: 1,
  maxIconsPerRun: 25,
  hardMaxIconsPerRun: 40,
  allowPremiumRerender: false,
  requireManifestApprovalBeforeGeneration: true,
  requirePromptApprovalBeforeGeneration: true,
} as const;

export const DEFAULT_MAX_ICONS = COST_GUARDRAILS.maxIconsPerRun;
export const HARD_MAX_ICONS = COST_GUARDRAILS.hardMaxIconsPerRun;

export const IMAGE_UPLOAD_LIMITS = {
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"] as const,
  maxFileSizeMB: 10,
} as const;

export const MAX_FILE_SIZE_BYTES = IMAGE_UPLOAD_LIMITS.maxFileSizeMB * 1024 * 1024;
