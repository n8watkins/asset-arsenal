// Page skins - orchestrator: concept -> spec -> (fonts check + images in parallel)
// -> contrast guard + CSS sanitizer -> skinned HTML.

import { enforceContrast, type ContrastFix } from "./contrast";
import { generateSkinImages } from "./images";
import { renderSkinnedPage, resolveFont } from "./render";
import { sanitizeComponentCss } from "./sanitize";
import { generateSkinSpec, type SkinSpec } from "./spec";
import type { SkinUsage } from "./types";

export type SkinResult = {
  concept: string;
  spec: SkinSpec;
  html: string;
  usage: SkinUsage[];
  totalMs: number;
  totalCostUSD: number;
  guards: {
    contrastFixes: ContrastFix[];
    droppedCssRules: number;
    droppedCssDecls: number;
    fontFallbacks: string[];
  };
};

export async function generateSkin(concept: string): Promise<SkinResult> {
  const start = Date.now();
  const { spec, usage: specUsage } = await generateSkinSpec(concept);

  const [display, body, images] = await Promise.all([
    resolveFont(spec.fonts.display),
    resolveFont(spec.fonts.body),
    generateSkinImages(spec.imagePrompts),
  ]);
  const fontFallbacks = [
    display.family !== spec.fonts.display.trim() ? `${spec.fonts.display} -> ${display.family}` : null,
    body.family !== spec.fonts.body.trim() ? `${spec.fonts.body} -> ${body.family}` : null,
  ].filter((x): x is string => !!x);
  const finalSpec: SkinSpec = { ...spec, fonts: { ...spec.fonts, display: display.family, body: body.family } };

  const { colors, fixes } = enforceContrast(spec.colors);
  const css = sanitizeComponentCss(spec.componentCss);
  const html = renderSkinnedPage({
    spec: finalSpec,
    colors,
    fontQueries: { display: display.query, body: body.query },
    componentCss: css.css,
    assets: images.assets,
  });

  const usage: SkinUsage[] = [
    specUsage,
    ...images.usage,
  ];
  return {
    concept,
    spec: { ...finalSpec, colors },
    html,
    usage,
    totalMs: Date.now() - start,
    totalCostUSD: usage.reduce((s, u) => s + u.costUSD, 0),
    guards: {
      contrastFixes: fixes,
      droppedCssRules: css.droppedRules,
      droppedCssDecls: css.droppedDecls,
      fontFallbacks,
    },
  };
}
