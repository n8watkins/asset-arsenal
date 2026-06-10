"use client";

// Fable Bench — blueprint canvas. Style card + editable candidate table.

import { chunkForSheets, type FableProject, type IconCandidate } from "@/lib/fable/types";
import { Pill, PrimaryButton } from "./ui";

function isHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{3,8}$/.test(s.trim());
}

export default function BlueprintPanel({
  project,
  busy,
  devMode,
  onGeneratePreviews,
  onRemoveCandidate,
  onUpdateCandidate,
}: {
  project: FableProject;
  busy: boolean;
  devMode: boolean;
  onGeneratePreviews: () => void;
  onRemoveCandidate: (id: string) => void;
  onUpdateCandidate: (id: string, patch: Partial<IconCandidate>) => void;
}) {
  const style = project.style;
  const active = project.candidates.filter((c) => c.status === "active");
  const sheetCount = chunkForSheets(project.candidates).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Blueprint</h2>
        <p className="text-sm text-zinc-500">
          The extracted style and the icon set. Tune the lineup, then render preview sheets.
        </p>
      </div>

      {style && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-base font-semibold text-zinc-100">{style.styleName}</h3>
            <Pill tone="cyan">style</Pill>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{style.summary}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {style.colorPalette.map((c, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-md bg-zinc-950/60 px-1.5 py-1 ring-1 ring-zinc-800">
                <span
                  className="h-4 w-4 rounded ring-1 ring-zinc-700"
                  style={isHex(c) ? { backgroundColor: c.startsWith("#") ? c : `#${c}` } : { backgroundColor: "#3f3f46" }}
                />
                <span className="text-[10px] text-zinc-400">{c}</span>
              </span>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Tag>{style.lineStyle}</Tag>
            <Tag>{style.shapeLanguage}</Tag>
            <Tag>{style.lighting}</Tag>
            {style.mood.map((m, i) => (
              <Tag key={i}>{m}</Tag>
            ))}
          </div>

          {style.negativeRules.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Never</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {style.negativeRules.map((r, i) => (
                  <span key={i} className="rounded-md bg-red-950/30 px-1.5 py-0.5 text-[10px] text-red-300/80 ring-1 ring-red-900/40">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">
            Icon set <span className="text-zinc-500">· {active.length} active</span>
          </h3>
        </div>
        <div className="flex flex-col gap-2">
          {active.map((c) => (
            <div key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-[10px] text-zinc-600">{c.id}</span>
                <div className="min-w-0 flex-1">
                  <input
                    value={c.name}
                    onChange={(e) => onUpdateCandidate(c.id, { name: e.target.value })}
                    className="w-full bg-transparent text-sm font-medium text-zinc-100 focus:outline-none"
                  />
                  <p className="text-xs text-zinc-500" title={c.rationale}>
                    {c.concept}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveCandidate(c.id)}
                  className="text-zinc-600 hover:text-red-400"
                  aria-label={`Remove ${c.name}`}
                >
                  ✕
                </button>
              </div>
              {devMode && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-zinc-600">prompt</summary>
                  <p className="mt-1 whitespace-pre-wrap text-zinc-500">{c.prompt}</p>
                </details>
              )}
            </div>
          ))}
          {active.length === 0 && (
            <p className="text-sm text-zinc-600">No active candidates.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onGeneratePreviews} disabled={busy || active.length === 0}>
          Generate preview sheets →
        </PrimaryButton>
        <span className="text-xs text-zinc-500">
          {sheetCount} sheet{sheetCount === 1 ? "" : "s"} · {active.length} icons
        </span>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/40">
      {children}
    </span>
  );
}
