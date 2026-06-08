import type { IconFamilyStyle } from "@/types/icon-pipeline";

// Prompt templates (PRD §15). Kept as exported constants/builders so the
// service layer and any future tuning live in one place.

export const ICON_ANALYSIS_PROMPT = `You are an expert icon analyst.

Analyze the uploaded image and identify all meaningful icon assets visible in the image.

An icon is a small symbolic visual element representing a concept, action, status, feature, metric, or object.

Look for:
- feature icons
- metric icons
- navigation icons
- status icons
- action icons
- dashboard glyphs
- small symbolic UI marks

Rules:
- Focus only on icons.
- Ignore cards, charts, backgrounds, and full layout sections.
- Ignore large illustrations unless they clearly function as icons.
- Do not claim you know original source layers.
- If an icon is tiny, partially visible, or inferred, lower confidence.
- Group repeated icons into one icon type when appropriate.
- Ignore tiny unreadable text.
- Do not list every tiny decoration as an icon.

Also extract the shared icon family style:
- color palette
- line style
- shape language
- glow style
- background rule
- negative rules

Give each icon a stable id like "icon_001", "icon_002", etc.
Set iconCount to the number of icons you return.
If a style field does not apply (e.g. there is no glow), set glowStyle to null.`;

// The prompt-pack writer prompt. {ICON_FAMILY_STYLE} is interpolated with the
// approved manifest's family style; the full manifest is sent alongside.
export function buildPromptPackPrompt(
  familyStyle: IconFamilyStyle,
  manifestJson: string,
): string {
  return `You are generating image prompts for individual icon assets.

Given this icon manifest extracted from a single source image, write one image-generation prompt for each icon.

Each prompt must:
- generate one icon only
- preserve the shared icon family style
- be centered
- be reusable as a standalone UI icon
- have no text
- have no letters
- have no extra UI
- have no background clutter
- use a 1:1 aspect ratio
- include style details from the manifest
- be appropriate for generation with gpt-image-1-mini

Set aspectRatio to "1:1" and recommendedModel to "gpt-image-1-mini" for every prompt.
Use the iconId and iconName from the manifest. If a prompt needs no extra notes, set notes to null.

Shared icon family style:
${JSON.stringify(familyStyle, null, 2)}

Full icon manifest:
${manifestJson}`;
}

// §15.3 generation wrapper. Wraps the per-icon prompt with consistent
// system-level constraints + the shared family style.
export function buildIconGenerationPrompt(
  familyStyle: IconFamilyStyle,
  iconPrompt: string,
): string {
  return `Create exactly one reusable icon asset.

Requirements:
- one icon only
- centered composition
- square 1:1 output
- no words
- no letters
- no fake text
- no extra UI cards
- no full dashboard
- no background clutter
- clean silhouette
- visually consistent with the shared icon family style
- suitable for use in a web app or dashboard

Shared icon family style:
${JSON.stringify(familyStyle, null, 2)}

Icon-specific prompt:
${iconPrompt}`;
}
