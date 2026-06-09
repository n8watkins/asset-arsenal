// Experiment registry — the prompt variants ("hypotheses") we want to compare,
// per pipeline step.
//
// The insight that keeps this simple: across a hypothesis, the ONLY thing that
// changes is the prompt (and the model, which the stack already varies). So an
// experiment is just "this step, this prompt variant, this model" + a thumbs
// up/down on the result. This file is the single source of truth for the
// variants; the /experiments page renders them and (next) the bench will let
// you pick one per step.
//
// Default-variant templates are derived by calling the real builders in
// lib/icon/prompts.ts with placeholder tokens, so the page can never drift from
// the prompts actually sent.

import {
  ICON_ANALYSIS_PROMPT,
  buildCollectionPromptComposer,
  buildCollectionImageBody,
  buildIndividualPromptComposer,
  buildIconGenerationWrapper,
} from "@/lib/icon/prompts";
import { STEPS, DEFAULT_STACK, type StepKey } from "@/lib/icon/model-reference";

// Placeholder tokens used when rendering a template for display. At run time the
// builders interpolate the real artifacts in these same spots.
const T = {
  manifest: "{ICON_MANIFEST_JSON}",
  collectionPrompt: "{ICON_COLLECTION_PROMPT}",
  sharedStyle: "{SHARED_STYLE_PROMPT}",
  iconName: "{ICON_NAME}",
  iconConcept: "{ICON_CONCEPT}",
  iconPrompt: "{ICON_PROMPT}",
};

// How a JSON-producing step (§1, §4) is asked to return structured data. This is
// the heart of the experiment — same chain, three contracts.
export type OutputMode = "enforced" | "prompt-json" | "freeform";

export const OUTPUT_MODE_LABEL: Record<OutputMode, string> = {
  enforced: "schema-enforced",
  "prompt-json": "prompt-defined JSON",
  freeform: "free-form",
};

// The three headline strategies for the JSON steps — the thing you're really
// A/B/C-ing. Other steps have their own smaller variant pairs below.
export type Strategy = {
  mode: OutputMode;
  title: string;
  thesis: string; // one-sentence hypothesis
  detail: string; // a short plain-language explanation
  tradeoff: string;
};

export const STRATEGIES: Strategy[] = [
  {
    mode: "enforced",
    title: "Schema-enforced (baseline)",
    thesis:
      "Let OpenAI decode-constrain the output to our schema, and also describe the schema in the prompt.",
    detail:
      "The model literally cannot return malformed JSON — the API rejects anything off-schema before it reaches us, so the chain can never choke on a bad parse. The schema is also written into the prompt so it primes quality and stays portable.",
    tradeoff:
      "Maximum reliability; the enforcement itself is OpenAI-specific (other providers do it differently).",
  },
  {
    mode: "prompt-json",
    title: "Prompt-defined JSON",
    thesis:
      "The prompt alone fully specifies the JSON; we turn off API enforcement and parse the text ourselves.",
    detail:
      "Exactly the same prompt text, but nothing constrains the model at decode time. The contract lives entirely in the prompt, so the very same prompt ports to any model or provider unchanged.",
    tradeoff:
      "Fully portable; we have to parse and occasionally repair the output, and a model can drift off-shape.",
  },
  {
    mode: "freeform",
    title: "Free-form interpretation",
    thesis:
      "Give the model a light brief and let it describe the icons and style in its own structure.",
    detail:
      "No imposed schema at all. The bet is that an unconstrained model surfaces richer, more honest detail about the icon family; we normalize its answer back into our shape afterward before it feeds the next step.",
    tradeoff:
      "Potentially the best raw analysis; needs a normalization step, and is the least predictable to consume.",
  },
];

// ---------------------------------------------------------------------------
// Per-step prompt variants
// ---------------------------------------------------------------------------

export type PromptVariant = {
  id: string; // unique: "<step>:<slug>"
  step: StepKey;
  label: string;
  hypothesis: string; // what we're testing, in one line
  mode?: OutputMode; // only for JSON steps (§1, §4)
  isBaseline?: boolean; // the conservative default this deviates from
  template: string; // the prompt, with {TOKENS} where artifacts interpolate
};

// --- §1 analyze ---
const ANALYZE_FREEFORM = `You are an expert icon analyst.

Study the uploaded image and describe every meaningful icon you can find — what it
is, what it represents, where it appears, and how confident you are. Then describe
the shared visual style of the icon family (colors, line style, shape language,
any glow, background treatment, and what the style deliberately avoids).

Focus only on icons — ignore cards, charts, backgrounds, large illustrations, full
layout sections, and unreadable text. Group repeated icons into one type.

Write your answer in whatever clear, well-organized form best captures what you see.
Do not force a rigid template — be accurate and complete.`;

// --- §3 collection image (alt: lean on the image, minimal JSON) ---
const COLLECTION_IMAGE_LED = `Use the attached source image as the visual reference for the icon family's style.

Recreate the same family of icons as a single clean, production-ready collection
image on a tidy grid, faithful to the source's colors, line style, and shape
language. Keep the icons the primary focus; no labels, fake text, UI chrome, or
unrelated dashboard elements.

Style + intent to honor:
${T.collectionPrompt}`;

// --- §4 individual prompts (free-form variant) ---
const INDIVIDUAL_FREEFORM = `You are an expert icon prompt composer.

You will receive an icon manifest and an icon collection image showing the approved
family style. For each icon, write one image-generation prompt that produces a
single, centered, reusable 1:1 icon matching the family style — taken only from the
manifest's shared style fields and what you can interpret from the collection image,
never from any assumed aesthetic.

Also write one shared style paragraph to reuse across every icon.

Return your set of prompts in whatever clear structure best conveys, per icon: the
icon id, its name, its concept, where it sits in the collection image, and the final
prompt. Avoid labels, text, watermarks, dashboards, cards, charts, buttons, and
extra decoration in the icons themselves.

Input icon manifest:
${T.manifest}`;

// --- §5 wrapper (alt: strongly opinionated dark-mode aesthetic) ---
const WRAPPER_OPINIONATED = `Create exactly one isolated reusable icon asset.

Use the attached icon collection image as the visual style reference. Match the same
icon family style, stroke weight, glow intensity, proportions, padding, and dark-mode
presentation.

Shared icon family style:
${T.sharedStyle}

Icon to generate:
${T.iconName}

Icon concept:
${T.iconConcept}

Icon-specific prompt:
${T.iconPrompt}

Output requirements:
- generate one icon only
- 1:1 square composition
- centered with generous padding
- no text, letters, numbers, label, dashboard, card UI, chart UI, button UI
- no extra objects or decorative clutter
- transparent background if supported; otherwise use a simple dark navy background
- preserve the premium dark-mode SaaS/developer-dashboard icon family style
- make the icon reusable as a standalone dashboard asset`;

export const VARIANTS: PromptVariant[] = [
  // §1 analyze — the three strategies
  {
    id: "analyze:enforced",
    step: "analyze",
    label: "Schema-enforced + schema in prompt",
    hypothesis:
      "Decode-constrained JSON is bulletproof for the chain; the embedded schema also primes quality.",
    mode: "enforced",
    isBaseline: true,
    template: ICON_ANALYSIS_PROMPT,
  },
  {
    id: "analyze:prompt-json",
    step: "analyze",
    label: "Prompt-defined JSON (no enforcement)",
    hypothesis:
      "The same prompt carries the whole contract, so it ports to any model — at the cost of parsing it ourselves.",
    mode: "prompt-json",
    template: ICON_ANALYSIS_PROMPT,
  },
  {
    id: "analyze:freeform",
    step: "analyze",
    label: "Free-form analysis",
    hypothesis:
      "An unconstrained model may surface richer icon + style detail; we normalize it back into the schema after.",
    mode: "freeform",
    template: ANALYZE_FREEFORM,
  },

  // §2 collection prompt
  {
    id: "collectionPrompt:structured",
    step: "collectionPrompt",
    label: "Structured composer",
    hypothesis:
      "A fully-specified composer yields consistent, production-ready collection prompts.",
    isBaseline: true,
    template: buildCollectionPromptComposer(T.manifest),
  },

  // §3 collection image
  {
    id: "collectionImage:manifest-grounded",
    step: "collectionImage",
    label: "Manifest-grounded",
    hypothesis:
      "Passing the manifest as source-of-truth keeps the collection image faithful to the detected icon set.",
    isBaseline: true,
    template: buildCollectionImageBody(T.manifest, T.collectionPrompt),
  },
  {
    id: "collectionImage:image-led",
    step: "collectionImage",
    label: "Image-led (minimal JSON)",
    hypothesis:
      "Leaning on the source image with little JSON may avoid over-constraining the image model.",
    template: COLLECTION_IMAGE_LED,
  },

  // §4 individual prompts — same three strategies as §1
  {
    id: "individualPrompts:enforced",
    step: "individualPrompts",
    label: "Schema-enforced + schema in prompt",
    hypothesis:
      "Reliable per-icon prompt JSON keeps §5 fed; style is sourced from the manifest + collection image only.",
    mode: "enforced",
    isBaseline: true,
    template: buildIndividualPromptComposer(T.manifest),
  },
  {
    id: "individualPrompts:prompt-json",
    step: "individualPrompts",
    label: "Prompt-defined JSON (no enforcement)",
    hypothesis:
      "Portable contract — the same composer prompt runs anywhere if we parse the result ourselves.",
    mode: "prompt-json",
    template: buildIndividualPromptComposer(T.manifest),
  },
  {
    id: "individualPrompts:freeform",
    step: "individualPrompts",
    label: "Free-form composer",
    hypothesis:
      "Letting the model structure its own prompt set may read more naturally; normalize before §5.",
    mode: "freeform",
    template: INDIVIDUAL_FREEFORM,
  },

  // §5 generate icons
  {
    id: "generateIcons:generalized",
    step: "generateIcons",
    label: "Generalized (style from source only)",
    hypothesis:
      "Sourcing style only from the shared prompt + collection image keeps the family faithful to whatever the source defined.",
    isBaseline: true,
    template: buildIconGenerationWrapper({
      sharedStylePrompt: T.sharedStyle,
      iconName: T.iconName,
      iconConcept: T.iconConcept,
      iconPrompt: T.iconPrompt,
    }),
  },
  {
    id: "generateIcons:opinionated",
    step: "generateIcons",
    label: "Opinionated dark-mode aesthetic",
    hypothesis:
      "A strong, opinionated 'premium dark-mode SaaS' aesthetic may yield a more cohesive family, even if less faithful to the source.",
    template: WRAPPER_OPINIONATED,
  },
];

export function variantsForStep(step: StepKey): PromptVariant[] {
  return VARIANTS.filter((v) => v.step === step);
}

// ---------------------------------------------------------------------------
// Baseline — the conservative "run this first" configuration. Cheapest models
// (DEFAULT_STACK already resolves to the nano/mini/-mini roles) + the
// schema-enforced / structured variant on every step. Everything else is framed
// as a deviation from this.
// ---------------------------------------------------------------------------

export const BASELINE = {
  stackName: DEFAULT_STACK.name,
  models: DEFAULT_STACK.models,
  variantByStep: Object.fromEntries(
    STEPS.map((s) => [s.key, VARIANTS.find((v) => v.step === s.key && v.isBaseline)!.id]),
  ) as Record<StepKey, string>,
  why:
    "Cheapest models + the most-structured prompt on every step. It's the most predictable and the least expensive, so it's the honest yardstick: get this working end-to-end first, then change one thing at a time and judge it against this.",
};

// Step metadata for display (number + human name), keyed for convenience.
export const STEP_META: Record<StepKey, { num: number; name: string }> =
  Object.fromEntries(STEPS.map((s) => [s.key, { num: s.num, name: s.name }])) as Record<
    StepKey,
    { num: number; name: string }
  >;
