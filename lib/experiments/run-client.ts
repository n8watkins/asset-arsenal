// Client-side fetch wrapper for the experiment run route.
//
// Every cell run is also appended to the global usage ledger (success AND
// failure) — experiments spend real tokens/images like any other bench.
// Logging is best-effort and never changes the return value or thrown error.

import { logUsage, summarizeText } from "@/lib/icon/usage-log";
import { imageCostUSD } from "@/lib/icon/model-reference";
import { getExperimentModel } from "./model-registry";
import type { CellInput, CellResult } from "./run-cell";

async function postRun(input: CellInput): Promise<CellResult> {
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

// Best-effort ledger entry for one cell run. Must never throw.
function logCell(
  input: CellInput,
  outcome: { result?: CellResult; error?: unknown },
): void {
  try {
    const model = getExperimentModel(input.model);
    const kind: "text" | "image" = model?.output === "image" ? "image" : "text";
    const quality = kind === "image" ? (input.settings?.quality ?? "medium") : undefined;
    // Image cost is deterministic per image; text has no pre-flight token
    // estimate here, so its est falls back to the realized figure (0 for
    // free-tier Gemini cells — still logged).
    const estCost =
      kind === "image"
        ? imageCostUSD(input.model, quality ?? "medium", 1)
        : outcome.result?.costUSD ?? 0;
    void logUsage({
      step: "experiment_run",
      model: input.model,
      kind,
      quality,
      count: 1,
      estCost,
      realizedCost: outcome.result ? outcome.result.costUSD ?? null : null,
      inputTokens: outcome.result?.usage?.inputTokens,
      outputTokens: outcome.result?.usage?.outputTokens,
      ok: !outcome.error,
      error: outcome.error
        ? outcome.error instanceof Error
          ? outcome.error.message
          : String(outcome.error)
        : undefined,
      result: outcome.result
        ? outcome.result.kind === "image"
          ? { kind: "image", count: outcome.result.image ? 1 : 0 }
          : summarizeText(outcome.result.text ?? "")
        : undefined,
      bench: "experiments",
      provider: model?.provider === "google" ? "gemini" : "openai",
    });
  } catch {
    /* logging must never break a run */
  }
}

export async function runCell(input: CellInput): Promise<CellResult> {
  try {
    const result = await postRun(input);
    logCell(input, { result });
    return result;
  } catch (err) {
    logCell(input, { error: err });
    throw err;
  }
}
