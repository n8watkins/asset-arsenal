"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import { CATALOG, STEPS, type StepKey } from "@/lib/icon/model-reference";
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
// so this page never statically imports fable code (the Projects view lazily
// imports the fable store only to resolve project names).
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

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
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

// --- Projects view (call log grouped by project) -----------------------------

/** One step+model line inside a project accordion ("5× …route · gemini · $0"). */
type ProjectRow = {
  key: string;
  count: number;
  label: string;
  model: string;
  cost: number;
  failures: number;
};

type ProjectGroup = {
  key: string;
  bench: string;
  name: string;
  count: number;
  cost: number;
  failures: number;
  lastAt: string;
  rows: ProjectRow[];
};

/**
 * Group entries by projectId (entries without one pool under their bench,
 * e.g. "Icon pipeline — no project"), with the calls inside each group
 * collapsed by step + model. Names come from the entry itself when logged
 * (`projectName`), else from the Fable store join, else the short id.
 */
function buildProjectGroups(
  entries: UsageEntry[],
  fableNames: Map<string, string>,
): ProjectGroup[] {
  const groups = new Map<string, ProjectGroup & { rowMap: Map<string, ProjectRow> }>();
  for (const e of entries) {
    const bench = benchOf(e);
    const key = e.projectId ?? `bench:${bench}`;
    let g = groups.get(key);
    if (!g) {
      const name = e.projectId
        ? (e.projectName ??
          fableNames.get(e.projectId) ??
          e.projectId.slice(0, 8))
        : `${BENCH_LABEL[bench] ?? bench} — no project`;
      g = {
        key,
        bench,
        name,
        count: 0,
        cost: 0,
        failures: 0,
        lastAt: e.at,
        rows: [],
        rowMap: new Map(),
      };
      groups.set(key, g);
    } else if (e.projectId && e.projectName && g.name === e.projectId.slice(0, 8)) {
      g.name = e.projectName; // a later entry carries the name an earlier one lacked
    }
    g.count += 1;
    g.cost += e.realizedCost ?? 0;
    if (!e.ok) g.failures += 1;
    if (new Date(e.at).getTime() > new Date(g.lastAt).getTime()) g.lastAt = e.at;

    const rowKey = `${e.step}|${e.model}`;
    let row = g.rowMap.get(rowKey);
    if (!row) {
      row = { key: rowKey, count: 0, label: stepLabel(e), model: e.model, cost: 0, failures: 0 };
      g.rowMap.set(rowKey, row);
    }
    row.count += 1;
    row.cost += e.realizedCost ?? 0;
    if (!e.ok) row.failures += 1;
  }
  return [...groups.values()]
    .map(({ rowMap, ...g }) => ({
      ...g,
      rows: [...rowMap.values()].sort((a, b) => b.cost - a.cost || b.count - a.count),
    }))
    .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

// ---------------------------------------------------------------------------

export default function UsagePage() {
  const [allEntries, setAllEntries] = useState<UsageEntry[]>([]);
  const [benchFilter, setBenchFilter] = useState<string>("all");
  const [logView, setLogView] = useState<"calls" | "projects">("calls");
  // Fable project id → name, for entries logged before projectName existed.
  // Dynamic import so this page stays decoupled from fable code unless needed.
  const [fableNames, setFableNames] = useState<Map<string, string>>(new Map());

  function refresh() {
    loadUsage().then(setAllEntries);
  }

  useEffect(() => {
    refresh();
    import("@/lib/fable/store")
      .then((m) => m.listProjects())
      .then((ps) => setFableNames(new Map(ps.map((p) => [p.id, p.name]))))
      .catch(() => {
        /* fable store unavailable — short ids will show instead */
      });
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
  const byBench = rollupBy(entries, benchOf);

  const projectGroups = logView === "projects" ? buildProjectGroups(entries, fableNames) : [];

  // Gemini free-tier RPD meters: calls per model since LOCAL midnight, across
  // ALL benches (the quota is account-wide, so the bench filter doesn't apply).
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const geminiQuota = CATALOG.filter((m) => m.freeTierDailyRequests != null).map((m) => ({
    id: m.id,
    limit: m.freeTierDailyRequests!,
    used: allEntries.filter(
      (e) => e.model === m.id && new Date(e.at).getTime() >= midnight.getTime(),
    ).length,
  }));

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

          {/* Bench selector — scopes the whole page (totals, rollups, call log). */}
          {benches.length > 0 && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="bench-filter"
                className="text-xs uppercase tracking-widest text-zinc-500"
              >
                Bench
              </label>
              <select
                id="bench-filter"
                value={benchFilter}
                onChange={(e) => setBenchFilter(e.target.value)}
                className="rounded-lg border border-zinc-700/60 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 outline-none transition-colors hover:border-zinc-600 focus:border-cyan-600/60"
              >
                <option value="all">All benches</option>
                {benches.map((b) => (
                  <option key={b} value={b}>
                    {BENCH_LABEL[b] ?? b}
                  </option>
                ))}
              </select>
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

          {/* Gemini free-tier daily quota — account-wide, so always all benches. */}
          {geminiQuota.length > 0 && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">
                  Gemini free tier today
                </h3>
                <p className="text-xs text-zinc-600">
                  requests since local midnight, all benches — the daily cap is
                  account-wide, so the bench selector doesn&apos;t apply here.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                {geminiQuota.map((q) => {
                  const pct = (q.used / q.limit) * 100;
                  return (
                    <div key={q.id} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-xs text-zinc-300">{q.id}</span>
                        <span
                          className={`font-mono text-xs ${
                            pct >= 100
                              ? "text-red-400"
                              : pct > 80
                                ? "text-amber-300"
                                : "text-zinc-400"
                          }`}
                        >
                          {q.used} / {q.limit} requests today
                        </span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct >= 100
                              ? "bg-red-500"
                              : pct > 80
                                ? "bg-amber-400"
                                : "bg-cyan-500"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Breakdown */}
          {entries.length > 0 && (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <RollupCard title="Per step" rows={byStep} label={rollupStepLabel} />
              <RollupCard title="Per model" rows={byModel} mono />
              <RollupCard
                title="Per bench"
                rows={byBench}
                label={(k) => BENCH_LABEL[k] ?? k}
              />
            </section>
          )}

          {/* Table + controls */}
          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">Call log</h2>
                <div className="flex items-center gap-1 rounded-full bg-zinc-950/60 p-1 ring-1 ring-zinc-800">
                  {(["calls", "projects"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setLogView(v)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        logView === v
                          ? "bg-cyan-900/40 text-cyan-200 ring-1 ring-cyan-600/50"
                          : "text-zinc-400 hover:text-zinc-200"
                      }`}
                    >
                      {v === "calls" ? "Calls" : "Projects"}
                    </button>
                  ))}
                </div>
              </div>
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
            ) : logView === "projects" ? (
              <div className="flex flex-col gap-2">
                {projectGroups.map((g) => (
                  <details
                    key={g.key}
                    className="group rounded-xl border border-zinc-800 bg-zinc-950/40"
                  >
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 hover:bg-zinc-950/60 [&::-webkit-details-marker]:hidden">
                      <span className="text-zinc-600 transition-transform group-open:rotate-90">
                        ▸
                      </span>
                      <span className="truncate text-sm font-medium text-zinc-200">
                        {g.name}
                      </span>
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400 ring-1 ring-zinc-700/60">
                        {BENCH_LABEL[g.bench] ?? g.bench}
                      </span>
                      {g.failures > 0 && (
                        <span className="rounded-md bg-red-900/40 px-2 py-0.5 text-xs font-medium text-red-300 ring-1 ring-red-700/40">
                          {g.failures} failed
                        </span>
                      )}
                      <span className="ml-auto font-mono text-xs text-zinc-500">
                        {g.count}×
                      </span>
                      <span className="font-mono text-xs text-cyan-300">
                        {usd(g.cost)}
                      </span>
                      <span className="whitespace-nowrap text-xs text-zinc-500">
                        {fmtDate(g.lastAt)}
                      </span>
                    </summary>
                    <div className="flex flex-col gap-1.5 border-t border-zinc-800/60 px-4 py-3">
                      {g.rows.map((r) => (
                        <div key={r.key} className="flex items-center gap-3 text-sm">
                          <span className="w-10 text-right font-mono text-xs text-zinc-500">
                            {r.count}×
                          </span>
                          <span className="truncate text-zinc-300">{r.label}</span>
                          <span className="text-zinc-700">·</span>
                          <span className="truncate font-mono text-xs text-zinc-400">
                            {r.model}
                          </span>
                          {r.failures > 0 && (
                            <span className="whitespace-nowrap text-xs text-red-400">
                              {r.failures} failed
                            </span>
                          )}
                          <span className="ml-auto font-mono text-xs text-cyan-300">
                            {usd(r.cost)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
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
