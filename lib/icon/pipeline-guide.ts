// Plain-language glossary of the pipeline. Each ARTIFACT is the OUTPUT of one
// step, so this single list defines BOTH the artifact chain and the step list —
// guaranteeing they always agree (6 artifacts ⇔ 6 steps, 0–5).
//
// Step 0 (upload) produces the source and runs no AI. Steps 1–5 are the AI
// calls. `inputs` names which earlier artifacts feed each step. Step cost lives
// in model-reference.ts (STEPS / costForStep) — this file is the explanation.

export type ArtifactKey =
  | "source"
  | "manifest"
  | "collectionPrompt"
  | "collectionImage"
  | "iconPrompts"
  | "icons";

export type ArtifactDef = {
  key: ArtifactKey;
  /** Noun — the thing this step produces, e.g. "Manifest". */
  label: string;
  /** Step index, 0–5. Step 0 is the upload. */
  stepNum: number;
  /** Verb — what the step does, e.g. "Analyze image". */
  stepTitle: string;
  /** Earlier artifacts that feed this step (empty for the upload). */
  inputs: ArtifactKey[];
  /** True for step 0 (upload) — no model runs. */
  isUpload?: boolean;
  /** One short line — used on the chip summary. */
  oneLiner: string;
  /** Fuller explanation shown when the chip is expanded. */
  description: string;
  /** "image" artifacts render visually; "json"/"text" are data. */
  shape: "image" | "json" | "text";
};

export const ARTIFACTS: ArtifactDef[] = [
  {
    key: "source",
    label: "Source",
    stepNum: 0,
    stepTitle: "Upload source image",
    inputs: [],
    isUpload: true,
    oneLiner: "The image you upload that contains the icons.",
    description:
      "The screenshot or export you upload — a UI full of icons. It's the raw input to the whole pipeline; no AI runs at this stage. Everything downstream is derived from this image.",
    shape: "image",
  },
  {
    key: "manifest",
    label: "Manifest",
    stepNum: 1,
    stepTitle: "Analyze image",
    inputs: ["source"],
    oneLiner: "Structured JSON inventory of every icon + the shared style.",
    description:
      "A vision model looks at the source and returns structured JSON: each icon it found (name, concept, where it appears, a visual description, a confidence level) plus the shared icon-family style (color palette, line style, shape language, glow, background rule, negative rules). This is the machine-readable understanding of what's in the image.",
    shape: "json",
  },
  {
    key: "collectionPrompt",
    label: "Collection prompt",
    stepNum: 2,
    stepTitle: "Compose collection prompt",
    inputs: ["manifest"],
    oneLiner: "One image prompt describing the whole icon family.",
    description:
      "A text model turns the manifest into a single, polished natural-language image-generation prompt that describes the entire icon family as one cohesive image (grid layout, shared style, which icons to include). It's the instruction we'll hand to the image model next.",
    shape: "text",
  },
  {
    key: "collectionImage",
    label: "Collection image",
    stepNum: 3,
    stepTitle: "Generate collection image",
    inputs: ["source", "manifest", "collectionPrompt"],
    oneLiner: "One generated image of all icons together — the style anchor.",
    description:
      "An image model renders the whole family together in the shared style, using the source image as a visual reference. This single image becomes the style anchor for the rest of the run: the next two steps look at it (and pass it back to the model) so every individual icon matches it. It comes back as a base64 PNG, which we render directly — there's no hosted URL.",
    shape: "image",
  },
  {
    key: "iconPrompts",
    label: "Icon prompts",
    stepNum: 4,
    stepTitle: "Compose icon prompts",
    inputs: ["collectionImage", "manifest"],
    oneLiner: "One generation prompt per icon, plus a shared style paragraph.",
    description:
      "A vision model reads the collection image together with the manifest and writes one tightly-scoped generation prompt per icon — grounded in how the family actually rendered — plus a shared style paragraph reused across all of them. This is the per-icon recipe book.",
    shape: "json",
  },
  {
    key: "icons",
    label: "Icons",
    stepNum: 5,
    stepTitle: "Generate icons",
    inputs: ["collectionImage", "iconPrompts"],
    oneLiner: "The final standalone icon assets, one per prompt.",
    description:
      "An image model renders each icon as a standalone asset, passing the collection image as the reference so the family stays consistent. The output is one PNG per icon — the deliverable you'd hand to a designer or drop into a design system.",
    shape: "image",
  },
];

export function getArtifact(key: ArtifactKey): ArtifactDef {
  return ARTIFACTS.find((a) => a.key === key)!;
}
