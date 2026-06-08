import type {
  IconManifest,
  IndividualIconPrompts,
  GeneratedIcon,
} from "@/types/icon-pipeline";

// Sample data so the bench and any UI can be exercised without re-running
// every upstream step. Not used in production paths.

export const SAMPLE_MANIFEST: IconManifest = {
  iconCount: 3,
  sharedIconFamilyStyle: {
    colorPalette: ["cyan / electric blue", "violet / purple", "white on dark navy"],
    lineStyle: "thin-to-medium monoline outline with rounded caps and joins",
    shapeLanguage: "simple geometric SaaS dashboard glyphs, compact silhouettes",
    glowStyle: "subtle neon glow and soft bloom on cyan/violet accents",
    backgroundRule: "designed for dark navy glass UI surfaces",
    negativeRules: ["no heavy strokes", "no skeuomorphic detail", "no text"],
  },
  icons: [
    {
      id: "icon_001",
      name: "Hexagon token",
      concept: "tokens / AI usage",
      whereVisible: "Top-left metric tile",
      visualDescription: "Cyan outlined hexagon",
      confidence: "high",
    },
    {
      id: "icon_002",
      name: "Clock",
      concept: "duration / time",
      whereVisible: "Top-center metric tile",
      visualDescription: "Circular clock outline with two hands",
      confidence: "high",
    },
    {
      id: "icon_003",
      name: "Code brackets",
      concept: "commits / development",
      whereVisible: "Commits metric tile",
      visualDescription: "Angled code brackets with a slash",
      confidence: "high",
    },
  ],
  excludedAsNonIcons: ["color swatches", "glass card surfaces", "chart bars"],
};

export const SAMPLE_COLLECTION_PROMPT =
  "Create a polished icon collection collection image showing a unified family of premium dark-mode SaaS/developer-dashboard icons on a dark navy background. Render thin-to-medium monoline outline glyphs with rounded caps and joins, cyan and violet neon accents, subtle glow. Arrange a cyan outlined hexagon, a circular clock, and angled code brackets in a clean evenly-spaced grid. No text, no labels, no UI clutter, consistent stroke weight and glow across all icons.";

export const SAMPLE_INDIVIDUAL_PROMPTS: IndividualIconPrompts = {
  sharedStylePrompt:
    "Create a single standalone icon in a premium dark-mode SaaS/developer-dashboard icon family style. 1:1 square, centered, generous padding, thin-to-medium monoline strokes, rounded caps and joins, cyan/violet neon accents with subtle glow on a dark navy or transparent-friendly background. No text, no numbers, no UI chrome.",
  iconPrompts: SAMPLE_MANIFEST.icons.map((icon, i) => ({
    iconId: icon.id,
    iconName: icon.name,
    concept: icon.concept,
    collectionImageReference: `row 1, column ${i + 1}`,
    prompt: `Create one standalone ${icon.name.toLowerCase()} icon in 1:1 square format representing ${icon.concept}. ${icon.visualDescription}. Centered with generous padding, thin-to-medium monoline strokes, subtle neon glow, dark navy or transparent-friendly background. Generate one icon only; no text, no numbers, no extra decoration.`,
  })),
};

export const SAMPLE_GENERATED_ICONS: GeneratedIcon[] =
  SAMPLE_MANIFEST.icons.map((icon, i) => ({
    id: `gen_${icon.id}`,
    iconId: icon.id,
    iconName: icon.name,
    prompt: SAMPLE_INDIVIDUAL_PROMPTS.iconPrompts[i].prompt,
    imageUrl: "",
    modelUsed: "gpt-image-1-mini",
    status: i === 1 ? "failed" : "success",
    error: i === 1 ? "Generation failed. Try again." : undefined,
    createdAt: new Date().toISOString(),
  }));
