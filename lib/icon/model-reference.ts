// Model reference data for the /models infographic page.
//
// Sourced from OpenAI's official docs (developers.openai.com) on the date below
// via research. Pricing and capabilities change — update this file and bump
// REFERENCE_ACCESSED when you re-verify. Citations live alongside each model so
// every number on the page is traceable.

export const REFERENCE_ACCESSED = "2026-06-08";

export type Citation = { label: string; url: string };

export type Modalities = {
  textIn: boolean;
  textOut: boolean;
  visionIn: boolean;
  imageOut: boolean;
};

export type TokenPricing = {
  inputPerM: number;
  cachedInputPerM?: number;
  outputPerM: number;
};

// Per-image USD at 1024×1024 by quality tier.
export type PerImagePricing = { low: number; medium: number; high: number };

export type ModelRef = {
  id: string;
  tier: string; // short label, e.g. "mini · text+vision"
  role: string; // role in THIS app's pipeline
  pipelineSteps: string; // which steps use it
  whatItDoes: string;
  modalities: Modalities;
  contextWindow?: number;
  maxOutput?: number;
  knowledgeCutoff?: string;
  tokenPricing?: TokenPricing;
  image?: {
    perImage1024: PerImagePricing;
    sizes: string[];
    imageOutputPerM: number;
    textInputPerM: number;
    imageInputCachedPerM: number;
    outputTokens1024: { low: number; medium: number; high: number };
  };
  verification: string; // verification status note
  citations: Citation[];
};

export const MODELS: ModelRef[] = [
  {
    id: "gpt-5.4-mini",
    tier: "mini · text + vision",
    role: "Vision analysis + per-icon prompt composition",
    pipelineSteps: "Step 1 (analyze) · Step 4 (compose individual prompts)",
    whatItDoes:
      "OpenAI's strongest GPT-5.4 “mini” tier — faster and cheaper than full GPT-5.4, above gpt-5.4-nano. Reads the uploaded screenshot and the generated contact sheet and returns structured JSON. Released 2026-03-17.",
    modalities: { textIn: true, textOut: true, visionIn: true, imageOut: false },
    contextWindow: 400_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2025-08-31",
    tokenPricing: { inputPerM: 0.75, cachedInputPerM: 0.075, outputPerM: 4.5 },
    verification: "Verified — exact ID in official docs.",
    citations: [
      { label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-5.4-mini" },
      { label: "Pricing", url: "https://developers.openai.com/api/docs/pricing" },
      { label: "Announcement", url: "https://openai.com/index/introducing-gpt-5-4-mini-and-nano/" },
    ],
  },
  {
    id: "gpt-5.4-nano",
    tier: "nano · text",
    role: "Collection-prompt composition (text only)",
    pipelineSteps: "Step 2 (compose collection prompt)",
    whatItDoes:
      "The cheapest GPT-5.4 tier, built for simple high-volume tasks (extraction, classification, ranking). Here it turns the JSON manifest into a single natural-language image prompt. Vision-capable but used text-only. Released 2026-03-17.",
    modalities: { textIn: true, textOut: true, visionIn: true, imageOut: false },
    contextWindow: 400_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2025-08-31",
    tokenPricing: { inputPerM: 0.2, cachedInputPerM: 0.02, outputPerM: 1.25 },
    verification: "Verified — exact ID in official docs.",
    citations: [
      { label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-5.4-nano" },
      { label: "Pricing", url: "https://developers.openai.com/api/docs/pricing" },
      { label: "Announcement", url: "https://openai.com/index/introducing-gpt-5-4-mini-and-nano/" },
    ],
  },
  {
    id: "gpt-image-1-mini",
    tier: "image · text+image in → image out",
    role: "Image generation (contact sheet + each icon)",
    pipelineSteps: "Step 3 (contact sheet) · Step 5 (each icon), via images.edit",
    whatItDoes:
      "Cost-efficient GPT Image 1 — natively multimodal (text + image in, image out), ~80% cheaper than full gpt-image-1, strong at rendering text/UI elements. Called via images.edit (reference image + prompt → PNG). Released Oct 2025.",
    modalities: { textIn: true, textOut: false, visionIn: true, imageOut: true },
    knowledgeCutoff: undefined,
    image: {
      perImage1024: { low: 0.005, medium: 0.011, high: 0.036 },
      sizes: ["1024×1024", "1024×1536", "1536×1024"],
      imageOutputPerM: 8.0,
      textInputPerM: 2.0,
      imageInputCachedPerM: 0.25,
      outputTokens1024: { low: 272, medium: 1056, high: 4160 },
    },
    verification:
      "Verified — exact ID in official docs. Two capability claims are secondary-source only (see caveats): no input_fidelity on the mini variant, and transparent background may not apply on the edit endpoint.",
    citations: [
      { label: "Model page", url: "https://developers.openai.com/api/docs/models/gpt-image-1-mini" },
      { label: "Image guide", url: "https://developers.openai.com/api/docs/guides/image-generation" },
      { label: "Pricing", url: "https://developers.openai.com/api/docs/pricing" },
    ],
  },
];

// Representative cost for one run with ~15 icons. Image costs are exact per
// OpenAI's per-image table; text/vision token counts are ESTIMATES (stated).
export type RunLine = {
  step: string;
  model: string;
  detail: string;
  cost: number;
  exact: boolean;
};

export const RUN_ESTIMATE: { iconCount: number; lines: RunLine[] } = {
  iconCount: 15,
  lines: [
    { step: "Analyze image → manifest", model: "gpt-5.4-mini", detail: "~1.5k in + 0.8k out (est.)", cost: 0.0047, exact: false },
    { step: "Compose collection prompt", model: "gpt-5.4-nano", detail: "~1k in + 0.6k out (est.)", cost: 0.0008, exact: false },
    { step: "Contact sheet image", model: "gpt-image-1-mini", detail: "1× 1024², HIGH", cost: 0.036, exact: true },
    { step: "Compose individual prompts", model: "gpt-5.4-mini", detail: "~1k in + 0.6k out (est.)", cost: 0.0035, exact: false },
    { step: "Generate icons", model: "gpt-image-1-mini", detail: "15× 1024², MEDIUM", cost: 0.165, exact: true },
  ],
};

export const RUN_ESTIMATE_TOTAL = RUN_ESTIMATE.lines.reduce((s, l) => s + l.cost, 0);

// Honest caveats surfaced from the research.
export const CAVEATS: { title: string; body: string; source?: Citation }[] = [
  {
    title: "Image generation dominates cost",
    body: "In the example run, image steps are ~$0.20 of ~$0.21; all the text/vision calls together are under $0.01. Each extra MEDIUM icon adds ≈ $0.011; one HIGH contact sheet ($0.036) costs about as much as ~3.3 MEDIUM icons.",
  },
  {
    title: "Reference images add a little input cost",
    body: "Every images.edit call also passes a reference image (the source image, then the contact sheet). That bills image-input tokens on top of the per-image output price — cached rate $0.25/1M ≈ $0.00025/image (negligible), but up to the $2.00/1M uncached rate.",
  },
  {
    title: "Transparent background on images.edit — UNVERIFIED",
    body: "Our generate-icon step passes background:\"transparent\" to images.edit. Research (secondary sources) indicates transparency is a generate-endpoint feature and may not apply on edit for the gpt-image-1 family. Needs a live API test; transparency may be silently ignored.",
    source: { label: "OpenAI community thread", url: "https://community.openai.com/t/gpt-image-1-transparent-backgrounds-with-edit-request/1240577" },
  },
  {
    title: "gpt-image-1-mini image-input rate discrepancy",
    body: "The pricing table lists image-input at $0.25/1M (cached) while one model-page fetch showed $2.50/1M. Treat $2.00 uncached / $0.25 cached as authoritative but re-confirm against the live table if exact image-input cost matters.",
  },
];
