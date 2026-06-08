// Local persistence for saved calculation stacks. Browser-only; best-effort.
// The bench will read these (next task) to run with a chosen stack.

import type { Stack } from "./model-reference";

export const SAVED_STACKS_KEY = "asset-arsenal:saved-stacks";

export function loadStacks(): Stack[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_STACKS_KEY);
    return raw ? (JSON.parse(raw) as Stack[]) : [];
  } catch {
    return [];
  }
}

export function saveStacks(stacks: Stack[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(SAVED_STACKS_KEY, JSON.stringify(stacks));
  } catch {
    /* quota / private mode — ignore */
  }
}
