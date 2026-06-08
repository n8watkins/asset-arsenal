import type {
  IconManifest,
  IconPromptPack,
  GeneratedIcon,
} from "@/types/icon-pipeline";

// Sample data so UI components can be built/previewed without live API calls.
// Not used in production paths.

export const SAMPLE_MANIFEST: IconManifest = {
  imageSummary:
    "A dark developer-tool dashboard with metric cards and a left nav rail.",
  iconCount: 3,
  iconFamilyStyle: {
    summary:
      "Premium dark SaaS icon family: rounded geometric linework with cyan/violet glow accents.",
    colorPalette: ["#0b0f1a", "#22d3ee", "#a78bfa", "#e2e8f0"],
    lineStyle: "2px rounded strokes, consistent corner radius",
    shapeLanguage: "geometric, slightly rounded, balanced negative space",
    glowStyle: "subtle outer cyan/violet glow",
    backgroundRule: "transparent, no background fill",
    negativeRules: ["no text", "no letters", "no UI chrome", "no drop shadows"],
  },
  icons: [
    {
      id: "icon_001",
      name: "Token Usage",
      meaning: "Represents AI/token usage metric",
      locationInImage: "Top-left metric card",
      visualDescription: "A coin/chip glyph with a small spark",
      styleNotes: "cyan glow, rounded linework",
      confidence: "high",
    },
    {
      id: "icon_002",
      name: "Latency",
      meaning: "Response time metric",
      locationInImage: "Top-center metric card",
      visualDescription: "A stopwatch with a motion arc",
      styleNotes: "violet accent",
      confidence: "medium",
    },
    {
      id: "icon_003",
      name: "Settings",
      meaning: "App configuration",
      locationInImage: "Bottom of left nav rail",
      visualDescription: "A gear glyph",
      styleNotes: "neutral light stroke",
      confidence: "high",
    },
  ],
  notes: ["Repeated chevron decorations were ignored as non-icons."],
};

export const SAMPLE_PROMPT_PACK: IconPromptPack = {
  sharedStyleSummary:
    "Premium dark developer-tool icon family with rounded geometric linework and cyan/violet glow.",
  prompts: SAMPLE_MANIFEST.icons.map((icon) => ({
    iconId: icon.id,
    iconName: icon.name,
    prompt: `Create a single isolated icon representing ${icon.meaning.toLowerCase()}. Premium dark developer-tool style, rounded geometric linework, cyan and violet glow accents, centered, transparent background. No text, no letters, no UI.`,
    aspectRatio: "1:1",
    recommendedModel: "gpt-image-1-mini",
    notes: null,
  })),
};

export const SAMPLE_GENERATED_ICONS: GeneratedIcon[] =
  SAMPLE_MANIFEST.icons.map((icon, i) => ({
    id: `gen_${icon.id}`,
    iconId: icon.id,
    iconName: icon.name,
    prompt: SAMPLE_PROMPT_PACK.prompts[i].prompt,
    imageUrl: "",
    modelUsed: "gpt-image-1-mini",
    status: i === 1 ? "failed" : "success",
    error: i === 1 ? "Generation failed. Try again." : undefined,
    createdAt: new Date().toISOString(),
  }));
