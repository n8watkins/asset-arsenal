// Model reference + cost model for the /models page.
//
// Sourced from OpenAI's official docs (developers.openai.com) on REFERENCE_ACCESSED
// via research. Pricing and capabilities change — update this file and bump the
// date when you re-verify. Every figure is traceable to a citation below.
//
// Designed to expand: today it's the OpenAI "vertical stack", but the shapes
// (Provider, Capability, CatalogModel, PipelineStep, Stack) are provider-neutral
// so Gemini / Flux / etc. can be added as more catalog entries later.

import { MODEL_ROLES } from "@/lib/icon/models";

export const REFERENCE_ACCESSED = "2026-06-08";

export type Citation = { label: string; url: string };

export type Provider = "OpenAI" | "Google"; // future: "BlackForestLabs" | ...

// What a model can do / what a step needs. Steps list required + preferred caps.
export type Capability =
  | "text"
  | "vision"
  | "structuredOutput"
  | "imageEdit"
  | "transparentBg";

export const CAPABILITY_LABEL: Record<Capability, string> = {
  text: "text",
  vision: "vision in",
  structuredOutput: "structured JSON",
  imageEdit: "image edit (reference)",
  transparentBg: "transparent bg",
};

export type ModelStatus = "current" | "deprecated";

export type CatalogModel = {
  id: string;
  provider: Provider;
  kind: "text" | "image";
  capabilities: Capability[];
  contextWindow?: number;
  maxOutput?: number;
  knowledgeCutoff?: string;
  // text models
  tokenPricing?: { inputPerM: number; cachedInputPerM?: number; outputPerM: number };
  // image models — USD per image at 1024×1024 by quality
  imagePricing?: { low: number; medium: number; high: number };
  status: ModelStatus;
  deprecation?: { since: string; shutdown: string };
  // We currently call this model on a free tier — realized cost is $0 even if
  // paid-tier tokenPricing is listed. One switch to flip when we go paid.
  freeTier?: boolean;
  // Free-tier requests-per-day cap (RPD). Set only on free-tier models we track
  // daily quota for (the Gemini rows today). Drives the "free tier today"
  // meters on /usage and the Fable usage panel.
  freeTierDailyRequests?: number;
  note?: string;
  citations: Citation[];
};

// ---------------------------------------------------------------------------
// Catalog — current, non-deprecated-first. Deprecated items kept but flagged
// (they still work until shutdown and matter for our active stack).
// ---------------------------------------------------------------------------

const PRICING: Citation = { label: "Pricing", url: "https://developers.openai.com/api/docs/pricing" };
const DEPRECATIONS: Citation = { label: "Deprecations", url: "https://developers.openai.com/api/docs/deprecations" };
const GEMINI_MODELS_DOC: Citation = { label: "Gemini models", url: "https://ai.google.dev/gemini-api/docs/models" };

// Gemini free-tier daily request limits (RPD), per model.
// TODO confirm current published RPD; owner cited 500 for flash-lite.
const GEMINI_FLASH_LITE_FREE_RPD = 1000;
const GEMINI_FLASH_FREE_RPD = 250;
const GEMINI_PRO_FREE_RPD = 100;

export const CATALOG: CatalogModel[] = [
  // --- Text / vision ---
  {
    id: "gpt-5.4-nano",
    provider: "OpenAI",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    contextWindow: 400_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2025-08-31",
    tokenPricing: { inputPerM: 0.2, cachedInputPerM: 0.02, outputPerM: 1.25 },
    status: "current",
    note: "Cheapest GPT-5.4 tier; built for simple high-volume tasks.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-5.4-nano" }, PRICING],
  },
  {
    id: "gpt-5.4-mini",
    provider: "OpenAI",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    contextWindow: 400_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2025-08-31",
    tokenPricing: { inputPerM: 0.75, cachedInputPerM: 0.075, outputPerM: 4.5 },
    status: "current",
    note: "Strong cost/capability balance for vision + JSON steps.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-5.4-mini" }, PRICING],
  },
  {
    id: "gpt-5.4",
    provider: "OpenAI",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2025-08-31",
    tokenPricing: { inputPerM: 2.5, cachedInputPerM: 0.25, outputPerM: 15.0 },
    status: "current",
    note: "Frontier model; more headroom than mini at higher cost.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-5.4" }, PRICING],
  },
  {
    id: "gpt-5.5",
    provider: "OpenAI",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2025-12-01",
    tokenPricing: { inputPerM: 5.0, cachedInputPerM: 0.5, outputPerM: 30.0 },
    status: "current",
    note: "Current flagship; highest quality, ~2× the cost of gpt-5.4.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-5.5" }, PRICING],
  },
  {
    id: "gpt-4.1",
    provider: "OpenAI",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    contextWindow: 1_047_576,
    maxOutput: 32_768,
    tokenPricing: { inputPerM: 2.0, cachedInputPerM: 0.5, outputPerM: 8.0 },
    status: "current",
    note: "Previous-gen non-reasoning model; viable fallback, superseded by 5.x.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-4.1" }, PRICING],
  },
  {
    id: "gpt-5.4-pro",
    provider: "OpenAI",
    kind: "text",
    capabilities: ["text", "vision"], // NOTE: no structuredOutput → cannot do steps 1/4
    contextWindow: 1_050_000,
    maxOutput: 128_000,
    tokenPricing: { inputPerM: 30.0, outputPerM: 180.0 },
    status: "current",
    note: "Reasoning Pro tier. No structured outputs — only fits the text-only step. Slow/expensive.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-5.4-pro" }, PRICING],
  },

  // --- Image generation (images.edit) ---
  {
    id: "gpt-image-1-mini",
    provider: "OpenAI",
    kind: "image",
    capabilities: ["imageEdit", "transparentBg"],
    imagePricing: { low: 0.005, medium: 0.011, high: 0.036 },
    status: "deprecated",
    deprecation: { since: "2026-06-02", shutdown: "2026-12-01" },
    note: "App's current image model. Cheapest; transparency works on edit; no input_fidelity.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-image-1-mini" }, PRICING, DEPRECATIONS],
  },
  {
    id: "gpt-image-1.5",
    provider: "OpenAI",
    kind: "image",
    capabilities: ["imageEdit", "transparentBg"],
    imagePricing: { low: 0.009, medium: 0.034, high: 0.133 },
    status: "deprecated",
    deprecation: { since: "2026-06-02", shutdown: "2026-12-01" },
    note: "Closest match to current behavior (transparency + input_fidelity). Now deprecated.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-image-1.5" }, PRICING, DEPRECATIONS],
  },
  {
    id: "gpt-image-1",
    provider: "OpenAI",
    kind: "image",
    capabilities: ["imageEdit", "transparentBg"],
    imagePricing: { low: 0.011, medium: 0.042, high: 0.167 },
    status: "deprecated",
    deprecation: { since: "2026-06-02", shutdown: "2026-12-01" },
    note: "Original GPT Image; priciest of the 1.x line. Transparency + input_fidelity.",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-image-1" }, PRICING, DEPRECATIONS],
  },
  {
    id: "gpt-image-2",
    provider: "OpenAI",
    kind: "image",
    capabilities: ["imageEdit"], // NOTE: no transparentBg
    imagePricing: { low: 0.006, medium: 0.053, high: 0.211 },
    status: "current",
    note: "Only non-deprecated image model — but does NOT support transparent backgrounds (breaks transparent icons).",
    citations: [{ label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-image-2" }, PRICING],
  },

  // --- Google (Gemini) — text/vision, used by fable + router + judges --------
  // All on the free tier today (realized cost $0); no paid tokenPricing listed
  // until we actually move tiers, so cost helpers correctly return 0.
  {
    id: "gemini-3.1-flash-lite",
    provider: "Google",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    status: "current",
    freeTier: true,
    freeTierDailyRequests: GEMINI_FLASH_LITE_FREE_RPD,
    note: "Cheapest Gemini tier; default for routing/classification and fable analysis.",
    citations: [GEMINI_MODELS_DOC],
  },
  {
    id: "gemini-3.1-flash",
    provider: "Google",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    status: "current",
    freeTier: true,
    freeTierDailyRequests: GEMINI_FLASH_FREE_RPD,
    note: "Stronger reasoning than Flash-Lite; still free-tier.",
    citations: [GEMINI_MODELS_DOC],
  },
  {
    id: "gemini-3.1-pro",
    provider: "Google",
    kind: "text",
    capabilities: ["text", "vision", "structuredOutput"],
    status: "current",
    freeTier: true,
    freeTierDailyRequests: GEMINI_PRO_FREE_RPD,
    note: "Strongest Gemini; for close-call judging.",
    citations: [GEMINI_MODELS_DOC],
  },
];

export function getModel(id: string): CatalogModel | undefined {
  return CATALOG.find((m) => m.id === id);
}

// ---------------------------------------------------------------------------
// Pipeline steps — the vertical stack. Step 0 (upload) is free / no model.
// ---------------------------------------------------------------------------

export type StepKey =
  | "analyze"
  | "collectionPrompt"
  | "collectionImage"
  | "individualPrompts"
  | "generateIcons";

export type PipelineStep = {
  num: number;
  key: StepKey;
  name: string;
  description: string;
  kind: "text" | "image";
  requires: Capability[]; // hard — filters compatible models
  prefers?: Capability[]; // soft — warn if the chosen model lacks it
  defaultModelId: string;
  // cost-estimate inputs
  textEstimate?: { inputTokens: number; outputTokens: number };
  image?: { defaultQuality: "low" | "medium" | "high"; perRun: "one" | "perIcon" };
};

export const STEPS: PipelineStep[] = [
  {
    num: 1,
    key: "analyze",
    name: "Analyze image → manifest",
    description:
      "A vision model reads the uploaded screenshot and returns a structured JSON inventory of every icon plus the shared family style.",
    kind: "text",
    requires: ["text", "vision", "structuredOutput"],
    defaultModelId: MODEL_ROLES.visionAnalyzerModel,
    textEstimate: { inputTokens: 1500, outputTokens: 800 },
  },
  {
    num: 2,
    key: "collectionPrompt",
    name: "Compose collection prompt",
    description:
      "A text model turns the JSON manifest into one natural-language prompt that describes the whole icon family as a single image.",
    kind: "text",
    requires: ["text"],
    defaultModelId: MODEL_ROLES.collectionPromptModel,
    textEstimate: { inputTokens: 1000, outputTokens: 600 },
  },
  {
    num: 3,
    key: "collectionImage",
    name: "Generate collection image",
    description:
      "An image model renders the whole family together (the collection image) from the source image + manifest + prompt. This image is the visual style anchor for every icon.",
    kind: "image",
    requires: ["imageEdit"],
    defaultModelId: MODEL_ROLES.collectionImageModel,
    image: { defaultQuality: "high", perRun: "one" },
  },
  {
    num: 4,
    key: "individualPrompts",
    name: "Compose per-icon prompts",
    description:
      "A vision model reads the collection image + manifest and writes one tightly-scoped generation prompt per icon, grounded in the rendered style.",
    kind: "text",
    requires: ["text", "vision", "structuredOutput"],
    defaultModelId: MODEL_ROLES.individualPromptModel,
    textEstimate: { inputTokens: 1500, outputTokens: 2000 },
  },
  {
    num: 5,
    key: "generateIcons",
    name: "Generate each icon",
    description:
      "An image model renders each icon as a standalone asset, using the collection image as the reference so the family stays consistent. Repeats once per icon.",
    kind: "image",
    requires: ["imageEdit"],
    prefers: ["transparentBg"],
    defaultModelId: MODEL_ROLES.imageGeneratorModel,
    image: { defaultQuality: "medium", perRun: "perIcon" },
  },
];

export function compatibleModels(step: PipelineStep): CatalogModel[] {
  return CATALOG.filter(
    (m) => m.kind === step.kind && step.requires.every((c) => m.capabilities.includes(c)),
  );
}

// ---------------------------------------------------------------------------
// Stack = a chosen model (+ quality) per step. The active stack is derived from
// the app's real config (MODEL_ROLES) so "what we rely on" is always accurate.
// ---------------------------------------------------------------------------

export type ImageQuality = "low" | "medium" | "high";

export type Stack = {
  name: string;
  models: Record<StepKey, string>;
  quality: { collectionImage: ImageQuality; generateIcons: ImageQuality };
  iconCount: number;
};

export const DEFAULT_STACK: Stack = {
  name: "Active stack (current config)",
  models: {
    analyze: MODEL_ROLES.visionAnalyzerModel,
    collectionPrompt: MODEL_ROLES.collectionPromptModel,
    collectionImage: MODEL_ROLES.collectionImageModel,
    individualPrompts: MODEL_ROLES.individualPromptModel,
    generateIcons: MODEL_ROLES.imageGeneratorModel,
  },
  quality: { collectionImage: "high", generateIcons: "medium" },
  iconCount: 15,
};

// ---------------------------------------------------------------------------
// Cost model
// ---------------------------------------------------------------------------

export type StepCost = {
  step: PipelineStep;
  modelId: string;
  detail: string;
  cost: number;
  exact: boolean; // image costs are exact; text costs use token estimates
  warning?: string; // e.g. chosen model lacks a preferred capability
};

export function costForStep(step: PipelineStep, stack: Stack): StepCost {
  const modelId = stack.models[step.key];
  const model = getModel(modelId);
  const base: Omit<StepCost, "cost" | "detail" | "exact"> = { step, modelId };

  if (!model) {
    return { ...base, cost: 0, detail: "unknown model", exact: false, warning: "Model not in catalog." };
  }

  // Soft-requirement warning (e.g. transparent background on the icon step).
  let warning: string | undefined;
  if (step.prefers) {
    const missing = step.prefers.filter((c) => !model.capabilities.includes(c));
    if (missing.length) {
      warning = `Lacks ${missing.map((c) => CAPABILITY_LABEL[c]).join(", ")} — needed for this step's intended output.`;
    }
  }
  if (model.status === "deprecated" && model.deprecation) {
    const dep = `Deprecated ${model.deprecation.since}; shuts down ${model.deprecation.shutdown}.`;
    warning = warning ? `${warning} ${dep}` : dep;
  }

  if (step.kind === "text" && model.tokenPricing && step.textEstimate) {
    const { inputTokens, outputTokens } = step.textEstimate;
    const cost =
      (inputTokens * model.tokenPricing.inputPerM + outputTokens * model.tokenPricing.outputPerM) /
      1_000_000;
    return {
      ...base,
      cost,
      detail: `~${inputTokens.toLocaleString()} in + ${outputTokens.toLocaleString()} out (est.)`,
      exact: false,
      warning,
    };
  }

  if (step.kind === "image" && model.imagePricing && step.image) {
    const quality = step.key === "collectionImage" ? stack.quality.collectionImage : stack.quality.generateIcons;
    const count = step.image.perRun === "perIcon" ? stack.iconCount : 1;
    const per = model.imagePricing[quality];
    return {
      ...base,
      cost: per * count,
      detail: `${count}× 1024² ${quality.toUpperCase()} @ ${usdShort(per)}`,
      exact: true,
      warning,
    };
  }

  return { ...base, cost: 0, detail: "no pricing for this model/step", exact: false, warning };
}

export function costForStack(stack: Stack): { lines: StepCost[]; total: number } {
  const lines = STEPS.map((s) => costForStep(s, stack));
  return { lines, total: lines.reduce((sum, l) => sum + l.cost, 0) };
}

function usdShort(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
}

// --- Per-call cost helpers (used by usage tracking + realized cost) ----------

/** Exact realized cost of a text/vision call from reported token usage. */
export function realizedTextCostUSD(
  modelId: string,
  usage: { inputTokens: number; outputTokens: number },
): number {
  const m = getModel(modelId);
  if (!m?.tokenPricing) return 0;
  return (
    (usage.inputTokens * m.tokenPricing.inputPerM +
      usage.outputTokens * m.tokenPricing.outputPerM) /
    1_000_000
  );
}

/** Exact cost of one or more generated images (deterministic per-image price). */
export function imageCostUSD(
  modelId: string,
  quality: ImageQuality,
  count = 1,
): number {
  const m = getModel(modelId);
  if (!m?.imagePricing) return 0;
  return m.imagePricing[quality] * count;
}

/**
 * Estimated cost of a single step call BEFORE running it. Text steps use the
 * step's token estimate; image steps are exact per-image × count.
 */
export function estimateStepCostUSD(
  stepKey: StepKey,
  modelId: string,
  opts?: { quality?: ImageQuality; count?: number },
): number {
  const step = STEPS.find((s) => s.key === stepKey);
  const model = getModel(modelId);
  if (!step || !model) return 0;
  if (step.kind === "text" && model.tokenPricing && step.textEstimate) {
    return realizedTextCostUSD(modelId, {
      inputTokens: step.textEstimate.inputTokens,
      outputTokens: step.textEstimate.outputTokens,
    });
  }
  if (step.kind === "image" && model.imagePricing) {
    const quality = opts?.quality ?? step.image?.defaultQuality ?? "medium";
    return imageCostUSD(modelId, quality, opts?.count ?? 1);
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Sources (top-of-page) + caveats
// ---------------------------------------------------------------------------

export const SOURCES: Citation[] = [
  { label: "OpenAI Pricing", url: "https://developers.openai.com/api/docs/pricing" },
  { label: "Models index", url: "https://developers.openai.com/api/docs/models" },
  { label: "Image generation guide", url: "https://developers.openai.com/api/docs/guides/image-generation" },
  { label: "images.edit reference", url: "https://developers.openai.com/api/reference/python/resources/images/methods/edit" },
  { label: "Deprecations", url: "https://developers.openai.com/api/docs/deprecations" },
  { label: "GPT-5.4 mini/nano announcement", url: "https://openai.com/index/introducing-gpt-5-4-mini-and-nano/" },
];

export const CAVEATS: { title: string; body: string; severity: "warn" | "info"; source?: Citation }[] = [
  {
    title: "Our image model is deprecated (shutdown 2026-12-01)",
    severity: "warn",
    body: "gpt-image-1-mini — used for steps 3 & 5 — was deprecated 2026-06-02 along with the whole gpt-image-1.x family. It still works until 2026-12-01, but we need a migration path before then.",
    source: DEPRECATIONS,
  },
  {
    title: "The only current image model can't do transparent icons",
    severity: "warn",
    body: "gpt-image-2 is the sole non-deprecated image model, but it does not support transparent backgrounds at all. Moving step 5 to it would break transparent icons unless we add post-processing. Within the deprecation window, gpt-image-1.5 is the higher-fidelity transparency-capable option (it keeps transparency + input_fidelity), so it — not gpt-image-2 — is the natural interim migration target off gpt-image-1-mini until OpenAI ships a current model with transparency.",
    source: { label: "Image guide", url: "https://developers.openai.com/api/docs/guides/image-generation" },
  },
  {
    title: "gpt-5.4-pro can't do the JSON steps",
    severity: "info",
    body: "gpt-5.4-pro has vision but no structured-output support, so it only qualifies for the text-only step (2). gpt-5.5-pro does support structured outputs but is slow/expensive.",
  },
  {
    title: "Image generation dominates cost; text is rounding error",
    severity: "info",
    body: "On the default stack, the image steps are ~95% of the spend. Each extra medium icon ≈ $0.011; one HIGH collection image ≈ 3 medium icons. Text/vision token counts here are estimates — the image per-image prices are exact from OpenAI's table.",
  },
];
