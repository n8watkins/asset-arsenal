// Bundled icon sets — the local-first serving layer (SVG-ICON-BENCH.md §3).
//
// We do NOT bundle all of Iconify. We install a handful of popular sets as
// `@iconify-json/*` packages; each is a single JSON of every icon's raw path
// data. These serve fetch + within-set search fully offline, zero network.
// The Iconify API is the discovery + long-tail layer (wired in a later step).

import type { IconifyJSON } from "@iconify/types";

export interface BundledSet {
  prefix: string;
  label: string;
  license: { title: string; url: string };
  /** Dynamic loader — code-split so set JSON stays out of the initial bundle. */
  load: () => Promise<IconifyJSON>;
}

// License facts are stable per set; hardcoded so every export carries honest
// attribution without a network call (the `icons.json` payload omits `info`).
export const BUNDLED_SETS: Record<string, BundledSet> = {
  lucide: {
    prefix: "lucide",
    label: "Lucide",
    license: {
      title: "ISC",
      url: "https://github.com/lucide-icons/lucide/blob/main/LICENSE",
    },
    load: () =>
      import("@iconify-json/lucide/icons.json").then(
        (m) => (m.default ?? m) as unknown as IconifyJSON
      ),
  },
  tabler: {
    prefix: "tabler",
    label: "Tabler",
    license: {
      title: "MIT",
      url: "https://github.com/tabler/tabler-icons/blob/master/LICENSE",
    },
    load: () =>
      import("@iconify-json/tabler/icons.json").then(
        (m) => (m.default ?? m) as unknown as IconifyJSON
      ),
  },
  ph: {
    prefix: "ph",
    label: "Phosphor",
    license: {
      title: "MIT",
      url: "https://github.com/phosphor-icons/core/blob/main/LICENSE",
    },
    load: () =>
      import("@iconify-json/ph/icons.json").then(
        (m) => (m.default ?? m) as unknown as IconifyJSON
      ),
  },
};

export const BUNDLED_PREFIXES = Object.keys(BUNDLED_SETS);

// Loaded sets are cached in-memory for the session — the JSON never changes.
const _loaded = new Map<string, Promise<IconifyJSON>>();

export function loadSet(prefix: string): Promise<IconifyJSON> {
  const set = BUNDLED_SETS[prefix];
  if (!set) {
    return Promise.reject(new Error(`Set "${prefix}" is not bundled.`));
  }
  let p = _loaded.get(prefix);
  if (!p) {
    p = set.load();
    _loaded.set(prefix, p);
  }
  return p;
}
