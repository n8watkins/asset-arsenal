// Page skins - step 3: turn a spec + assets into a standalone skinned HTML page.

import { LAYOUT_CSS, samplePageBody } from "./sample-page";
import type { SkinSpec } from "./spec";
import type { SkinAssets } from "./types";

const FALLBACK_FONT = "Inter";

/** Google returns 400 for an unknown family or an unavailable weight axis.
 *  Try the full weight range, then the default weight, then fall back. */
export async function resolveFont(family: string): Promise<{ family: string; query: string }> {
  const name = encodeURIComponent(family.trim()).replace(/%20/g, "+");
  for (const query of [`family=${name}:wght@400;500;600;700;800;900`, `family=${name}:wght@400;700`, `family=${name}`]) {
    const res = await fetch(`https://fonts.googleapis.com/css2?${query}&display=swap`, { method: "GET" });
    if (res.ok) return { family: family.trim(), query };
  }
  return { family: FALLBACK_FONT, query: `family=${FALLBACK_FONT}:wght@400;500;600;700;800;900` };
}

const esc = (s: string) => s.replace(/[<>"]/g, "");

export function renderSkinnedPage(args: {
  spec: SkinSpec;
  colors: SkinSpec["colors"];
  fontQueries: { display: string; body: string };
  componentCss: string;
  assets: SkinAssets;
}): string {
  const { spec, colors, assets } = args;
  const veil = Math.min(0.97, Math.max(0.4, spec.texture.veilOpacity));
  const tokens = `
:root{
  --bg:${colors.bg};--surface:${colors.surface};--text:${colors.text};--muted:${colors.muted};
  --primary:${colors.primary};--on-primary:${colors.onPrimary};--accent:${colors.accent};--on-accent:${colors.onAccent};--border:${colors.border};
  --font-display:"${esc(spec.fonts.display)}",Georgia,serif;--font-body:"${esc(spec.fonts.body)}",system-ui,sans-serif;
  --display-weight:${spec.fonts.displayWeight};--display-transform:${spec.fonts.displayTransform};--display-tracking:${spec.fonts.displayTrackingEm}em;
  --radius:${Math.max(0, Math.min(28, spec.shape.radiusPx))}px;--border-width:${Math.max(0, Math.min(4, spec.shape.borderWidthPx))}px;
  --shadow:${esc(spec.shape.shadow) || "none"};
  --texture-veil:color-mix(in srgb,var(--bg) ${Math.round(veil * 100)}%,transparent);
  --texture-size:${Math.max(256, Math.min(768, spec.texture.tileSizePx))}px;
  ${assets.texture ? `--skin-texture:url("${assets.texture}");` : ""}
}`;
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Fieldnote - ${esc(spec.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?${args.fontQueries.display}&${args.fontQueries.body}&display=swap">
<style>${tokens}
${LAYOUT_CSS}
/* skin component layer */
${args.componentCss}
</style></head><body>${samplePageBody(assets.emblem, assets.hero)}</body></html>`;
}
