// IndexedDB-backed log of every API call made from this browser, including the
// result each call produced. Browser-only; best-effort (never throws). Backs
// the /usage page. Lives in the same local database as the gallery (the "usage"
// store in lib/storage/db.ts), so there's no size cap and results are kept in
// full — localStorage (5 MB, strings only) was only ever a stopgap for tiny
// metadata.

import { getDB } from "@/lib/storage/db";
import type { StepKey, ImageQuality } from "@/lib/icon/model-reference";

// The actual output a call produced, stored alongside the request so /usage is a
// results history, not just a call log. Text is stored in full; images are
// referenced by count — the bytes live in the gallery's stores, not here.
export type UsageResult =
  | { kind: "text"; text: string; truncated?: boolean }
  | { kind: "image"; count: number };

/** Wrap a text result. No truncation — IndexedDB has room for the full text. */
export function summarizeText(text: string): UsageResult {
  return { kind: "text", text };
}

export type UsageEntry = {
  id: string;
  at: string; // ISO timestamp
  step: StepKey;
  model: string;
  kind: "text" | "image";
  quality?: ImageQuality;
  count: number;
  estCost: number;
  realizedCost: number | null;
  inputTokens?: number;
  outputTokens?: number;
  ok: boolean;
  error?: string;
  result?: UsageResult;
};

/** Every call ever logged, newest-first. Best-effort: returns [] on any error. */
export async function loadUsage(): Promise<UsageEntry[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("usage");
    all.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return all;
  } catch {
    return [];
  }
}

/** Append one entry. Best-effort — a storage error never breaks the caller. */
export async function logUsage(
  entry: Omit<UsageEntry, "id" | "at"> & { at?: string },
): Promise<void> {
  try {
    const db = await getDB();
    const full: UsageEntry = {
      ...entry,
      id: crypto.randomUUID(),
      at: entry.at ?? new Date().toISOString(),
    };
    await db.put("usage", full);
  } catch {
    /* unavailable / quota — ignore */
  }
}

/** Wipe the entire usage log. */
export async function clearUsage(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("usage");
  } catch {
    /* ignore */
  }
}
