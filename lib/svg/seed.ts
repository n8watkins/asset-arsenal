// A curated space/HUD seed pack so the bench opens with something to restyle.
// All from Lucide (stroke-based, monochrome — ideal restyle targets). Any ref
// that fails to resolve is skipped defensively, so a renamed icon won't break
// the page.

import type { SvgIconRef } from "./types";

export const SEED_PACK: SvgIconRef[] = [
  "lucide:crosshair",
  "lucide:rocket",
  "lucide:radar",
  "lucide:satellite",
  "lucide:satellite-dish",
  "lucide:orbit",
  "lucide:telescope",
  "lucide:compass",
  "lucide:target",
  "lucide:radio",
  "lucide:globe",
  "lucide:navigation",
].map((id) => {
  const [prefix, name] = id.split(":");
  return { id, prefix, name };
});
