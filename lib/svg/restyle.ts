// The deterministic restyle engine (SVG-ICON-BENCH.md §4).
//
// record + style → a complete <svg> string. No model calls — every operation is
// plain markup manipulation. The string this produces is BOTH what the preview
// renders and what gets rasterized at export: one source of truth.

import { replaceIDs } from "@iconify/utils";
import type { SvgIconRecord, SvgStyle, ColorSpec, GlowSpec } from "./types";

const GRAD_ID = "aa-grad";
const GLOW_ID = "aa-glow";

/** angle° → a center-crossing line in objectBoundingBox (0..1) coords. */
function angleToLine(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return { x1: 0.5 - x, y1: 0.5 - y, x2: 0.5 + x, y2: 0.5 + y };
}

function gradientDef(color: Extract<ColorSpec, { type: "gradient" }>): string {
  const stops = [...color.stops]
    .sort((a, b) => a.offset - b.offset)
    .map(
      (s) =>
        `<stop offset="${Math.round(s.offset * 100)}%" stop-color="${s.color}"/>`
    )
    .join("");

  if (color.kind === "radial") {
    return `<radialGradient id="${GRAD_ID}" cx="0.5" cy="0.5" r="0.5">${stops}</radialGradient>`;
  }
  const { x1, y1, x2, y2 } = angleToLine(color.angle);
  return `<linearGradient id="${GRAD_ID}" x1="${x1.toFixed(3)}" y1="${y1.toFixed(
    3
  )}" x2="${x2.toFixed(3)}" y2="${y2.toFixed(3)}">${stops}</linearGradient>`;
}

function glowDef(glow: GlowSpec): string {
  return (
    `<filter id="${GLOW_ID}" x="-75%" y="-75%" width="250%" height="250%" ` +
    `color-interpolation-filters="sRGB">` +
    `<feDropShadow dx="0" dy="0" stdDeviation="${glow.blur}" ` +
    `flood-color="${glow.color}" flood-opacity="1"/>` +
    `</filter>`
  );
}

/**
 * Apply a full style recipe to one icon record, returning a standalone <svg>
 * string. IDs are uniquified per call so a whole pack can render in one document
 * without gradient/filter collisions.
 */
export function buildStyledSvg(
  record: SvgIconRecord,
  style: SvgStyle
): string {
  const { width, height } = record;
  let body = record.body;

  // 1. Stroke width — override every stroke-width the set baked in. No-op on
  //    fill-only icons (they carry no stroke-width attribute).
  if (record.drawMode !== "fill") {
    body = body.replace(
      /stroke-width="[^"]*"/g,
      `stroke-width="${style.strokeWidth}"`
    );
  }

  // 2. Color. Solid → leave currentColor (resolved via the svg's `color`).
  //    Gradient → repoint every currentColor paint at the gradient.
  const defs: string[] = [];
  if (style.color.type === "gradient") {
    defs.push(gradientDef(style.color));
    body = body.replace(/currentColor/g, `url(#${GRAD_ID})`);
  }

  // 3. Glow — an SVG filter (not CSS) so it survives rasterization too.
  const hasGlow = style.glow.blur > 0;
  if (hasGlow) defs.push(glowDef(style.glow));
  const inner = hasGlow
    ? `<g filter="url(#${GLOW_ID})">${body}</g>`
    : body;

  // 4. Assemble + uniquify ids/refs (gradient + filter) for collision-free packs.
  const content = replaceIDs(
    (defs.length ? `<defs>${defs.join("")}</defs>` : "") + inner
  );

  const solidColor =
    style.color.type === "solid" ? style.color.value : undefined;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="100%" height="100%"` +
    (solidColor ? ` style="color:${solidColor}"` : "") +
    `>${content}</svg>`
  );
}
