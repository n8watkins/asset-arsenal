// Page skins - step 1: concept prompt -> skin spec (tokens, fonts, component CSS,
// image prompts). One structured-output text call.

import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getClient } from "@/lib/openai/client";
import { realizedTextCostUSD } from "@/lib/icon/model-reference";
import { SAMPLE_PAGE_DESCRIPTION, SKINNABLE_CLASSES } from "./sample-page";
import type { SkinUsage } from "./types";

const hex = z.string().describe("6-digit hex color like #1a2b3c");

export const SkinSpecSchema = z.object({
  name: z.string().describe("2-3 word name for this skin"),
  rationale: z.string().describe("One or two sentences on the visual idea"),
  colors: z.object({
    bg: hex.describe("page background"),
    surface: hex.describe("card / panel background"),
    text: hex.describe("main text on bg and surface"),
    muted: hex.describe("secondary text on bg and surface"),
    primary: hex.describe("primary button fill"),
    onPrimary: hex.describe("text on primary"),
    accent: hex.describe("eyebrows, icon badges, badges"),
    onAccent: hex.describe("icon/text on accent"),
    border: hex.describe("borders and rules"),
  }),
  fonts: z.object({
    display: z.string().describe("Google Fonts family name for headings, exact spelling"),
    body: z.string().describe("Google Fonts family name for body text, exact spelling; must be very readable"),
    displayWeight: z.number().int().describe("400-900, a weight the display family has"),
    displayTransform: z.enum(["none", "uppercase"]),
    displayTrackingEm: z.number().describe("letter-spacing for headings in em, -0.04 to 0.12"),
  }),
  shape: z.object({
    radiusPx: z.number().int().describe("0-28"),
    borderWidthPx: z.number().int().describe("0-4"),
    shadow: z.string().describe("CSS box-shadow value for cards and primary buttons, or 'none'"),
  }),
  texture: z.object({
    veilOpacity: z.number().describe("0.55-0.95: how much of the bg color is laid over the texture so text stays legible"),
    tileSizePx: z.number().int().describe("256-768"),
  }),
  componentCss: z
    .string()
    .describe("Extra CSS rules that give components the concept's character. Only the allowed classes."),
  imagePrompts: z.object({
    hero: z.string().describe("Prompt for a 3:2 hero illustration that fits a team journal app in this concept. No text, no logos."),
    texture: z.string().describe("Prompt for a subtle, low-contrast, evenly-distributed background texture/pattern tile. No focal objects, no text."),
    emblem: z.string().describe("Prompt for a simple bold logo mark (an open notebook or pen motif) on a transparent background, in this concept. No letters."),
  }),
});

export type SkinSpec = z.infer<typeof SkinSpecSchema>;

export const SPEC_MODEL = "gpt-5.4-mini";

function buildPrompt(concept: string): string {
  const classes = Object.entries(SKINNABLE_CLASSES)
    .map(([c, d]) => `.${c} - ${d}`)
    .join("\n");
  return `You are a senior visual designer. Design a "page skin": a complete, coherent visual theme for an existing web page, in the concept the user gives.
The page's layout is fixed. You control color, type, shape, decoration and three generated images.

Concept: "${concept}"

The page:
${SAMPLE_PAGE_DESCRIPTION}

Rules:
- Commit hard to the concept so it is unmistakable at a glance, but the page must stay a usable, legible product page.
- Text colors must have strong contrast (WCAG AA, 4.5:1) on bg and on surface; onPrimary on primary and onAccent on accent too.
- Pick Google Fonts that exist, spelled exactly as on fonts.google.com. The body font must be comfortable for paragraphs.
- componentCss: 8 to 30 rules that add the concept's character: borders, outlines, background treatments (gradients, repeating-linear-gradient patterns), box-shadows, text-shadows, pseudo-element ornaments (::before/::after with content), hover states, transforms like slight rotation.
  Use the CSS variables --bg --surface --text --muted --primary --on-primary --accent --on-accent --border --radius --border-width --shadow --font-display --font-body where you can.
  Every selector must start with one of these classes (descendants, pseudo-classes and pseudo-elements are fine):
${classes}
  Do not frame the full-width wrappers (.nav .hero .logos .section .footer) with borders or shadows; a background band is fine.
  Do not set backgrounds on .page or .hero-art: the generated texture and hero illustration live there. Do not add ::before/::after to .brand (it already has the emblem).
  Do not change layout: no display, position (except relative/absolute on ::before/::after), width, height, grid, flex, margin, padding, float, font-size, or overflow on the elements themselves.
  Do not use url(), @import, @font-face or @keyframes.
- Image prompts must describe the concept's look (medium, palette, lighting) and match your colors. No words or letters in any image.`;
}

export async function generateSkinSpec(
  concept: string,
  model = SPEC_MODEL,
): Promise<{ spec: SkinSpec; usage: SkinUsage }> {
  const client = getClient();
  const start = Date.now();
  const res = await client.responses.parse({
    model,
    reasoning: { effort: "low" },
    input: buildPrompt(concept),
    text: { format: zodTextFormat(SkinSpecSchema, "skin_spec") },
  });
  const spec = res.output_parsed;
  if (!spec) throw new Error("Spec model returned no skin spec.");
  const inputTokens = res.usage?.input_tokens ?? 0;
  const outputTokens = res.usage?.output_tokens ?? 0;
  return {
    spec,
    usage: {
      step: "spec",
      model,
      durationMs: Date.now() - start,
      costUSD: realizedTextCostUSD(model, { inputTokens, outputTokens }),
      detail: `${inputTokens} in / ${outputTokens} out tokens`,
    },
  };
}
