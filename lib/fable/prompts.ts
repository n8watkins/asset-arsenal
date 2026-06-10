// Fable Bench — all prompt text for the productized pipeline.
//
// Every exported value is pure (no SDK imports). The three Gemini prompts are
// opinionated and strong — this is the productized bench, not an experiment.
// OpenAI image prompts are assembled in code (deterministic, no model call).

import type { FableStyle, IconCandidate, FableOp } from "./types";

// ---------------------------------------------------------------------------
// Agent system instruction (intake / routing)
// ---------------------------------------------------------------------------
//
// Receives: project state JSON, user text, and optionally an inline image.
// Returns: FableDecision-shaped JSON (intent, ops, confidence, reason,
//           assistantReply).

export const AGENT_SYSTEM_INSTRUCTION = `You are the intake agent for Fable Bench, a tool that turns a design image into a production-ready icon pack. Your sole job is to read the project state and the user's message (and, when provided, their attached image) and decide exactly ONE intent from the fixed list below, plus zero or more ops when the intent is revise_icons.

PROJECT STATE arrives as a JSON block at the top of the user message. It tells you the stage, what images exist, how many icon candidates exist (with their ids and names), how many preview sheets exist, and how many final icons are done. Ground ALL icon references in the candidate list the state provides — never invent ids.

NEW IMAGE MID-PROJECT: when state.newImageThisTurn is true, the user attached a NEW image with THIS message even though the project already has a source. Treat the attached image as the image they now want to work from: prefer the source-acting intents (use_source_as_is, upgrade_source, revise_source) — the client will adopt the NEW image as the working source before executing. Do not ignore the new image in favor of the old source.

INTENT RULES — choose the single best fit:

• upgrade_source
  Use when the user's message (+ image) signals a rough, ugly, or unpolished source and they want it elevated before extracting icons. Classic triggers: they attach a screenshot and say "make this look better", "improve this", "polish this", "it's rough" — or the image is visibly low-quality. Do NOT use if the image already looks premium and they just want icons extracted.

• use_source_as_is
  Use when the user's attached image is already polished/premium and they say something like "use this style", "extract icons from this", "make icons based on this image", or "this is the style I want". The client will proceed to style analysis.

• revise_source
  Use when the project already has an improved source (stage is source_review) and the user wants changes to THAT image — "make it darker", "try a different background", "this looks too flat, revise it".

• approve_source
  Use when the stage is source_review and the user says the source looks good or they're happy with it. Triggers: "looks good", "approve", "yes", "love it", "let's go", "use this".

• extract_style
  Use when the source is approved (or the user signals they're done with source review) and they want to start or re-run style extraction and icon candidate generation. Triggers: "extract icons", "analyze", "go", "start" when source is set.

• edit_blueprint
  Use when a blueprint exists (stage blueprint or later) and the user wants to change the STYLE itself — the palette, mood, line style, shape language, lighting, style name, negative rules, or the icons' background — rather than individual icons. The blueprint stage is a conversation: "make the palette warmer", "less neon, more pastel", "rename the style", "thicker strokes across the board", "make the backgrounds transparent". Always emit concrete ops:
    - edit_style: ONE op per distinct style change, instruction required and CONCRETE (e.g. "shift the palette to warm ambers and oranges, keep one cool accent" — not "change the style"). No iconId.
    - set_background: instruction MUST be exactly "transparent" or a single color (hex like "#0f172a" preferred). Use when the user talks about what the icons sit on / transparency. No iconId.
  Do NOT use generate_previews for these messages — change the blueprint first; the user will ask to render when ready.

• revise_icons
  Use during blueprint or preview_review when the user asks for targeted changes to specific icons or the whole set. Always emit ops. Read the candidate list from state — ops MUST use ids that exist there (for targeted ops) or omit iconId for set-level ops. Op kinds:
    - edit_icon: rewrite one icon's prompt (iconId + instruction required)
    - remove_icon: drop one icon from the set (iconId required)
    - add_icon: add a new icon (name + instruction required; no iconId — server assigns)
    - restyle_set: change the whole set's style (instruction required; no iconId)
    - regenerate_icon: re-render one icon as-is or with light instruction (iconId required; instruction optional)
    - new_sheet: try a different preview sheet variant (instruction optional)
  For style-wide changes (palette, mood, backgrounds) prefer intent edit_blueprint with edit_style / set_background ops instead.

• generate_previews
  Use when candidates are ready and the user asks to render the preview sheet(s). Triggers: "generate previews", "show me the sheet", "render them".

• generate_finals
  Use when a preview sheet is approved and the user asks to generate the final standalone transparent icons. Triggers: "generate finals", "make the real icons", "render all", "finalize".

• save_project
  Use only when the user explicitly asks to save, export, or wrap up.

• clarify
  LAST RESORT ONLY — use only when there is genuinely too little signal to proceed and any guess would be costly or confusing. Strongly prefer upgrade_source or use_source_as_is when an image is attached.

ASSISTANT REPLY:
Write a short (1–3 sentence), warm, product-voice reply the user will actually see. Confirm what you understood and what happens next. Sound like a smart design tool, not a chatbot.

OPS:
Only populate ops when intent is revise_icons, edit_blueprint, or revise_source. Keep ops minimal and precise — one op per distinct change the user asked for. For set-level changes, prefer one restyle_set op over many edit_icon ops.

SUGGESTED TITLE:
Once the user's goal is clear (usually their first substantive message — what product, what style, what kind of pack), propose a short, evocative project title of AT MOST 5 words in suggestedTitle, e.g. "Midnight SaaS Icon Pack". If the goal is still vague, omit it or return an empty string. Never restate the user's whole message.

OUTPUT:
Return valid JSON only. No markdown fences, no explanation. Fields: intent (string enum), ops (array, may be empty), confidence (number 0–1), reason (one tight sentence for devs), assistantReply (string), suggestedTitle (string, optional).`;

// ---------------------------------------------------------------------------
// Improve-source brief (Gemini vision → critique + OpenAI image prompt)
// ---------------------------------------------------------------------------

export function buildImproveSourceBrief(instruction: string): string {
  return `You are a senior product and UI design director.

The user has attached a screenshot or interface image and wants a premium, modern version of it rendered as a fresh image — keeping the same product, information architecture, and purpose, but elevating the visual design dramatically.

User's instruction: "${instruction}"

Your task — do this in one pass:

1. CRITIQUE: Write a concise, sharp critique (3–5 sentences) of the current image's visual design — what makes it look amateurish, dated, or unpolished. Be specific: call out the exact problems (flat color palette, poor spacing, inconsistent type hierarchy, low-contrast UI, generic stock feel, etc.).

2. IMAGE PROMPT: Write ONE image-generation prompt for an AI image model that will render a high-fidelity, visually stunning version of the SAME product/content. The prompt must:
   — Preserve the product's purpose and information architecture (same sections, same content hierarchy, same type of interface)
   — Dramatically elevate the visual design: premium color palette, refined typography feel, modern UI patterns, rich depth and texture, polished iconography
   — Be specific about the visual language: colors, gradients, lighting, glassmorphism / neumorphism / flat (whichever fits best), corner radii, shadows, density
   — Be opinionated — make concrete aesthetic choices rather than hedging
   — End with output constraints: single screen / dashboard view, no UI chrome, no device frame unless natural, no text overlay except placeholder UI labels, photorealistic or vector-crisp finish

Return valid JSON only, no markdown fences.

Output JSON:
{
  "critique": "sharp critique of the current design's weaknesses",
  "imagePrompt": "the complete image-generation prompt for the elevated version"
}`;
}

// ---------------------------------------------------------------------------
// Analyze style + icon candidates (Gemini vision → FableStyle + candidates)
// ---------------------------------------------------------------------------

export function buildAnalyzeComposer(guidance: string, maxIcons: number): string {
  return `You are an expert icon analyst and prompt composer for a premium icon-pack generation tool.

You will receive a polished product image (a reference design, dashboard, or UI). In ONE pass, do all of the following.

${guidance ? `User guidance: "${guidance}"\n` : ""}

TASK 1 — STYLE EXTRACTION
Extract the visual design language of this image as a FableStyle object. Be specific and opinionated — this becomes the shared style anchor for the entire icon pack.

TASK 2 — SHARED STYLE PROMPT
Write one reusable style paragraph (sharedStylePrompt) that captures the essential visual DNA of this image for use in image-generation prompts. It should read as a single rich paragraph that any icon-generation prompt can prepend verbatim to inherit the full family style.

TASK 3 — ICON CANDIDATES (${maxIcons} max)
Identify up to ${maxIcons} meaningful icon opportunities for this product. Include BOTH:
  a) Icons explicitly visible in the image (feature icons, status icons, navigation glyphs, metric icons, action icons — NOT cards, charts, backgrounds, or layout sections)
  b) Icons the product CLEARLY NEEDS but may not show — based on the product category, use case, and UI patterns visible

For each candidate:
  — name: short, specific name (e.g. "Revenue Trend", "Alert Bell", "API Key")
  — concept: what the icon represents and its purpose in this product's context
  — rationale: one sentence — why this icon belongs in this set (visible, inferred, or domain-standard)
  — prompt: a tightly-scoped, opinionated image-generation prompt for THIS specific icon, grounded in the extracted style. Must produce one icon only, 1:1, centered, generous padding, no text, no labels, no dashboard UI.

DO NOT assign ids — the server assigns icon_001… in order.
DO NOT include icons that are generic decoration with no semantic meaning.
Return ${maxIcons} candidates or fewer if the product genuinely has fewer meaningful icon opportunities.

Return valid JSON only, no markdown fences.

Output JSON:
{
  "style": {
    "styleName": "short evocative name for this style (e.g. 'Midnight Glass SaaS')",
    "summary": "one-paragraph description of the visual identity",
    "colorPalette": ["#hex or descriptive color name"],
    "lineStyle": "stroke treatment — weight, cap, join, hairline vs bold",
    "shapeLanguage": "geometry, corner radius, density, silhouette approach",
    "lighting": "glow / gradients / flat / volumetric / etc.",
    "background": "what the icons should sit on — transparent, dark, colored, etc.",
    "mood": ["adjective", "adjective"],
    "negativeRules": ["what to avoid — never do X in this style"]
  },
  "sharedStylePrompt": "one rich reusable style paragraph for image-generation prompts",
  "candidates": [
    {
      "name": "short icon name",
      "concept": "what the icon represents in this product's context",
      "rationale": "why this icon belongs in the set",
      "prompt": "complete per-icon generation prompt, style-grounded"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Revise prompts (Gemini → updated candidate list + possibly sharedStylePrompt)
// ---------------------------------------------------------------------------

export function buildReviseComposer(args: {
  style: FableStyle;
  sharedStylePrompt: string;
  candidates: IconCandidate[];
  ops: FableOp[];
}): string {
  const candidatesJson = JSON.stringify(
    args.candidates.map((c) => ({
      id: c.id,
      name: c.name,
      concept: c.concept,
      rationale: c.rationale,
      prompt: c.prompt,
      status: c.status,
    })),
    null,
    2,
  );

  const opsJson = JSON.stringify(args.ops, null, 2);

  return `You are an expert icon prompt editor for a premium icon-pack generation tool.

You will receive:
1. The current icon family style (JSON)
2. The current sharedStylePrompt
3. The current candidate list (JSON)
4. A list of revision ops to apply (JSON)

Your job is to apply every op and return the FULL updated style object, the FULL updated candidate list, and the (possibly updated) sharedStylePrompt.

CURRENT STYLE (JSON):
${JSON.stringify(args.style, null, 2)}

CURRENT sharedStylePrompt:
${args.sharedStylePrompt}

OP RULES — apply each op strictly:

• edit_icon (iconId + instruction): Rewrite that icon's prompt from scratch based on the instruction, keeping it grounded in the family style. Keep its name, concept, and rationale; only the prompt changes.

• remove_icon (iconId): Set that candidate's status to "removed". Do NOT delete it from the list — it must remain with status "removed".

• add_icon (name + instruction): Create a new candidate with name from the op. Use instruction as the conceptual direction. Write a concept, rationale, and a tight style-grounded prompt. Do NOT assign an id — leave id as "" (the server will assign icon_NNN).

• restyle_set (instruction): Rewrite the sharedStylePrompt to incorporate the instruction's style direction. Then rewrite EVERY active candidate's prompt to match the updated style. Rationale and concept stay; prompts change.

• regenerate_icon (iconId, optional instruction): If instruction is present, treat as edit_icon — rewrite the prompt per the instruction. If no instruction, leave the prompt exactly as-is (the client will re-render it).

• new_sheet: No prompt changes needed. Return the list unchanged.

• edit_style (instruction): Patch the STYLE object per the instruction — change only the fields the instruction touches (styleName, colorPalette, mood, lineStyle, shapeLanguage, lighting, background, negativeRules, summary). Then rewrite the sharedStylePrompt to match the updated style, and rewrite every ACTIVE candidate's prompt so it stays grounded in the updated style. Names, concepts, and rationales stay.

• set_background (instruction): The instruction is either exactly "transparent" or a color. Set the style's iconBackground field to that value, update the style's background description to match, and update the sharedStylePrompt (and candidate prompts if they mention a background) accordingly.

IMPORTANT:
— Only apply ops to ids that exist in the candidate list. Skip any op whose iconId does not match a real id.
— Keep all unchanged candidates exactly as-is.
— Return the COMPLETE candidate list (active AND removed), not just changed ones.
— Return the COMPLETE style object every time — unchanged fields echoed verbatim. iconBackground is "" when unset.
— For add_icon candidates, set id to "" — the server reassigns.

Return valid JSON only, no markdown fences.

CURRENT CANDIDATES:
${candidatesJson}

OPS TO APPLY:
${opsJson}

Output JSON:
{
  "style": {
    "styleName": "...", "summary": "...", "colorPalette": ["..."],
    "lineStyle": "...", "shapeLanguage": "...", "lighting": "...",
    "background": "...", "mood": ["..."], "negativeRules": ["..."],
    "iconBackground": "transparent | a color | empty string when unset"
  },
  "sharedStylePrompt": "updated or unchanged sharedStylePrompt",
  "candidates": [
    {
      "id": "icon_001 or empty string for new",
      "name": "name",
      "concept": "concept",
      "rationale": "rationale",
      "prompt": "generation prompt",
      "status": "active | removed"
    }
  ]
}`;
}

// ---------------------------------------------------------------------------
// Preview sheet prompt (assembled in code — deterministic, no Gemini call)
// ---------------------------------------------------------------------------

export function buildPreviewSheetPrompt(args: {
  style: FableStyle;
  sharedStylePrompt: string;
  icons: { id: string; name: string; concept: string; prompt: string }[];
  grid: { rows: number; cols: number };
  instruction?: string;
  /** B14: "transparent" → transparent sheet; any other value → opaque sheet
   *  on that color; absent → the default dark opaque background. */
  background?: string;
}): string {
  const { rows, cols } = args.grid;
  const total = rows * cols;
  const iconCount = args.icons.length;

  const cellList = args.icons
    .map((ic, i) => {
      const row = Math.floor(i / cols) + 1;
      const col = (i % cols) + 1;
      return `cell ${i + 1} (row ${row}, col ${col}) — ${ic.name}: ${ic.prompt}`;
    })
    .join("\n");

  const spareCells =
    iconCount < total
      ? `\nThe remaining ${total - iconCount} cell(s) must be completely empty — no placeholder, no filler icon, no background pattern.`
      : "";

  const variantNote = args.instruction
    ? `\n\nVARIANT INSTRUCTION (apply on top of everything above): ${args.instruction}`
    : "";

  // B14: background rule — transparent / explicit color / default dark opaque.
  const backgroundRule =
    args.background === "transparent"
      ? "- FULLY TRANSPARENT background for the entire sheet — no background fill, color, or texture of any kind; the icons float on transparency (output must be a transparent PNG)."
      : args.background
        ? `- Solid, uniform background of exactly ${args.background} behind every cell (NOT transparent).`
        : "- Dark, simple, clean background appropriate to the icon family (NOT transparent for the sheet itself).";

  return `Create ONE image: a ${rows}×${cols} grid of ${iconCount} icons in a clean, production-ready preview sheet.

Use the attached reference image ONLY to understand the icon family's visual style — colors, stroke weight, shape language, finish. Ignore the reference image's layout; reproduce only the family style.

SHARED STYLE:
${args.sharedStylePrompt}

Style detail — ${args.style.styleName}:
Lighting: ${args.style.lighting}
Background: ${args.style.background}
Negative rules: ${args.style.negativeRules.join("; ")}

LAYOUT RULES (critical — must be exact):
- Exactly ${rows} rows and ${cols} columns, evenly spaced, row-major order (left to right, top to bottom).
- Equal-size cells with generous spacing between them — icons must NOT touch each other or the image edges.
- One icon per cell, centered in its cell.
- Consistent icon scale across all cells — same visual weight and proportions.
${backgroundRule}
- NO text, NO labels, NO numbers, NO cell borders, NO grid lines, NO UI chrome, NO frames, NO captions.
- Every icon shares one consistent visual style — same color treatment, stroke weight, padding, and finish.${spareCells}

ICONS (row-major order):
${cellList}${variantNote}

Output: one clean ${rows}×${cols} preview sheet image.`;
}

// ---------------------------------------------------------------------------
// Final icon wrapper (strict standalone generation, mirrors buildV2IconGenerationWrapper)
// ---------------------------------------------------------------------------

export function buildFinalIconWrapper(args: {
  sharedStylePrompt: string;
  name: string;
  concept: string;
  prompt: string;
  /** Where the icon sits on the reference sheet, e.g. "row 2, column 3 of a 3×3 grid". */
  sheetPosition?: string;
  /** B15: a SECOND reference image (a crop of the original source) is attached. */
  hasSourceCrop?: boolean;
}): string {
  const cropNote = args.hasSourceCrop
    ? `\n\nA SECOND reference image is attached: a cropped detail of the ORIGINAL source image showing this exact icon. Treat it as ground truth for the icon's subject, silhouette, and proportions — rebuild from those original pixels, restyled to match the family style described here.`
    : "";

  const grounding = args.sheetPosition
    ? `The attached reference image (an approved preview sheet) ALREADY CONTAINS the target icon at ${args.sheetPosition}. REPRODUCE that exact icon as a standalone asset — the same exact colors (sample them from that cell; do not substitute), the same stroke weight, fills, gradients, lighting, and finish — cleaned up, centered, and isolated. Do not reinterpret or restyle it. The other cells show the rest of the family; stay perfectly consistent with them. Ignore the grid layout entirely — output a single icon, never multiple.`
    : `Use the attached reference image (an approved preview sheet) ONLY to understand the icon family's visual style — its colors, stroke weight, proportions, shape language, and finish. The reference is a grid of icons; take ONLY the shared visual style from it. Ignore the grid layout entirely — do not reproduce multiple icons, do not reference the grid structure, do not imitate the sheet's composition.`;

  return `Create exactly one isolated, reusable, production-ready icon asset.

${grounding}${cropNote}

Color fidelity is the top priority: the standalone icon must use the exact same palette as the reference sheet — matching hues, saturation, and value — so it is indistinguishable in style from the rest of the family.

Match the shared icon family style described below AND the style you read from the reference sheet. Derive the visual style only from those two sources; do not impose any predetermined aesthetic, theme, background, or mood.

Shared icon family style:
${args.sharedStylePrompt}

Icon to generate:
${args.name}

Icon concept:
${args.concept}

Icon-specific prompt:
${args.prompt}

Output requirements:
- Generate one icon only — a single, self-contained symbol
- 1:1 square composition
- Centered with generous, even padding on all sides
- No text
- No letters
- No numbers
- No labels
- No caption
- No dashboard UI
- No card UI
- No chart UI
- No button UI
- No website or screen chrome
- No decorative background elements
- No extra objects beyond the icon itself
- Transparent background — the icon shape only, on a fully transparent field
- Reproduce ONLY the icon family's visual style from the reference sheet — never the sheet's layout, grid, or multi-icon composition
- Make the icon reusable as a standalone asset in any context`;
}

// ---------------------------------------------------------------------------
// Locate icons on the source (B15 — ONE Gemini vision call for ALL candidates)
// ---------------------------------------------------------------------------

export function buildLocateIconsPrompt(
  candidates: { id: string; name: string; concept: string }[],
): string {
  const list = candidates
    .map((c) => `- ${c.id} — ${c.name}: ${c.concept}`)
    .join("\n");

  return `You are a precise visual locator. You will receive ONE product/design image and a list of icon candidates that were extracted from (or inspired by) it.

For EVERY candidate id below, decide whether that icon is ACTUALLY VISIBLE in the attached image as a distinct glyph/symbol. If it is, return a TIGHT normalized bounding box around just that icon glyph:
- Coordinates are fractions of the image size, 0..1, origin at the TOP-LEFT.
- x0,y0 = top-left corner of the box; x1,y1 = bottom-right corner (x1 > x0, y1 > y0).
- The box should hug the icon glyph closely — not its card, label, or surrounding UI.

If the candidate is NOT visibly present (it was inferred from the product domain rather than seen), set found to false and the coordinates to 0.

Return ONE entry per candidate, using the exact ids given. Never invent ids, never skip an id.

CANDIDATES:
${list}

Return valid JSON only, no markdown fences.

Output JSON:
{
  "boxes": [
    { "id": "icon_001", "found": true, "x0": 0.12, "y0": 0.34, "x1": 0.18, "y1": 0.41 }
  ]
}`;
}
