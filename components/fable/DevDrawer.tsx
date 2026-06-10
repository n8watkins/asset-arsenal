"use client";

// Fable Bench — Dev Mode bottom drawer. Tabs: Usage / Prompts / Raw JSON /
// Pipeline. Hidden entirely in Live Mode (the page never renders it).

import { useState } from "react";
import { totalCostUSD } from "@/lib/fable/pricing";
import type { FableProject } from "@/lib/fable/types";
import { fmtTime, fmtUsd, GhostButton, Pill } from "./ui";

type Tab = "usage" | "prompts" | "raw" | "pipeline";

export default function DevDrawer({
  project,
  open,
  onToggle,
  onRunAnalyze,
  onRunPreviews,
  onGenerateFinals,
}: {
  project: FableProject;
  open: boolean;
  onToggle: () => void;
  onRunAnalyze: () => void;
  onRunPreviews: () => void;
  onGenerateFinals: () => void;
}) {
  const [tab, setTab] = useState<Tab>("usage");

  return (
    <div className="border-t border-zinc-800 bg-zinc-950">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
      >
        <span className="font-mono text-violet-400">{open ? "▾" : "▸"}</span>
        Dev drawer
        <span className="ml-auto text-zinc-600">
          {project.usage.length} calls · {fmtUsd(totalCostUSD(project.usage))}
        </span>
      </button>

      {open && (
        <div className="max-h-72 overflow-hidden">
          <div className="flex gap-1 border-b border-zinc-800 px-3">
            {(["usage", "prompts", "raw", "pipeline"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs capitalize ${
                  tab === t
                    ? "border-b-2 border-cyan-500 text-cyan-300"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="max-h-60 overflow-auto p-3 text-xs">
            {tab === "usage" && <UsageTab project={project} />}
            {tab === "prompts" && <PromptsTab project={project} />}
            {tab === "raw" && <RawTab project={project} />}
            {tab === "pipeline" && (
              <PipelineTab
                project={project}
                onRunAnalyze={onRunAnalyze}
                onRunPreviews={onRunPreviews}
                onGenerateFinals={onGenerateFinals}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UsageTab({ project }: { project: FableProject }) {
  const rows = [...project.usage].reverse();
  const totalOpenai = totalCostUSD(project.usage, "openai");
  return (
    <table className="w-full text-left text-[11px]">
      <thead className="text-zinc-500">
        <tr>
          <th className="py-1 pr-2">Time</th>
          <th className="pr-2">Provider</th>
          <th className="pr-2">Model</th>
          <th className="pr-2">Step</th>
          <th className="pr-2">Tokens / img</th>
          <th className="pr-2">Est $</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody className="text-zinc-300">
        {rows.map((u) => (
          <tr key={u.id} className="border-t border-zinc-900">
            <td className="py-1 pr-2 text-zinc-500">{fmtTime(u.at)}</td>
            <td className="pr-2">
              <Pill tone={u.provider === "openai" ? "emerald" : "violet"}>{u.provider}</Pill>
            </td>
            <td className="pr-2 font-mono text-zinc-400">{u.model}</td>
            <td className="pr-2 font-mono text-zinc-500">{u.step}</td>
            <td className="pr-2 text-zinc-400">
              {u.kind === "image"
                ? `${u.imageCount ?? 1} img`
                : `${u.inputTokens ?? 0}/${u.outputTokens ?? 0}`}
            </td>
            <td className="pr-2">{fmtUsd(u.estCostUSD)}</td>
            <td>
              <span className={u.ok ? "text-emerald-400" : "text-red-400"}>
                {u.ok ? "ok" : "error"}
              </span>
            </td>
          </tr>
        ))}
        {rows.length === 0 && (
          <tr>
            <td colSpan={7} className="py-2 text-zinc-600">
              No usage yet.
            </td>
          </tr>
        )}
      </tbody>
      {rows.length > 0 && (
        <tfoot className="text-zinc-400">
          <tr className="border-t border-zinc-800">
            <td colSpan={5} className="py-1 text-right text-zinc-500">
              Total OpenAI
            </td>
            <td className="font-medium">{fmtUsd(totalOpenai)}</td>
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  );
}

function PromptsTab({ project }: { project: FableProject }) {
  const blocks: { label: string; text: string }[] = [];
  for (const s of project.improved) {
    if (s.prompt) blocks.push({ label: `improved source ${s.id}`, text: s.prompt });
  }
  if (project.sharedStylePrompt)
    blocks.push({ label: "sharedStylePrompt", text: project.sharedStylePrompt });
  for (const c of project.candidates.filter((c) => c.status === "active")) {
    blocks.push({ label: `${c.id} · ${c.name}`, text: c.prompt });
  }
  for (const sh of project.sheets) {
    blocks.push({ label: `sheet ${sh.index} (${sh.status})`, text: sh.prompt });
  }
  for (const f of project.finals) {
    if (f.prompt) blocks.push({ label: `final ${f.iconId} · ${f.name}`, text: f.prompt });
  }
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((b, i) => (
        <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">{b.label}</p>
          <p className="mt-1 whitespace-pre-wrap text-zinc-400">{b.text}</p>
        </div>
      ))}
      {blocks.length === 0 && <p className="text-zinc-600">No prompts yet.</p>}
    </div>
  );
}

function stripImages(project: FableProject): unknown {
  const sizeOf = (s: string) => `(data url, ${Math.round(s.length / 1024)} KB)`;
  const clone = JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
  const scrub = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if ((k === "imageUrl" || k === "imageBase64") && typeof v === "string" && v.length > 64) {
        (obj as Record<string, unknown>)[k] = sizeOf(v);
      } else if (typeof v === "object") {
        scrub(v);
      }
    }
  };
  scrub(clone);
  return clone;
}

function RawTab({ project }: { project: FableProject }) {
  return (
    <pre className="whitespace-pre-wrap break-all text-[10px] text-zinc-400">
      {JSON.stringify(stripImages(project), null, 2)}
    </pre>
  );
}

function PipelineTab({
  project,
  onRunAnalyze,
  onRunPreviews,
  onGenerateFinals,
}: {
  project: FableProject;
  onRunAnalyze: () => void;
  onRunPreviews: () => void;
  onGenerateFinals: () => void;
}) {
  const lastDecision = [...project.events].reverse().find((e) => e.kind === "decision");
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-zinc-400">
        <span>Stage:</span>
        <Pill tone="cyan">{project.stage}</Pill>
        {lastDecision && lastDecision.kind === "decision" && (
          <>
            <span>Last decision:</span>
            <Pill tone="violet">{lastDecision.decision.intent}</Pill>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <GhostButton className="px-3 py-1.5 text-xs" onClick={onRunAnalyze}>
          Run analyze
        </GhostButton>
        <GhostButton className="px-3 py-1.5 text-xs" onClick={onRunPreviews}>
          Run previews
        </GhostButton>
        <GhostButton className="px-3 py-1.5 text-xs" onClick={onGenerateFinals}>
          Generate finals
        </GhostButton>
      </div>
    </div>
  );
}
