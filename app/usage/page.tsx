"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { STEPS, type StepKey } from "@/lib/icon/model-reference";
import {
  loadUsage,
  clearUsage,
  type UsageEntry,
  type UsageResult,
} from "@/lib/icon/usage-log";

function usd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

const STEP_LABEL: Record<StepKey, string> = STEPS.reduce(
  (acc, s) => {
    acc[s.key] = `${s.num}. ${s.name}`;
    return acc;
  },
  {} as Record<StepKey, string>,
);

// Fable's step keys (FableStepKey in lib/fable/types.ts). Kept as plain strings
// so this page never imports fable code.
const FABLE_STEP_LABEL: Record<string, string> = {
  agent_route: "Fable · route intent",
  improve_source_brief: "Fable · upgrade brief",
  improve_source_image: "Fable · upgrade source",
  analyze: "Fable · analyze style", // only when bench === "fable"
  revise_prompts: "Fable · revise prompts",
  preview_image: "Fable · preview sheet",
  final_icon: "Fable · final icon",
  chat_title: "Fable · title chat",
};

function stepLabel(e: { step: string; bench?: string }): string {
  if (e.bench === "fable") return FABLE_STEP_LABEL[e.step] ?? `Fable · ${e.step}`;
  return STEP_LABEL[e.step as StepKey] ?? e.step;
}

/** Label a bench-qualified rollup key ("fable:analyze" or plain "analyze"). */
function rollupStepLabel(key: string): string {
  if (key.startsWith("fable:")) {
    const step = key.slice("fable:".length);
    return FABLE_STEP_LABEL[step] ?? `Fable · ${step}`;
  }
  return STEP_LABEL[key as StepKey] ?? key;
}

const BENCH_LABEL: Record<string, string> = {
  pipeline: "Icon pipeline (V1/V2/S + home)",
  fable: "Fable",
  experiments: "Experiments",
};

// Pipeline position of each step, so the per-step rollup reads top-to-bottom in
// run order (1→5) instead of by cost. Unknown steps sort last.
const STEP_ORDER: Record<string, number> = STEPS.reduce(
  (acc, s) => {
    acc[s.key] = s.num;
    return acc;
  },
  {} as Record<string, number>,
);

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

// ---------------------------------------------------------------------------

type Rollup = { key: string; count: number; cost: number };

function rollupBy(entries: UsageEntry[], pick: (e: UsageEntry) => string): Rollup[] {
  const map = new Map<string, Rollup>();
  for (const e of entries) {
    const key = pick(e);
    const r = map.get(key) ?? { key, count: 0, cost: 0 };
    r.count += 1;
    // Same accounting as the "Realized cost" headline, so cards never sum to
    // more than the total they sit under.
    r.cost += e.realizedCost ?? 0;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost);
}

/** Which surface an entry came from; entries predating the field are "pipeline". */
function benchOf(e: UsageEntry): string {
  return e.bench ?? "pipeline";
}

// ---------------------------------------------------------------------------

export default function UsagePage() {
  const [allEntries, setAllEntries] = useState<UsageEntry[]>([]);
  const [benchFilter, setBenchFilter] = useState<string>("all");

  function refresh() {
    loadUsage().then(setAllEntries);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleClear() {
    if (!window.confirm("Clear the entire API usage log? This cannot be undone.")) {
      return;
    }
    await clearUsage();
    refresh();
  }

  const benches = [...new Set(allEntries.map(benchOf))];
  const entries =
    benchFilter === "all" ? allEntries : allEntries.filter((e) => benchOf(e) === benchFilter);

  const totalCalls = entries.length;
  const totalEst = entries.reduce((s, e) => s + e.estCost, 0);
  const totalRealized = entries.reduce((s, e) => s + (e.realizedCost ?? 0), 0);
  const hasPartialRealized = entries.some((e) => e.ok && e.realizedCost == null);

  // Per step in pipeline order (1→5), fable steps after; per model stays sorted
  // by cost. Fable reuses the key "analyze" with a different meaning, so steps
  // roll up under a bench-qualified key.
  const byStep = rollupBy(entries, (e) =>
    benchOf(e) === "fable" ? `fable:${e.step}` : e.step,
  ).sort((a, b) => (STEP_ORDER[a.key] ?? 99) - (STEP_ORDER[b.key] ?? 99));
  const byModel = rollupBy(entries, (e) => e.model);
  const byBench = rollupBy(allEntries, benchOf);

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">API Usage</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              Every model call made from this browser — OpenAI and Gemini, across
              all benches including Fable — its estimated and realized cost{" "}
              <em>and the result it produced</em> (prompts/manifests in full;
              generated images saved to the gallery). Stored in your browser&apos;s
              local database (IndexedDB, same as the gallery) — full history, no
              cap, nothing leaves your device.
            </p>
            <Link
              href="/models"
              className="self-start text-sm font-medium text-cyan-400/80 hover:text-cyan-300"
            >
              → see the cost model on Models
            </Link>
          </div>

          {/* Bench filter */}
          {benches.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              {["all", ...benches].map((b) => (
                <button
                  key={b}
                  onClick={() => setBenchFilter(b)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
                    benchFilter === b
                      ? "bg-cyan-900/40 text-cyan-200 ring-cyan-600/50"
                      : "bg-zinc-900 text-zinc-400 ring-zinc-700/60 hover:text-zinc-200"
                  }`}
                >
                  {b === "all" ? "All benches" : (BENCH_LABEL[b] ?? b)}
                </button>
              ))}
            </div>
          )}

          {/* Totals — realized is the source of truth (actual billed tokens);
              the estimate is just a muted pre-flight reference. */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                Total calls
              </span>
              <span className="font-mono text-3xl font-bold text-zinc-100">
                {totalCalls}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-cyan-700/40 bg-cyan-950/20 p-6 ring-1 ring-cyan-500/20">
              <span className="text-xs uppercase tracking-widest text-cyan-500/80">
                Realized cost
              </span>
              <span className="font-mono text-3xl font-bold text-cyan-300">
                {usd(totalRealized)}
              </span>
              <span className="text-xs text-zinc-500">
                {hasPartialRealized
                  ? "partial — a few calls haven't reported token usage yet."
                  : "actual billed tokens — exact."}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-6">
              <span className="text-xs uppercase tracking-widest text-zinc-600">
                Est. (pre-flight)
              </span>
              <span className="font-mono text-2xl font-semibold text-zinc-500">
                {usd(totalEst)}
              </span>
              <span className="text-xs text-zinc-600">
                rough guess before each call — superseded by realized.
              </span>
            </div>
          </section>

          {/* Breakdown */}
          {entries.length > 0 && (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RollupCard title="Per step" rows={byStep} label={rollupStepLabel} />
              <RollupCard title="Per model" rows={byModel} mono />
              <RollupCard
                title="Per bench (all entries)"
                rows={byBench}
                label={(k) => BENCH_LABEL[k] ?? k}
              />
            </section>
          )}

          {/* Table + controls */}
          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Call log</h2>
              <button
                onClick={handleClear}
                disabled={entries.length === 0}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-red-700/60 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Clear log
              </button>
            </div>

            {entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-800 px-4 py-10 text-center text-sm text-zinc-500">
                No API calls logged yet. Run the pipeline on the Bench and they&apos;ll
                show up here.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-widest text-zinc-500">
                      <th className="px-3 py-2 font-medium">Time</th>
                      <th className="px-3 py-2 font-medium">Step</th>
                      <th className="px-3 py-2 font-medium">Model</th>
                      <th className="px-3 py-2 font-medium">Kind</th>
                      <th className="px-3 py-2 font-medium">Qty / quality</th>
                      <th className="px-3 py-2 text-right font-medium">Est.</th>
                      <th className="px-3 py-2 text-right font-medium">Realized</th>
                      <th className="px-3 py-2 text-right font-medium">Tokens (in/out)</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e) => (
                      <Fragment key={e.id}>
                      <tr
                        className="align-top hover:bg-zinc-950/40"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                          {fmtTime(e.at)}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          {stepLabel(e)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-300">
                          {e.model}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs ring-1 ${
                              e.kind === "image"
                                ? "bg-violet-900/30 text-violet-300 ring-violet-700/40"
                                : "bg-cyan-900/30 text-cyan-300 ring-cyan-700/40"
                            }`}
                          >
                            {e.kind}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-zinc-400">
                          {e.kind === "image"
                            ? `${e.count}× ${e.quality ?? "—"}`
                            : `${e.count}×`}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-zinc-300">
                          {usd(e.estCost)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-cyan-300">
                          {e.realizedCost != null ? usd(e.realizedCost) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-xs text-zinc-400">
                          {e.kind === "text" && e.inputTokens != null
                            ? `${e.inputTokens.toLocaleString()} / ${(e.outputTokens ?? 0).toLocaleString()}`
                            : "—"}
                        </td>
                        <td className="px-3 py-2">
                          {e.ok ? (
                            <span className="rounded-md bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
                              ok
                            </span>
                          ) : (
                            <span
                              className="rounded-md bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-300 ring-1 ring-red-700/40"
                              title={e.error}
                            >
                              failed
                            </span>
                          )}
                          {!e.ok && e.error && (
                            <p className="mt-1 max-w-xs text-xs text-red-400/80">
                              {e.error}
                            </p>
                          )}
                        </td>
                      </tr>
                      <tr className="border-b border-zinc-800/60">
                        <td colSpan={9} className="px-3 pb-3">
                          <ResultBlock result={e.result} ok={e.ok} />
                        </td>
                      </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="pb-6 text-xs text-zinc-600">
            Cost figures use the same pricing table as the{" "}
            <Link href="/models" className="text-zinc-500 hover:text-cyan-400">
              Models
            </Link>{" "}
            page. <span className="text-zinc-500">Realized</span> is exact — image
            prices are per-image, and text/vision is priced from the real token
            usage OpenAI reports on every call. The pre-flight estimate is only a
            rough preview (it can&apos;t know output length until the model writes
            it) and is replaced by realized once the call runs.
          </p>
        </div>
      </main>
    </>
  );
}

// Shows what a call actually produced. Text results expand in place; image
// results are summarised (the bytes themselves live in the gallery).
function ResultBlock({ result, ok }: { result?: UsageResult; ok: boolean }) {
  if (!result) {
    return (
      <span className="text-xs text-zinc-600">
        {ok ? "no stored result" : "—"}
      </span>
    );
  }
  if (result.kind === "image") {
    return (
      <span className="text-xs text-zinc-400">
        🖼 {result.count} image{result.count === 1 ? "" : "s"} →{" "}
        <Link href="/gallery" className="text-cyan-400/80 hover:text-cyan-300">
          saved to gallery
        </Link>
      </span>
    );
  }
  return (
    <details className="group">
      <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
        result ({result.text.length.toLocaleString()} chars
        {result.truncated ? ", truncated" : ""}) — click to view
      </summary>
      <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300 whitespace-pre-wrap break-words">
        {result.text}
      </pre>
    </details>
  );
}

function RollupCard({
  title,
  rows,
  label = (k) => k,
  mono = false,
}: {
  title: string;
  rows: Rollup[];
  label?: (key: string) => string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </h3>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.key}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
          >
            <span className={`flex-1 truncate text-sm text-zinc-200 ${mono ? "font-mono text-xs" : ""}`}>
              {label(r.key)}
            </span>
            <span className="font-mono text-xs text-zinc-500">{r.count}×</span>
            <span className="font-mono text-xs text-cyan-300">{usd(r.cost)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
