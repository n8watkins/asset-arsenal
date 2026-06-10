"use client";

// Fable Bench — source_review canvas. Original vs improved compare + actions.

import { useState } from "react";
import { approvedSource, type FableProject } from "@/lib/fable/types";
import { GhostButton, PrimaryButton } from "./ui";

export default function SourceReview({
  project,
  busy,
  devMode,
  onApprove,
  onRegenerate,
}: {
  project: FableProject;
  busy: boolean;
  devMode: boolean;
  onApprove: () => void;
  onRegenerate: (instruction: string) => void;
}) {
  const [tweak, setTweak] = useState("");
  const original = project.original;
  const improved = project.improved;
  const latest = improved[improved.length - 1] ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shown = improved.find((s) => s.id === selectedId) ?? latest;
  const approved = approvedSource(project);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Review your source</h2>
        <p className="text-sm text-zinc-500">
          This is the style anchor every icon is built from. Approve it or keep refining.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Panel label="Original" sub={original?.fileName}>
          {original && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={original.imageUrl} alt="original" className="w-full rounded-lg object-contain" />
          )}
        </Panel>
        <Panel
          label="Improved"
          sub={improved.length > 1 ? `v${improved.indexOf(shown!) + 1} of ${improved.length}` : undefined}
          highlight={!!shown && approved?.id === shown.id}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown.imageUrl} alt="improved" className="w-full rounded-lg object-contain" />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-zinc-600">
              No improved version yet.
            </div>
          )}
        </Panel>
      </div>

      {improved.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-500">Versions:</span>
          {improved.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`overflow-hidden rounded-lg border ${
                shown?.id === s.id ? "border-cyan-500/60" : "border-zinc-800"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imageUrl} alt={`v${i + 1}`} className="h-12 w-12 object-cover" />
            </button>
          ))}
        </div>
      )}

      {shown?.critique && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500">What changed</p>
          <p className="mt-1 text-sm text-zinc-300">{shown.critique}</p>
        </div>
      )}

      {devMode && shown?.prompt && (
        <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-xs">
          <summary className="cursor-pointer text-zinc-500">Image prompt</summary>
          <p className="mt-2 whitespace-pre-wrap text-zinc-400">{shown.prompt}</p>
        </details>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={onApprove} disabled={busy || !approved}>
            Approve & extract style →
          </PrimaryButton>
          {latest && (
            <GhostButton onClick={() => onRegenerate("Regenerate with a fresh take.")} disabled={busy}>
              Regenerate
            </GhostButton>
          )}
        </div>
        <div className="flex gap-2">
          <input
            value={tweak}
            onChange={(e) => setTweak(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tweak.trim() && !busy) {
                onRegenerate(tweak.trim());
                setTweak("");
              }
            }}
            placeholder="tweak… e.g. make it darker, more glassy"
            disabled={busy}
            className="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
          />
          <GhostButton
            onClick={() => {
              if (tweak.trim()) {
                onRegenerate(tweak.trim());
                setTweak("");
              }
            }}
            disabled={busy || !tweak.trim()}
          >
            Apply
          </GhostButton>
        </div>
      </div>
    </div>
  );
}

function Panel({
  label,
  sub,
  highlight,
  children,
}: {
  label: string;
  sub?: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border bg-zinc-900/40 p-3 ${
        highlight ? "border-cyan-500/50 ring-1 ring-cyan-500/20" : "border-zinc-800"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        {sub && <span className="text-[10px] text-zinc-500">{sub}</span>}
      </div>
      {children}
    </div>
  );
}
