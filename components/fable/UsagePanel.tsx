"use client";

// Fable Bench — the Usage panel (right drawer), opened from the header cost
// pill in BOTH live and dev modes.
//
// Two scopes: THIS chat's usage, and ALL-Fable usage aggregated across every
// saved project (merged with the live in-memory project, which may be ahead of
// the store). Each scope shows totals, the per-model breakdown (model /
// provider / calls / tokens in-out / cost — the owner's stated requirement),
// and a per-step breakdown. Links out to the global /usage page.

import { useEffect, useMemo, useState } from "react";
import { getAllUsage, listProjects } from "@/lib/fable/store";
import type { FableProject, FableUsageRecord } from "@/lib/fable/types";
import { loadUsage } from "@/lib/icon/usage-log";
import { CATALOG } from "@/lib/icon/model-reference";
import { fmtUsd, Pill } from "./ui";

type Scope = "chat" | "all";

type Agg = {
  calls: number;
  okCalls: number;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  images: number;
};

const EMPTY_AGG: Agg = { calls: 0, okCalls: 0, cost: 0, inputTokens: 0, outputTokens: 0, images: 0 };

function addTo(agg: Agg, u: FableUsageRecord): void {
  agg.calls += 1;
  if (u.ok) agg.okCalls += 1;
  agg.cost += u.estCostUSD;
  agg.inputTokens += u.inputTokens ?? 0;
  agg.outputTokens += u.outputTokens ?? 0;
  if (u.kind === "image") agg.images += u.imageCount ?? 1;
}

function aggregate(records: FableUsageRecord[]): {
  total: Agg;
  byModel: { key: string; model: string; provider: string; agg: Agg }[];
  byStep: { step: string; agg: Agg }[];
} {
  const total: Agg = { ...EMPTY_AGG };
  const byModel = new Map<string, { model: string; provider: string; agg: Agg }>();
  const byStep = new Map<string, Agg>();
  for (const u of records) {
    addTo(total, u);
    const mKey = `${u.provider}/${u.model}`;
    if (!byModel.has(mKey)) byModel.set(mKey, { model: u.model, provider: u.provider, agg: { ...EMPTY_AGG } });
    addTo(byModel.get(mKey)!.agg, u);
    if (!byStep.has(u.step)) byStep.set(u.step, { ...EMPTY_AGG });
    addTo(byStep.get(u.step)!, u);
  }
  return {
    total,
    byModel: [...byModel.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.agg.cost - a.agg.cost || b.agg.calls - a.agg.calls),
    byStep: [...byStep.entries()]
      .map(([step, agg]) => ({ step, agg }))
      .sort((a, b) => b.agg.cost - a.agg.cost || b.agg.calls - a.agg.calls),
  };
}

export default function UsagePanel({
  project,
  onClose,
}: {
  project: FableProject;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<Scope>("chat");
  const [stored, setStored] = useState<{ projectId: string; usage: FableUsageRecord[] }[]>([]);
  // Project id → name, for the by-project table (live project name comes from props).
  const [projectNames, setProjectNames] = useState<Map<string, string>>(new Map());
  // Gemini free-tier meter is quota-wide, so it reads the GLOBAL ledger (all
  // benches) — Fable's own records are per-project and would undercount.
  const [geminiToday, setGeminiToday] = useState<{ id: string; used: number; limit: number }[]>([]);

  useEffect(() => {
    let alive = true;
    void getAllUsage().then((rows) => {
      if (alive) setStored(rows);
    });
    void listProjects().then((ps) => {
      if (alive) setProjectNames(new Map(ps.map((p) => [p.id, p.name])));
    });
    void loadUsage().then((entries) => {
      if (!alive) return;
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      setGeminiToday(
        CATALOG.filter((m) => m.freeTierDailyRequests != null).map((m) => ({
          id: m.id,
          limit: m.freeTierDailyRequests!,
          used: entries.filter(
            (e) => e.model === m.id && new Date(e.at).getTime() >= midnight.getTime(),
          ).length,
        })),
      );
    });
    return () => {
      alive = false;
    };
  }, [project.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ALL-Fable = every saved project, with the live project replacing its
  // (possibly stale / absent) stored row.
  const allRecords = useMemo(
    () => [
      ...stored.filter((r) => r.projectId !== project.id).flatMap((r) => r.usage),
      ...project.usage,
    ],
    [stored, project.id, project.usage],
  );

  const records = scope === "chat" ? project.usage : allRecords;
  const { total, byModel, byStep } = useMemo(() => aggregate(records), [records]);

  // Per-project rows for the "All Fable" scope (live project replaces its
  // stored row, same as allRecords above). Names join against the store.
  const byProject = useMemo(() => {
    if (scope !== "all") return [];
    const merged = [
      ...stored.filter((r) => r.projectId !== project.id),
      { projectId: project.id, usage: project.usage },
    ];
    return merged
      .map((r) => ({
        id: r.projectId,
        name:
          r.projectId === project.id
            ? project.name
            : (projectNames.get(r.projectId) ?? r.projectId.slice(0, 8)),
        calls: r.usage.length,
        cost: r.usage.reduce((s, u) => s + u.estCostUSD, 0),
      }))
      .filter((p) => p.calls > 0)
      .sort((a, b) => b.cost - a.cost || b.calls - a.calls);
  }, [scope, stored, project.id, project.name, project.usage, projectNames]);
  const projectCount =
    scope === "all"
      ? new Set([...stored.map((r) => r.projectId), project.id]).size
      : 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="fable-card-in flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
          <span className="text-sm font-semibold text-zinc-100">Usage</span>
          <div className="ml-2 flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 p-0.5 text-[11px]">
            <button
              onClick={() => setScope("chat")}
              className={`rounded-full px-2.5 py-1 ${
                scope === "chat" ? "bg-cyan-500/20 text-cyan-200" : "text-zinc-500"
              }`}
            >
              This chat
            </button>
            <button
              onClick={() => setScope("all")}
              className={`rounded-full px-2.5 py-1 ${
                scope === "all" ? "bg-violet-500/20 text-violet-200" : "text-zinc-500"
              }`}
            >
              All Fable
            </button>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Close usage panel"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {/* Totals */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Est. cost" value={fmtUsd(total.cost)} accent />
            <Stat label="Calls" value={`${total.calls}${total.calls !== total.okCalls ? ` (${total.calls - total.okCalls} failed)` : ""}`} />
            <Stat label="Images" value={String(total.images)} />
            <Stat label="Tokens in" value={total.inputTokens.toLocaleString()} />
            <Stat label="Tokens out" value={total.outputTokens.toLocaleString()} />
            <Stat label={scope === "all" ? "Projects" : "Project"} value={String(projectCount)} />
          </div>

          {/* Per-project breakdown (All-Fable scope only) */}
          {scope === "all" && (
            <>
              <SectionTitle>By project</SectionTitle>
              <table className="w-full text-left text-[11px]">
                <thead className="text-zinc-500">
                  <tr>
                    <th className="py-1 pr-2">Project</th>
                    <th className="pr-2 text-right">Calls</th>
                    <th className="text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  {byProject.map((p) => (
                    <tr key={p.id} className="border-t border-zinc-900">
                      <td className="max-w-0 truncate py-1 pr-2" title={p.name}>
                        {p.name}
                      </td>
                      <td className="pr-2 text-right">{p.calls}</td>
                      <td className="text-right">{fmtUsd(p.cost)}</td>
                    </tr>
                  ))}
                  {byProject.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-2 text-zinc-600">
                        No usage yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </>
          )}

          {/* Per-model breakdown */}
          <SectionTitle>By model</SectionTitle>
          <table className="w-full text-left text-[11px]">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-2">Model</th>
                <th className="pr-2">Provider</th>
                <th className="pr-2 text-right">Calls</th>
                <th className="pr-2 text-right">Tok in/out</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {byModel.map((m) => (
                <tr key={m.key} className="border-t border-zinc-900">
                  <td className="py-1 pr-2 font-mono text-zinc-300">{m.model}</td>
                  <td className="pr-2">
                    <Pill tone={m.provider === "openai" ? "emerald" : "violet"}>{m.provider}</Pill>
                  </td>
                  <td className="pr-2 text-right">{m.agg.calls}</td>
                  <td className="pr-2 text-right text-zinc-400">
                    {m.agg.inputTokens.toLocaleString()}/{m.agg.outputTokens.toLocaleString()}
                  </td>
                  <td className="text-right">{fmtUsd(m.agg.cost)}</td>
                </tr>
              ))}
              {byModel.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-2 text-zinc-600">
                    No usage yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Per-step breakdown */}
          <SectionTitle>By step</SectionTitle>
          <table className="w-full text-left text-[11px]">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-2">Step</th>
                <th className="pr-2 text-right">Calls</th>
                <th className="pr-2 text-right">Images</th>
                <th className="text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              {byStep.map((s) => (
                <tr key={s.step} className="border-t border-zinc-900">
                  <td className="py-1 pr-2 font-mono text-zinc-400">{s.step}</td>
                  <td className="pr-2 text-right">{s.agg.calls}</td>
                  <td className="pr-2 text-right">{s.agg.images || "—"}</td>
                  <td className="text-right">{fmtUsd(s.agg.cost)}</td>
                </tr>
              ))}
              {byStep.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-zinc-600">
                    No usage yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Gemini free-tier daily quota — global ledger, not just Fable */}
          {geminiToday.length > 0 && (
            <>
              <SectionTitle>Gemini free tier (all benches, today)</SectionTitle>
              <div className="flex flex-col gap-1">
                {geminiToday.map((q) => {
                  const pct = (q.used / q.limit) * 100;
                  return (
                    <div key={q.id} className="flex items-center justify-between text-[11px]">
                      <span className="font-mono text-zinc-400">{q.id}</span>
                      <span
                        className={
                          pct >= 100
                            ? "text-red-400"
                            : pct > 80
                              ? "text-amber-300"
                              : "text-zinc-300"
                        }
                      >
                        today: {q.used}/{q.limit}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <p className="mt-4 text-[11px] text-zinc-500">
            Gemini runs on the free tier today, so its estimated cost is $0 (tokens still counted).{" "}
            <a href="/usage" className="text-cyan-300 hover:underline">
              Full cross-bench history →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-5 text-[10px] uppercase tracking-widest text-zinc-500">{children}</p>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2.5">
      <p className={`truncate text-sm font-semibold ${accent ? "text-emerald-300" : "text-zinc-100"}`}>
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
  );
}
