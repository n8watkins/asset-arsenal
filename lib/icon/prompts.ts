// Prompt templates for the 6-step pipeline. Kept as exported constants and
// builders so the service layer, the bench, and any future tuning live in one
// place. These are the exact prompts the pipeline experiments against.

// ---------------------------------------------------------------------------
// Step 1 — Analyze source image -> icon manifest
// ---------------------------------------------------------------------------

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
- Return valid JSON only.

Also extract the shared icon family style:
- color palette
- line style
- shape language
- glow style
- background rule
- negative rules

Give each icon a stable id like "icon_001", "icon_002", etc.
Set iconCount to the number of icons you return.
If a style field does not apply (e.g. there is no glow), set glowStyle to null.

Output JSON:
{
  "iconCount": number,
  "sharedIconFamilyStyle": {
    "colorPalette": [],
    "lineStyle": "",
    "shapeLanguage": "",
    "glowStyle": "",
    "backgroundRule": "",
    "negativeRules": []
  },
  "icons": [
    {
      "id": "icon_001",
      "name": "short icon name",
      "concept": "what the icon represents",
      "whereVisible": "where it appears in the source image",
      "visualDescription": "what it looks like",
      "confidence": "high | medium | low"
    }
  ],
  "excludedAsNonIcons": []
}`;

// ---------------------------------------------------------------------------
// Step 2 — Icon manifest -> icon collection image prompt
// ---------------------------------------------------------------------------

export function buildCollectionPromptComposer(manifestJson: string): string {
  return `You are an expert image prompt composer for icon extraction workflows.

You will receive a JSON icon manifest extracted from a source image.

Your job is to write one final high-quality image-generation prompt that creates a unified icon collection image.

The final prompt should:
- create a polished icon family image
- include all meaningful icons from the JSON
- preserve the shared icon family style
- use a clean grid layout
- make the icons the primary focus
- avoid labels, fake text, UI clutter, and unrelated dashboard elements
- feel production-ready and visually coherent

Prompt-writing rules:
- return only one final prompt
- do not return JSON
- do not explain anything
- do not mention the words "JSON," "manifest," or "schema"
- write the prompt so it can be sent directly to an image-generation model

The final prompt should include:
1. the overall goal
2. the shared icon family style
3. the icons to include
4. the desired layout
5. output constraints
6. negative constraints

Return only the final prompt text.

Input:
${manifestJson}`;
}

// ---------------------------------------------------------------------------
// Step 3 — Generate the icon collection image (source image attached)
// ---------------------------------------------------------------------------

export function buildCollectionImageBody(
  manifestJson: string,
  collectionPrompt: string,
): string {
  return `Use the attached source image as the visual reference.

Use this icon manifest as the source of truth for which icons should appear:
${manifestJson}

Now generate the icon collection image using this prompt:
${collectionPrompt}`;
}

// ---------------------------------------------------------------------------
// Step 4 — Collection image + manifest -> one prompt per icon
// ---------------------------------------------------------------------------

export function buildIndividualPromptComposer(manifestJson: string): string {
  return `You are an expert icon prompt composer.

You will receive:
1. the original icon manifest JSON
2. an icon collection image showing the approved icon family style

Your task:
Create one image-generation prompt for each icon in the manifest.

Each prompt should generate a single standalone icon that matches the approved icon family style.

Important:
- Match the same icon family style as defined by the manifest's shared style fields (colorPalette, lineStyle, shapeLanguage, glowStyle, backgroundRule, negativeRules) AND as you can interpret from the attached icon collection image. Derive the style only from those two sources — never from any assumed or predetermined aesthetic, theme, color scheme, or mood.
- Use the attached icon collection image as the visual style reference.
- Use the manifest as the source of truth for icon names, concepts, and meanings.
- Keep every icon mutually consistent in stroke weight, padding, scale, silhouette, and finish.

Each individual prompt must:
- generate one icon only
- use 1:1 square format
- be centered
- be reusable as a dashboard icon asset
- match the shared icon family style
- include the icon's concept and visual description
- avoid labels, numbers, fake text, captions, watermarks, dashboards, cards, charts, buttons, full UI screens, and extra decoration

Also write a sharedStylePrompt: a single shared style paragraph, derived from the manifest's shared style fields and the icon collection image, to reuse in every generation.

Output JSON:
{
  "sharedStylePrompt": "shared style paragraph to reuse in every generation",
  "iconPrompts": [
    {
      "iconId": "icon_001",
      "iconName": "icon name",
      "concept": "icon concept",
      "collectionImageReference": "describe where this icon appears in the icon collection image if possible",
      "prompt": "final image-generation prompt for this single icon"
    }
  ]
}

Input icon manifest:
${manifestJson}`;
}

// ---------------------------------------------------------------------------
// Step 5 — Generation wrapper for a single icon (collection image attached)
// ---------------------------------------------------------------------------

export function buildIconGenerationWrapper(args: {
  sharedStylePrompt: string;
  iconName: string;
  iconConcept: string;
  iconPrompt: string;
}): string {
  return `Create exactly one isolated reusable icon asset.

Use the attached icon collection image as the visual style reference. Match the same icon family style as described in the shared style prompt below AND as you can interpret from the collection image — stroke weight, proportions, padding, color treatment, and overall finish. Derive the style only from those two sources; do not impose any predetermined aesthetic, theme, or background.

Shared icon family style:
${args.sharedStylePrompt}

Icon to generate:
${args.iconName}

Icon concept:
${args.iconConcept}

Icon-specific prompt:
${args.iconPrompt}

Output requirements:
- generate one icon only
- 1:1 square composition
- centered with generous padding
- no text
- no letters
- no numbers
- no label
- no dashboard
- no card UI
- no chart UI
- no button UI
- no extra objects
- no decorative clutter
- transparent background if supported; otherwise a clean, neutral background consistent with the collection image
- preserve the icon family style defined by the attached collection image and the shared style prompt — do not impose any other aesthetic
- make the icon reusable as a standalone asset`;
}

// ---------------------------------------------------------------------------
// Bench V2 — collapsed pipeline
// ---------------------------------------------------------------------------
//
// V2 replaces §1+§2+§3+§4 with ONE vision pass (this composer) and then runs §5
// against the ORIGINAL source image instead of a generated collection image.
// The composer therefore has to do, in one shot, what §1 (analyze) and §4
// (per-icon prompts) did separately — grounded only in the source image.

export function buildMegaAnalysisComposer(): string {
  return `You are an expert icon analyst AND icon prompt composer.

You will receive a single source image — typically a product screenshot, dashboard, or UI. In ONE pass, do all of the following.

1. Identify every meaningful icon in the image.
An icon is a small symbolic visual element representing a concept, action, status, feature, metric, or object. Look for feature icons, metric icons, navigation icons, status icons, action icons, dashboard glyphs, and small symbolic UI marks.
Rules:
- Focus only on icons.
- Ignore cards, charts, backgrounds, and full layout sections.
- Ignore large illustrations unless they clearly function as icons.
- If an icon is tiny, partially visible, or inferred, lower its confidence.
- Group repeated icons into one icon type.
- Ignore tiny unreadable text and pure decoration.

2. Extract the shared icon family style as you interpret it from the image: color palette, line style, shape language, glow style, background rule, and negative rules. If a field does not apply (e.g. there is no glow), set glowStyle to null.

3. Write a single sharedStylePrompt: one reusable style paragraph, derived ONLY from what you see in the image, suitable to prepend to every icon's generation prompt to keep the whole family consistent.

4. For EACH icon, write one final image-generation prompt that produces a single, standalone, reusable 1:1 icon matching the family style.
Each per-icon prompt must:
- generate one icon only, centered, in a 1:1 square with generous padding
- match the shared icon family style (stroke weight, proportions, padding, color treatment, finish)
- include the icon's concept and key visual details
- derive the style ONLY from the source image and the shared style fields — never from any assumed or predetermined aesthetic, theme, color scheme, or mood
- avoid labels, numbers, fake text, captions, watermarks, dashboards, cards, charts, buttons, full UI screens, and extra decoration

Give each icon a stable id like "icon_001", "icon_002", etc. Set iconCount to the number of icons you return.
Return valid JSON only.

Output JSON:
{
  "iconCount": number,
  "sharedIconFamilyStyle": {
    "colorPalette": [],
    "lineStyle": "",
    "shapeLanguage": "",
    "glowStyle": "",
    "backgroundRule": "",
    "negativeRules": []
  },
  "sharedStylePrompt": "shared style paragraph to reuse in every generation",
  "icons": [
    {
      "id": "icon_001",
      "name": "short icon name",
      "concept": "what the icon represents",
      "whereVisible": "where it appears in the source image",
      "visualDescription": "what it looks like",
      "confidence": "high | medium | low",
      "prompt": "final image-generation prompt for this single icon"
    }
  ],
  "excludedAsNonIcons": []
}`;
}

export function buildV2IconGenerationWrapper(args: {
  sharedStylePrompt: string;
  iconName: string;
  iconConcept: string;
  iconPrompt: string;
}): string {
  return `Create exactly one isolated, reusable icon asset.

Use the attached reference image ONLY to understand the icon family's visual style — its colors, stroke weight, proportions, shape language, and finish. The reference may be a busy screenshot or dashboard; ignore its layout, cards, charts, text, and surrounding UI. Reproduce only the icon family's style, never the scene.

Match the shared icon family style described below AND the style you interpret from the reference image. Derive the style only from those two sources; do not impose any predetermined aesthetic, theme, or background.

Shared icon family style:
${args.sharedStylePrompt}

Icon to generate:
${args.iconName}

Icon concept:
${args.iconConcept}

Icon-specific prompt:
${args.iconPrompt}

Output requirements:
- generate one icon only
- 1:1 square composition
- centered with generous padding
- no text
- no letters
- no numbers
- no label
- no dashboard, card, chart, or button UI
- no extra objects
- no decorative clutter
- transparent background if supported; otherwise a clean, neutral background
- reproduce only the icon family's style from the reference — never the reference's layout or background
- make the icon reusable as a standalone asset`;
}
