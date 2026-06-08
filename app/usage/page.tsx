"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { STEPS, type StepKey } from "@/lib/icon/model-reference";
import { loadUsage, clearUsage, type UsageEntry } from "@/lib/icon/usage-log";

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
    r.cost += e.realizedCost ?? e.estCost;
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost);
}

// ---------------------------------------------------------------------------

export default function UsagePage() {
  const [entries, setEntries] = useState<UsageEntry[]>([]);

  function refresh() {
    setEntries(loadUsage());
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleClear() {
    if (!window.confirm("Clear the entire API usage log? This cannot be undone.")) {
      return;
    }
    clearUsage();
    refresh();
  }

  const totalCalls = entries.length;
  const totalEst = entries.reduce((s, e) => s + e.estCost, 0);
  const totalRealized = entries.reduce((s, e) => s + (e.realizedCost ?? 0), 0);
  const hasPartialRealized = entries.some((e) => e.ok && e.realizedCost == null);

  const byStep = rollupBy(entries, (e) => e.step);
  const byModel = rollupBy(entries, (e) => e.model);

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">API Usage</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              Every call to OpenAI made from this browser, with its estimated and
              realized cost. Stored locally — nothing leaves your device.
            </p>
            <Link
              href="/models"
              className="self-start text-sm font-medium text-cyan-400/80 hover:text-cyan-300"
            >
              → see the cost model on Models
            </Link>
          </div>

          {/* Totals */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                Total calls
              </span>
              <span className="font-mono text-3xl font-bold text-zinc-100">
                {totalCalls}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                Est. cost
              </span>
              <span className="font-mono text-3xl font-bold text-violet-300">
                {usd(totalEst)}
              </span>
            </div>
            <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                Realized cost
              </span>
              <span className="font-mono text-3xl font-bold text-cyan-300">
                {usd(totalRealized)}
              </span>
              {hasPartialRealized && (
                <span className="text-xs text-amber-400/70">
                  partial — text calls only have realized cost once run with token
                  usage; image calls are exact.
                </span>
              )}
            </div>
          </section>

          {/* Breakdown */}
          {entries.length > 0 && (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RollupCard title="Per step" rows={byStep} label={(k) => STEP_LABEL[k as StepKey] ?? k} />
              <RollupCard title="Per model" rows={byModel} mono />
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
                      <tr
                        key={e.id}
                        className="border-b border-zinc-800/60 align-top hover:bg-zinc-950/40"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-zinc-400">
                          {fmtTime(e.at)}
                        </td>
                        <td className="px-3 py-2 text-zinc-300">
                          {STEP_LABEL[e.step] ?? e.step}
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="pb-6 text-xs text-zinc-600">
            Cost figures use the same model as the{" "}
            <Link href="/models" className="text-zinc-500 hover:text-cyan-400">
              Models
            </Link>{" "}
            page. Image per-image prices are exact; text estimates use per-step
            token estimates until a call reports real token usage.
          </p>
        </div>
      </main>
    </>
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
