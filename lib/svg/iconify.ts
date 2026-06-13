// Resolve raw icon data from bundled sets + local within-set search.
// (Iconify API discovery for the long tail is a later step.)

import { getIconData } from "@iconify/utils";
import { BUNDLED_SETS, BUNDLED_PREFIXES, loadSet } from "./sets";
import type { SvgIconRecord } from "./types";

/** Classify how an icon paints, from its raw body. Drives recolor + stroke. */
function detectModes(body: string): {
  colorMode: SvgIconRecord["colorMode"];
  drawMode: SvgIconRecord["drawMode"];
} {
  const hasStroke = /stroke="currentColor"/.test(body);
  const hasFill = /fill="currentColor"/.test(body);
  // Any explicit hex / rgb / non-currentColor named paint → multicolor.
  const hasHardColor = /(?:fill|stroke)="(?!none|currentColor)[^"]+"/.test(body);

  const colorMode = hasHardColor ? "multicolor" : "monochrome";
  const drawMode =
    hasStroke && hasFill ? "mixed" : hasStroke ? "stroke" : "fill";
  return { colorMode, drawMode };
}

/**
 * Resolve one icon to a cache-ready record. Local only (bundled sets); returns
 * null if the prefix isn't bundled or the name doesn't exist.
 */
export async function resolveIcon(
  prefix: string,
  name: string
): Promise<SvgIconRecord | null> {
  const set = BUNDLED_SETS[prefix];
  if (!set) return null;

  const iconSet = await loadSet(prefix);
  const data = getIconData(iconSet, name);
  if (!data) return null;

  const { colorMode, drawMode } = detectModes(data.body);
  return {
    id: `${prefix}:${name}`,
    prefix,
    name,
    body: data.body,
    width: data.width ?? 24,
    height: data.height ?? 24,
    colorMode,
    drawMode,
    license: set.license,
  };
}

export interface SearchHit {
  id: string;
  prefix: string;
  name: string;
}

/**
 * Search within bundled sets by name + alias substring. This is the offline
 * discovery path; cross-set discovery over all of Iconify is the API's job.
 */
export async function searchLocal(
  query: string,
  limit = 60
): Promise<SearchHit[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const prefix of BUNDLED_PREFIXES) {
    const set = await loadSet(prefix);
    const names = Object.keys(set.icons);
    const aliases = set.aliases ? Object.keys(set.aliases) : [];
    for (const name of [...names, ...aliases]) {
      if (name.includes(q)) {
        hits.push({ id: `${prefix}:${name}`, prefix, name });
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}
