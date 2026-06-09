// IndexedDB-backed ledger of prompt-arena experiments. Browser-only;
// best-effort (never throws — a storage failure must not break a comparison).
// Each experiment captures the full flow: inputs, the parsed verdict, the RAW
// Gemini JSON response verbatim, and token usage. Lives in the shared
// asset-arsenal DB (the "experiments" store in lib/storage/db.ts).

import { getDB } from "@/lib/storage/db";
import type { TokenUsage } from "@/types/icon-pipeline";
import type { PromptJudgment } from "./schemas/prompt-judgment.schema";

export type ArenaExperimentKind = "prompt-comparison" | "image-comparison";

export type ArenaExperiment = {
  id: string;
  // Monotonic experiment number → the deterministic "exp-001" label. No API
  // call is ever made to name an experiment.
  seq: number;
  // Auto label, e.g. "exp-001 · prompt-comparison".
  label: string;
  // Optional free-text tag the user types (e.g. "calendar-icon-style"). Never
  // model-generated.
  tag?: string;
  kind: ArenaExperimentKind;
  createdAt: string; // ISO timestamp
  model: string;
  // The request side: prompts, intent, and (later) image references.
  inputs: {
    promptA: string;
    promptB: string;
    intent?: string;
  };
  // The parsed, validated verdict. (Union widens when image judging lands.)
  judgment: PromptJudgment;
  // The raw Gemini response text, verbatim — the direct API JSON.
  raw: string;
  usage?: TokenUsage;
};

/** Deterministic label from a sequence number + kind. Pure, no I/O, no API. */
export function experimentLabel(seq: number, kind: ArenaExperimentKind): string {
  return `exp-${String(seq).padStart(3, "0")} · ${kind}`;
}

/** All experiments, newest-first. Best-effort: returns [] on any error. */
export async function listExperiments(): Promise<ArenaExperiment[]> {
  try {
    const db = await getDB();
    const all = await db.getAll("experiments");
    all.sort((a, b) => b.seq - a.seq);
    return all;
  } catch {
    return [];
  }
}

/** Next sequence number = (max existing seq) + 1. Best-effort, starts at 1. */
async function nextSeq(): Promise<number> {
  try {
    const db = await getDB();
    // The by-seq index is ascending; the last key is the current max.
    const cursor = await db
      .transaction("experiments")
      .store.index("by-seq")
      .openCursor(null, "prev");
    return cursor ? cursor.value.seq + 1 : 1;
  } catch {
    return 1;
  }
}

/**
 * Persist one experiment. Assigns the next seq and deterministic label, then
 * returns the full stored record (so the caller can show the assigned label).
 * Best-effort: on storage failure it still returns a record (seq 0) so the UI
 * has something to show — it just isn't persisted.
 */
export async function saveExperiment(input: {
  kind: ArenaExperimentKind;
  model: string;
  inputs: ArenaExperiment["inputs"];
  judgment: PromptJudgment;
  raw: string;
  usage?: TokenUsage;
  tag?: string;
}): Promise<ArenaExperiment> {
  const seq = await nextSeq();
  const record: ArenaExperiment = {
    id: crypto.randomUUID(),
    seq,
    label: experimentLabel(seq, input.kind),
    tag: input.tag?.trim() || undefined,
    kind: input.kind,
    createdAt: new Date().toISOString(),
    model: input.model,
    inputs: input.inputs,
    judgment: input.judgment,
    raw: input.raw,
    usage: input.usage,
  };
  try {
    const db = await getDB();
    await db.put("experiments", record);
  } catch {
    /* unavailable / quota — return the record unpersisted */
  }
  return record;
}

/** Delete one experiment. Best-effort. */
export async function deleteExperiment(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("experiments", id);
  } catch {
    /* ignore */
  }
}

/** Wipe the entire ledger. Best-effort. */
export async function clearExperiments(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear("experiments");
  } catch {
    /* ignore */
  }
}

// ---- Usage rollup -----------------------------------------------------------

export type UsageByModel = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
};

export type ArenaUsageRollup = {
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: UsageByModel[];
};

/** Aggregate token usage across all experiments (Gemini is free → visibility). */
export function rollupUsage(experiments: ArenaExperiment[]): ArenaUsageRollup {
  const byModel = new Map<string, UsageByModel>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const e of experiments) {
    const inT = e.usage?.inputTokens ?? 0;
    const outT = e.usage?.outputTokens ?? 0;
    totalInputTokens += inT;
    totalOutputTokens += outT;

    const row = byModel.get(e.model) ?? {
      model: e.model,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    row.calls += 1;
    row.inputTokens += inT;
    row.outputTokens += outT;
    byModel.set(e.model, row);
  }

  return {
    totalCalls: experiments.length,
    totalInputTokens,
    totalOutputTokens,
    byModel: [...byModel.values()].sort((a, b) => b.calls - a.calls),
  };
}
