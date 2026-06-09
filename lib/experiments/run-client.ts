// Client-side fetch wrapper for the experiment run route.

import type { CellInput, CellResult } from "./run-cell";

export async function runCell(input: CellInput): Promise<CellResult> {
  let res: Response;
  try {
    res = await fetch("/api/experiments/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) || "Request failed.",
    );
  }
  return (data as { result: CellResult }).result;
}
