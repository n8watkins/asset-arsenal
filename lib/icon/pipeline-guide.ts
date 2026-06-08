// Plain-language glossary of the pipeline's artifacts — the data that flows
// between steps. Used by the bench's PipelineOutline (clickable descriptions)
// so the chain is understandable at a glance. Step descriptions live in
// `STEPS` in model-reference.ts; this file describes the ARTIFACTS between them.

export type ArtifactKey =
  | "source"
  | "manifest"
  | "collectionPrompt"
  | "collectionImage"
  | "iconPrompts"
  | "icons";

export type ArtifactDef = {
  key: ArtifactKey;
  label: string;
  /** One short line — used on the chip / summary. */
  oneLiner: string;
  /** Fuller explanation shown when the chip is expanded. */
  description: string;
  /** Pipeline step that produces it (null = uploaded, no AI). */
  producedByStep: number | null;
  /** "image" artifacts render visually; "json"/"text" are data. */
  shape: "image" | "json" | "text";
};

export const ARTIFACTS: ArtifactDef[] = [
  {
    key: "source",
    label: "Source",
    oneLiner: "The image you upload that contains the icons.",
    description:
      "The screenshot or export you upload — a UI full of icons. It's the raw input to the whole pipeline; no AI runs at this stage. Everything downstream is derived from this image.",
    producedByStep: null,
    shape: "image",
  },
  {
    key: "manifest",
    label: "Manifest",
    oneLiner: "Structured JSON inventory of every icon + the shared style.",
    description:
      "A vision model looks at the source and returns structured JSON: each icon it found (name, concept, where it appears, a visual description, a confidence level) plus the shared icon-family style (color palette, line style, shape language, glow, background rule, negative rules). This is the machine-readable understanding of what's in the image.",
    producedByStep: 1,
    shape: "json",
  },
  {
    key: "collectionPrompt",
    label: "Collection prompt",
    oneLiner: "One image prompt describing the whole icon family.",
    description:
      "A text model turns the manifest into a single, polished natural-language image-generation prompt that describes the entire icon family as one cohesive image (grid layout, shared style, which icons to include). It's the instruction we'll hand to the image model next.",
    producedByStep: 2,
    shape: "text",
  },
  {
    key: "collectionImage",
    label: "Collection image",
    oneLiner: "One generated image of all icons together — the style anchor.",
    description:
      "An image model renders the whole family together in the shared style, using the source image as a visual reference. This single image becomes the style anchor for the rest of the run: the next two steps look at it (and pass it back to the model) so every individual icon matches it. It comes back as a base64 PNG, which we render directly — there's no hosted URL.",
    producedByStep: 3,
    shape: "image",
  },
  {
    key: "iconPrompts",
    label: "Icon prompts",
    oneLiner: "One generation prompt per icon, plus a shared style paragraph.",
    description:
      "A vision model reads the collection image together with the manifest and writes one tightly-scoped generation prompt per icon — grounded in how the family actually rendered — plus a shared style paragraph reused across all of them. This is the per-icon recipe book.",
    producedByStep: 4,
    shape: "json",
  },
  {
    key: "icons",
    label: "Icons",
    oneLiner: "The final standalone icon assets, one per prompt.",
    description:
      "An image model renders each icon as a standalone asset, passing the collection image as the reference so the family stays consistent. The output is one PNG per icon — the deliverable you'd hand to a designer or drop into a design system.",
    producedByStep: 5,
    shape: "image",
  },
];

export function getArtifact(key: ArtifactKey): ArtifactDef {
  return ARTIFACTS.find((a) => a.key === key)!;
}
