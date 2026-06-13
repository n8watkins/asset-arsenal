// Lazy SVG cache (SVG-ICON-BENCH.md §3). Browser-only (IndexedDB).
//
// Bundled sets load instantly from local JSON, so caching them is mostly a
// convenience today — its real payoff is the API/long-tail path (later step),
// where every fetched icon lands here and the network footprint only shrinks.
// `resolveAndCache` is the single entry point: cache hit → return; miss →
// resolve from a bundled set, store, return.

import { getDB } from "@/lib/storage/db";
import { resolveIcon } from "./iconify";
import type { SvgIconRecord } from "./types";

/** What we persist per icon — the record plus a cache timestamp. */
export type CachedSvgIcon = SvgIconRecord & { cachedAt: number };

export async function getCached(id: string): Promise<CachedSvgIcon | undefined> {
  const db = await getDB();
  return db.get("svgIcons", id);
}

export async function putCached(record: SvgIconRecord): Promise<void> {
  const db = await getDB();
  await db.put("svgIcons", { ...record, cachedAt: Date.now() });
}

export async function listCached(): Promise<CachedSvgIcon[]> {
  const db = await getDB();
  return db.getAllFromIndex("svgIcons", "by-cachedAt");
}

export async function cachedCount(): Promise<number> {
  const db = await getDB();
  return db.count("svgIcons");
}

/** Outcome of a resolve — lets the UI show the cache-hit-vs-fetch meter. */
export interface ResolveResult {
  record: SvgIconRecord | null;
  source: "cache" | "bundled" | "miss";
}

/**
 * Resolve an icon, preferring the cache. On a miss, pull it from its bundled
 * set and store it. Returns `miss` only when the icon doesn't exist anywhere
 * local (a future step falls through to the Iconify API here).
 */
export async function resolveAndCache(
  prefix: string,
  name: string
): Promise<ResolveResult> {
  const id = `${prefix}:${name}`;

  const hit = await getCached(id);
  if (hit) return { record: hit, source: "cache" };

  const record = await resolveIcon(prefix, name);
  if (!record) return { record: null, source: "miss" };

  await putCached(record);
  return { record, source: "bundled" };
}
