"use client";

// Fable Bench — finals artifact card (inline in the chat feed).
//
// Responsive icon grid on a checkerboard-transparency backdrop, with shimmer
// while generating, retry on fail, per-icon download + regenerate. Icons are
// clickable → detailed Lightbox (download / open in new tab). A progress line
// ("7/9 done · $0.08") and, once complete, Download all + "Save & finish".
// Updates live as icons stream in (renders straight from project.finals).

import { useState } from "react";
import { downloadDataUrl, slugify } from "@/lib/icon/download";
import { downloadZip, zipEntriesFromDataUrls } from "@/lib/zip";
import { totalCostUSD } from "@/lib/fable/pricing";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import type { FableFinalIcon, FableProject } from "@/lib/fable/types";
import { ArtifactCard, CardAction, fmtUsd, Lightbox, Pill } from "../ui";

const CHECKER = "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 16px 16px";

export default function FinalsCard({
  project,
  busy,
  onRetry,
  onRegenerate,
  onSaveFinish,
}: {
  project: FableProject;
  busy: boolean;
  onRetry: (iconId: string) => void;
  onRegenerate: (iconId: string) => void;
  onSaveFinish: () => void;
}) {
  const finals = project.finals;
  const successes = finals.filter((f) => f.status === "success");
  const allDone =
    finals.length > 0 && finals.every((f) => f.status === "success" || f.status === "failed");
  const allOk = finals.length > 0 && finals.every((f) => f.status === "success");
  const cost = totalCostUSD(project.usage, "openai");
  const [enlarged, setEnlarged] = useState<FableFinalIcon | null>(null);

  function downloadAll() {
    // One zip (STORE-only, lib/zip.ts) instead of N separate downloads.
    const entries = zipEntriesFromDataUrls(
      successes.filter((f) => f.imageUrl).map((f) => ({ name: f.name, dataUrl: f.imageUrl })),
    );
    downloadZip(`${slugify(project.name)}.zip`, entries);
  }

  return (
    <ArtifactCard
      title="Final icons"
      badge={
        allDone ? <Pill tone="emerald">done</Pill> : <Pill tone="violet">generating</Pill>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
        <span>
          {successes.length}/{finals.length} done
        </span>
        <span className="text-zinc-600">·</span>
        <span className="text-emerald-300">{fmtUsd(cost)}</span>
        {!allDone && (
          <span className="ml-1 inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
        {finals.map((f) => (
          <FinalCell
            key={f.id}
            final={f}
            busy={busy}
            onRetry={onRetry}
            onRegenerate={onRegenerate}
            onEnlarge={() => setEnlarged(f)}
          />
        ))}
        {finals.length === 0 && <p className="text-sm text-zinc-600">No finals yet.</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CardAction tone="cyan" onClick={downloadAll} disabled={successes.length === 0}>
          ⤓ Download all (.zip)
        </CardAction>
        {allOk && project.stage !== "complete" && (
          <CardAction tone="emerald" onClick={onSaveFinish} disabled={busy}>
            ✓ Save &amp; finish
          </CardAction>
        )}
      </div>

      {enlarged && enlarged.imageUrl && (
        <Lightbox
          src={enlarged.imageUrl}
          caption={enlarged.name}
          downloadName={enlarged.name}
          onClose={() => setEnlarged(null)}
        />
      )}
    </ArtifactCard>
  );
}

function FinalCell({
  final,
  busy,
  onRetry,
  onRegenerate,
  onEnlarge,
}: {
  final: FableFinalIcon;
  busy: boolean;
  onRetry: (iconId: string) => void;
  onRegenerate: (iconId: string) => void;
  onEnlarge: () => void;
}) {
  const pending = final.status === "pending" || final.status === "generating";
  const displaySrc = useObjectUrl(final.status === "success" ? final.imageUrl : null);
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-800 bg-zinc-950 p-2">
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg"
        style={{ background: CHECKER }}
      >
        {final.status === "success" && displaySrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displaySrc}
            alt={final.name}
            className="h-full w-full cursor-zoom-in object-contain"
            title="Click to enlarge"
            onClick={onEnlarge}
          />
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
    </div>
  );
}
