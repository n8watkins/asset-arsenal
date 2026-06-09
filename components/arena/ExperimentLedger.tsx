"use client";

import { useEffect, useState } from "react";
import {
  listExperiments,
  deleteExperiment,
  clearExperiments,
  rollupUsage,
  type ArenaExperiment,
} from "@/lib/gemini/arena-store";

// Read/review surface for the prompt-arena ledger. Lists every experiment
// newest-first (raw Gemini JSON + verdict + usage), with a token-usage rollup
// across the whole ledger. Reloads whenever `refreshKey` changes.

function fmt(n: number): string {
  return n.toLocaleString();
}

function winnerText(j: ArenaExperiment["judgment"]): string {
  if (j.winner === "tie") return "tie";
  return `${j.winner} (${Math.round(j.confidence * 100)}%)`;
}

function ExperimentRow({
  exp,
  onDelete,
}: {
  exp: ArenaExperiment;
  onDelete: (id: string) => void;
}) {
  const [showRaw, setShowRaw] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-cyan-300">{exp.label}</span>
        {exp.tag && (
          <span className="rounded-md bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-300">
            {exp.tag}
          </span>
        )}
        <span className="text-xs text-zinc-500">
          winner <span className="font-mono text-zinc-300">{winnerText(exp.judgment)}</span>
        </span>
        <span className="ml-auto font-mono text-xs text-zinc-600">{exp.model}</span>
        <button
          onClick={() => onDelete(exp.id)}
          className="rounded-md px-1.5 py-0.5 text-xs text-zinc-600 transition-colors hover:text-red-400 focus:outline-none"
          aria-label="Delete experiment"
        >
          ✕
        </button>
      </div>

      {/* Image thumbnails for image-comparison experiments */}
      {(exp.inputs.imageA || exp.inputs.imageB) && (
        <div className="flex gap-2">
          {[exp.inputs.imageA, exp.inputs.imageB].map((src, i) =>
            src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={src}
                alt={`image ${i === 0 ? "A" : "B"}`}
                className="h-16 w-16 rounded-md border border-zinc-800 object-contain bg-zinc-900"
              />
            ) : null,
          )}
        </div>
      )}

      <p className="line-clamp-2 text-sm text-zinc-400">{exp.judgment.rationale}</p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>{new Date(exp.createdAt).toLocaleString()}</span>
        {exp.usage && (
          <span className="font-mono">
            in {fmt(exp.usage.inputTokens)} · out {fmt(exp.usage.outputTokens)} tok
          </span>
        )}
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-cyan-400/70 transition-colors hover:text-cyan-300 focus:outline-none"
        >
          {showRaw ? "hide raw JSON" : "raw JSON"}
        </button>
      </div>

      {showRaw && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
          {exp.raw}
        </pre>
      )}
    </div>
  );
}

export interface ExperimentLedgerProps {
  // Bump to force a reload (e.g. after a new comparison is saved).
  refreshKey?: number;
}

export default function ExperimentLedger({ refreshKey = 0 }: ExperimentLedgerProps) {
  const [experiments, setExperiments] = useState<ArenaExperiment[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function reload() {
    const all = await listExperiments();
    setExperiments(all);
    setLoaded(true);
  }

  useEffect(() => {
    void reload();
  }, [refreshKey]);

  async function onDelete(id: string) {
    await deleteExperiment(id);
    void reload();
  }

  async function onClear() {
    if (!confirm("Clear the entire experiment ledger? This cannot be undone.")) return;
    await clearExperiments();
    void reload();
  }

  const rollup = rollupUsage(experiments);

  if (!loaded) {
    return <p className="text-sm text-zinc-600">Loading ledger…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-zinc-100">
          Experiment ledger{" "}
          <span className="text-sm font-normal text-zinc-500">
            ({experiments.length})
          </span>
        </h2>
        {experiments.length > 0 && (
          <button
            onClick={onClear}
            className="rounded-lg px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:text-red-400 focus:outline-none"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Usage rollup — Gemini is free, so this is pure visibility. */}
      {experiments.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-600">Calls</p>
              <p className="font-mono text-lg text-zinc-200">{rollup.totalCalls}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-600">Input tokens</p>
              <p className="font-mono text-lg text-cyan-300">{fmt(rollup.totalInputTokens)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-600">Output tokens</p>
              <p className="font-mono text-lg text-violet-300">{fmt(rollup.totalOutputTokens)}</p>
            </div>
          </div>
          {rollup.byModel.length > 1 && (
            <div className="flex flex-col gap-1 border-t border-zinc-800 pt-2">
              {rollup.byModel.map((m) => (
                <div key={m.model} className="flex items-center gap-3 text-xs text-zinc-500">
                  <span className="font-mono text-zinc-400">{m.model}</span>
                  <span>{m.calls} calls</span>
                  <span className="font-mono">
                    {fmt(m.inputTokens)} in · {fmt(m.outputTokens)} out
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* The experiments */}
      {experiments.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No experiments yet. Run a comparison above and it lands here — inputs,
          verdict, raw Gemini JSON, and token usage, all captured.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {experiments.map((exp) => (
            <ExperimentRow key={exp.id} exp={exp} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
