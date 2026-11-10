// Page skins - WCAG contrast guard. The model is asked for AA contrast but does
// not always deliver; this nudges failing foreground colors toward black or
// white until each pair passes, and reports what it changed.

import type { SkinSpec } from "./spec";

type RGB = [number, number, number];

function parse(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: RGB) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string): number {
  const ca = parse(a), cb = parse(b);
  if (!ca || !cb) return 1;
  const [l1, l2] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Mix fg toward black or white (whichever the backgrounds are farther from) until it passes. */
function fix(fg: string, bgs: string[], min: number): string {
  const c = parse(fg);
  if (!c) return "#000000";
  const worst = () => Math.min(...bgs.map((b) => contrast(toHex(cur), b)));
  const bgLum = Math.max(...bgs.map((b) => luminance(parse(b) ?? [0, 0, 0])));
  const target: RGB = bgLum > 0.18 ? [0, 0, 0] : [255, 255, 255];
  let cur: RGB = c;
  for (let t = 0.05; worst() < min && t <= 1.0001; t += 0.05) {
    cur = c.map((v, i) => v + (target[i] - v) * t) as RGB;
  }
  return toHex(cur);
}

export type ContrastFix = { token: string; from: string; to: string; ratioBefore: number };

export function enforceContrast(colors: SkinSpec["colors"]): {
  colors: SkinSpec["colors"];
  fixes: ContrastFix[];
} {
  const out = { ...colors };
  const fixes: ContrastFix[] = [];
  const pairs: [keyof typeof out, (keyof typeof out)[], number][] = [
    ["text", ["bg", "surface"], 4.5],
    ["muted", ["bg", "surface"], 4.5],
    ["onPrimary", ["primary"], 4.5],
    ["onAccent", ["accent"], 3],
    ["accent", ["bg", "surface"], 3],
  ];
  for (const [fg, bgs, min] of pairs) {
    const ratio = Math.min(...bgs.map((b) => contrast(out[fg], out[b])));
    if (ratio < min) {
      const to = fix(out[fg], bgs.map((b) => out[b]), min);
      fixes.push({ token: fg, from: out[fg], to, ratioBefore: Math.round(ratio * 100) / 100 });
      out[fg] = to;
    }
  }
  return { colors: out, fixes };
}
