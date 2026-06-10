"use client";

// Fable Bench — blueprint artifact card (inline in the chat feed).
// Style name + summary, palette swatches, mood/line/shape tags, a collapsible
// candidate list with per-row remove, and a "Generate preview sheets" action.

import { useState } from "react";
import { chunkForSheets, type FableProject, type IconCandidate } from "@/lib/fable/types";
import { ArtifactCard, CardAction, Pill } from "../ui";

function isHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{3,8}$/.test(s.trim());
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/40">
      {children}
    </span>
  );
}

export default function BlueprintCard({
  project,
  busy,
  onGeneratePreviews,
  onRemoveCandidate,
  onUpdateCandidate,
}: {
  project: FableProject;
  busy: boolean;
  onGeneratePreviews: () => void;
  onRemoveCandidate: (id: string) => void;
  onUpdateCandidate: (id: string, patch: Partial<IconCandidate>) => void;
}) {
  const style = project.style;
  const active = project.candidates.filter((c) => c.status === "active");
  const sheetCount = chunkForSheets(project.candidates).length;
  const [showIcons, setShowIcons] = useState(true);

  return (
    <ArtifactCard title="Blueprint" badge={<Pill tone="cyan">style</Pill>}>
      {style && (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="text-base font-semibold text-zinc-100">{style.styleName}</h3>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{style.summary}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {style.colorPalette.map((c, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md bg-zinc-950/60 px-1.5 py-1 ring-1 ring-zinc-800"
              >
                <span
                  className="h-4 w-4 rounded ring-1 ring-zinc-700"
                  style={
                    isHex(c)
                      ? { backgroundColor: c.startsWith("#") ? c : `#${c}` }
                      : { backgroundColor: "#3f3f46" }
                  }
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
                  <span
                    key={i}
                    className="rounded-md bg-red-950/30 px-1.5 py-0.5 text-[10px] text-red-300/80 ring-1 ring-red-900/40"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <button
          onClick={() => setShowIcons((v) => !v)}
          className="text-xs font-medium text-zinc-300 hover:text-zinc-100"
        >
          {showIcons ? "▾" : "▸"} Icon set <span className="text-zinc-500">· {active.length}</span>
        </button>
        {showIcons && (
          <div className="mt-2 flex flex-col gap-1.5">
            {active.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2"
              >
                <span className="mt-0.5 font-mono text-[10px] text-zinc-600">{c.id}</span>
                <div className="min-w-0 flex-1">
                  <input
                    value={c.name}
                    onChange={(e) => onUpdateCandidate(c.id, { name: e.target.value })}
                    className="w-full bg-transparent text-sm font-medium text-zinc-100 focus:outline-none"
                  />
                  <p className="truncate text-xs text-zinc-500" title={c.rationale}>
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
            ))}
            {active.length === 0 && <p className="text-sm text-zinc-600">No active candidates.</p>}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CardAction tone="cyan" onClick={onGeneratePreviews} disabled={busy || active.length === 0}>
          Generate preview sheets →
        </CardAction>
        <span className="text-xs text-zinc-500">
          {sheetCount} sheet{sheetCount === 1 ? "" : "s"} · {active.length} icons
        </span>
      </div>
    </ArtifactCard>
  );
}
