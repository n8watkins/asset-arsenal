// localStorage-backed append log of every API call made from this browser.
// Browser-only; best-effort (never throws). Used by the /usage tracking page.

import type { StepKey, ImageQuality } from "@/lib/icon/model-reference";

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
};

export const USAGE_LOG_KEY = "asset-arsenal:usage-log";

// Cap the local log so it can't grow unbounded and blow the localStorage quota.
// Newest-first, so we keep the most recent calls. Lifts entirely once usage
// moves to a real database.
export const USAGE_LOG_CAP = 500;

/** Every call ever logged, newest-first. */
export function loadUsage(): UsageEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(USAGE_LOG_KEY);
    return raw ? (JSON.parse(raw) as UsageEntry[]) : [];
  } catch {
    return [];
  }
}

/** Prepend one entry (newest-first) and persist. Best-effort. */
export function logUsage(
  entry: Omit<UsageEntry, "id" | "at"> & { at?: string },
): void {
  if (typeof localStorage === "undefined") return;
  try {
    const full: UsageEntry = {
      ...entry,
      id: crypto.randomUUID(),
      at: entry.at ?? new Date().toISOString(),
    };
    const next = [full, ...loadUsage()].slice(0, USAGE_LOG_CAP);
    localStorage.setItem(USAGE_LOG_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearUsage(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(USAGE_LOG_KEY);
  } catch {
    /* ignore */
  }
}
