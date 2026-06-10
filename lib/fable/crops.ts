"use client";

// Fable Bench — B15 client-side icon cropping.
//
// Given the approved source (a data URL) and a normalized bounding box from
// the locate_icons step, cut the region out via canvas — free, no model call —
// into a small PNG data URL capped at ~256px on the longest edge. Best-effort:
// returns null on any decode/draw failure (the caller treats absent crops as
// "nothing to show").

import type { IconSourceBox } from "./types";

export const SOURCE_CROP_MAX_EDGE = 256;

export async function cropFromDataUrl(
  sourceDataUrl: string,
  box: IconSourceBox,
  maxEdge = SOURCE_CROP_MAX_EDGE,
): Promise<string | null> {
  try {
    const blob = await (await fetch(sourceDataUrl)).blob();
    const bitmap = await createImageBitmap(blob);
    try {
      const sx = Math.round(box.x0 * bitmap.width);
      const sy = Math.round(box.y0 * bitmap.height);
      const sw = Math.round((box.x1 - box.x0) * bitmap.width);
      const sh = Math.round((box.y1 - box.y0) * bitmap.height);
      if (sw < 4 || sh < 4) return null; // degenerate box — nothing useful

      const scale = Math.min(1, maxEdge / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, w, h);
      return canvas.toDataURL("image/png");
    } finally {
      bitmap.close();
    }
  } catch {
    return null;
  }
}
