"use client";

// Fable Bench — finals canvas. Responsive grid on a checkerboard-transparency
// backdrop, with status shimmer, retry, per-icon download, "download all".

import { downloadDataUrl, slugify } from "@/lib/icon/download";
import type { FableFinalIcon, FableProject } from "@/lib/fable/types";
import { GhostButton, Pill, PrimaryButton } from "./ui";

const CHECKER =
  "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 16px 16px";

export default function FinalsGrid({
  project,
  busy,
  devMode,
  onRetry,
  onRegenerate,
  onSaveFinish,
}: {
  project: FableProject;
  busy: boolean;
  devMode: boolean;
  onRetry: (iconId: string) => void;
  onRegenerate: (iconId: string) => void;
  onSaveFinish: () => void;
}) {
  const finals = project.finals;
  const successes = finals.filter((f) => f.status === "success");
  const allDone =
    finals.length > 0 && finals.every((f) => f.status === "success" || f.status === "failed");
  const allOk = finals.length > 0 && finals.every((f) => f.status === "success");

  function downloadAll() {
    for (const f of successes) {
      if (f.imageUrl) downloadDataUrl(f.imageUrl, `${slugify(f.name)}.png`);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Final icons</h2>
          <p className="text-sm text-zinc-500">
            {successes.length}/{finals.length} rendered
            {project.stage === "finals" && !allDone ? " · generating…" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <GhostButton onClick={downloadAll} disabled={successes.length === 0}>
            Download all
          </GhostButton>
        </div>
      </div>

      {allOk && (
        <div className="rounded-2xl border border-emerald-700/40 bg-emerald-950/20 p-4">
          <p className="text-sm font-medium text-emerald-200">Your icon pack is ready.</p>
          <p className="text-xs text-emerald-300/70">
            {successes.length} icons in the {project.style?.styleName ?? "extracted"} style.
          </p>
          <PrimaryButton className="mt-3" onClick={onSaveFinish} disabled={busy}>
            Save &amp; finish
          </PrimaryButton>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {finals.map((f) => (
          <FinalCard
            key={f.id}
            final={f}
            busy={busy}
            devMode={devMode}
            onRetry={onRetry}
            onRegenerate={onRegenerate}
          />
        ))}
      </div>

      {finals.length === 0 && (
        <p className="text-sm text-zinc-600">No finals yet.</p>
      )}
    </div>
  );
}

function FinalCard({
  final,
  busy,
  devMode,
  onRetry,
  onRegenerate,
}: {
  final: FableFinalIcon;
  busy: boolean;
  devMode: boolean;
  onRetry: (iconId: string) => void;
  onRegenerate: (iconId: string) => void;
}) {
  const pending = final.status === "pending" || final.status === "generating";
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2">
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg"
        style={{ background: CHECKER }}
      >
        {final.status === "success" && final.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={final.imageUrl} alt={final.name} className="h-full w-full object-contain" />
        ) : final.status === "failed" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-red-950/40 p-2 text-center">
            <span className="text-[10px] text-red-300">{final.error ?? "failed"}</span>
            <button
              onClick={() => onRetry(final.iconId)}
              disabled={busy}
              className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] text-red-200 ring-1 ring-red-700/40 hover:bg-red-500/25 disabled:opacity-40"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="absolute inset-0 animate-pulse bg-zinc-800/60" />
        )}
      </div>
      <div className="flex items-center gap-1">
        <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-300">{final.name}</span>
        <span className="font-mono text-[9px] text-zinc-600">{final.iconId}</span>
      </div>
      {pending && <Pill tone="violet">{final.status}</Pill>}
      {final.status === "success" && (
        <div className="flex gap-1">
          <button
            onClick={() => downloadDataUrl(final.imageUrl, `${slugify(final.name)}.png`)}
            className="flex-1 rounded bg-cyan-500/15 px-1.5 py-1 text-[10px] text-cyan-300 ring-1 ring-cyan-500/30 hover:bg-cyan-500/25"
          >
            PNG
          </button>
          <button
            onClick={() => onRegenerate(final.iconId)}
            disabled={busy}
            className="flex-1 rounded border border-zinc-700 px-1.5 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-40"
          >
            Regen
          </button>
        </div>
      )}
      {devMode && final.prompt && (
        <details className="text-[10px]">
          <summary className="cursor-pointer text-zinc-600">prompt</summary>
          <p className="mt-1 whitespace-pre-wrap text-zinc-500">{final.prompt}</p>
        </details>
      )}
    </div>
  );
}
