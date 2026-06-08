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
2. a collection image showing the approved icon family style

Your task:
Create one image-generation prompt for each icon in the manifest.

Each prompt should generate a single standalone icon that matches the collection image style.

Global style to preserve:
- Derive the shared visual style entirely from the approved collection image and the manifest's style fields (color palette, line style, shape language, glow style, background rule, and any negative rules).
- Do not impose any predetermined aesthetic, theme, color scheme, or mood — match whatever style the collection image and manifest actually define, whether that is light or dark, flat or detailed, mono or multicolor.
- Keep every icon mutually consistent in stroke weight, padding, scale, silhouette treatment, and overall finish.

Important:
- Use the collection image as the visual style reference.
- Use the manifest as the source of truth for icon names, concepts, and meanings.
- Preserve the shared icon family style exactly as it appears in the collection image.

Each individual prompt must:
- generate one icon only
- use 1:1 square format
- be centered
- be reusable as a dashboard icon asset
- match the collection image style
- include the icon's concept and visual description
- avoid labels, numbers, fake text, captions, watermarks, dashboards, cards, charts, buttons, full UI screens, and extra decoration

For each icon set:
- iconId and iconName from the manifest
- concept from the manifest
- collectionImageReference: describe where this icon appears in the collection image if possible (e.g. "row 2, column 3")
- prompt: the final image-generation prompt for this single icon

Also write a sharedStylePrompt: a shared style paragraph to reuse in every generation.

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

Use the attached icon collection image as the visual style reference. Match the same icon family style, stroke weight, proportions, padding, and overall presentation exactly as shown in the collection image.

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
