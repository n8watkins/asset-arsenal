"use client";

// Fable Bench — improved-source artifact card (inline in the chat feed).
//
// Renders the latest improved source with a before/after compare (tabbed), a
// collapsible critique, and inline actions: Approve / Regenerate / tweak input.
// Older versions collapse into a thumbnail strip. Reflects live project state.

import { useState } from "react";
import { approvedSource, type FableProject } from "@/lib/fable/types";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import { ArtifactCard, CardAction, Lightbox, Pill } from "../ui";

type Tab = "before" | "after";

export default function SourceCard({
  project,
  busy,
  onApprove,
  onRegenerate,
}: {
  project: FableProject;
  busy: boolean;
  onApprove: () => void;
  onRegenerate: (instruction: string) => void;
}) {
  const original = project.original;
  const improved = project.improved;
  const latest = improved[improved.length - 1] ?? null;
  const approved = approvedSource(project);

  const [tab, setTab] = useState<Tab>(latest ? "after" : "before");
  const [showCritique, setShowCritique] = useState(false);
  const [tweak, setTweak] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Which improved version is currently shown in the "after" pane.
  const [shownId, setShownId] = useState<string | null>(null);
  const shown = improved.find((s) => s.id === shownId) ?? latest;

  const past = improved.slice(0, -1); // older improved versions

  const shownImage = tab === "before" ? original?.imageUrl : shown?.imageUrl;
  // Multi-MB data URLs render via object URLs (right-click / open-in-tab work).
  const shownSrc = useObjectUrl(shownImage);

  return (
    <ArtifactCard
      title="Improved source"
      badge={
        approved && shown && approved.id === shown.id ? (
          <Pill tone="emerald">approved</Pill>
        ) : (
          <Pill tone="cyan">draft</Pill>
        )
      }
    >
      {/* Before / After tabs */}
      <div className="mb-2 inline-flex rounded-lg border border-zinc-800 bg-zinc-950/50 p-0.5 text-xs">
        <button
          onClick={() => setTab("before")}
          disabled={!original}
          className={`rounded-md px-2.5 py-1 ${
            tab === "before" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500"
          } disabled:opacity-30`}
        >
          Before
        </button>
        <button
          onClick={() => setTab("after")}
          disabled={!latest}
          className={`rounded-md px-2.5 py-1 ${
            tab === "after" ? "bg-cyan-500/20 text-cyan-200" : "text-zinc-500"
          } disabled:opacity-30`}
        >
          After
        </button>
      </div>

      <div className="overflow-hidden rounded-xl ring-1 ring-zinc-800">
        {shownImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shownSrc}
            alt={tab}
            onClick={() => setLightbox(shownImage)}
            className="aspect-video w-full cursor-zoom-in bg-zinc-950 object-contain"
          />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center bg-zinc-950 text-sm text-zinc-600">
            No improved version yet.
          </div>
        )}
      </div>

      {past.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-zinc-600">versions</span>
          {improved.map((s, i) => (
            <VersionThumb
              key={s.id}
              imageUrl={s.imageUrl}
              label={`v${i + 1}`}
              selected={shown?.id === s.id}
              onSelect={() => {
                setShownId(s.id);
                setTab("after");
              }}
            />
          ))}
        </div>
      )}

      {shown?.critique && (
        <div className="mt-3">
          <button
            onClick={() => setShowCritique((v) => !v)}
            className="text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
          >
            {showCritique ? "▾" : "▸"} What changed
          </button>
          {showCritique && <p className="mt-1 text-sm text-zinc-300">{shown.critique}</p>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CardAction tone="emerald" onClick={onApprove} disabled={busy || !approved}>
          ✓ Approve
        </CardAction>
        <CardAction
          tone="violet"
          onClick={() => onRegenerate("Regenerate with a fresh take.")}
          disabled={busy || !latest}
        >
          ↻ Regenerate
        </CardAction>
        <input
          value={tweak}
          onChange={(e) => setTweak(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tweak.trim() && !busy) {
              onRegenerate(tweak.trim());
              setTweak("");
            }
          }}
          placeholder="tweak… e.g. darker, more glassy"
          disabled={busy}
          className="min-w-[180px] flex-1 rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
        />
      </div>

      {lightbox && (
        <Lightbox
          src={lightbox}
          caption={tab === "before" ? "Original source" : "Improved source"}
          downloadName="source"
          onClose={() => setLightbox(null)}
        />
      )}
    </ArtifactCard>
  );
}

function VersionThumb({
  imageUrl,
  label,
  selected,
  onSelect,
}: {
  imageUrl: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const src = useObjectUrl(imageUrl);
  return (
    <button
      onClick={onSelect}
      className={`overflow-hidden rounded-md border ${
        selected ? "border-cyan-500/60" : "border-zinc-800 opacity-60"
      }`}
      title={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="h-9 w-9 object-cover" />
    </button>
  );
}
