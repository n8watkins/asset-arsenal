"use client";

// Fable Bench — source artifact card (inline in the chat feed).
//
// Honest about what it shows: a Before/After compare renders ONLY when a real
// kind === "improved" version exists. Adopted mid-project images (pushed into
// project.improved with kind "original") are sources, not improvements — they
// appear in the version strip as "source v2" etc. and render as a single image
// with no compare chrome.
//
// The compare is a SIDE-BY-SIDE two-up grid (original | improved), stacking
// vertically on narrow widths; both panes open the Lightbox. Inline actions:
// Approve / Regenerate / tweak input, plus the collapsible critique.

import { useState } from "react";
import {
  approvedSource,
  type FableProject,
  type FableSourceImage,
} from "@/lib/fable/types";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import { ArtifactCard, CardAction, Lightbox, Pill } from "../ui";

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
  // Every source version in order: the original, then everything appended to
  // project.improved (real improvements AND adopted mid-project sources).
  const versions: FableSourceImage[] = [
    ...(original ? [original] : []),
    ...project.improved,
  ];
  const latest = versions[versions.length - 1] ?? null;
  const approved = approvedSource(project);
  const hasRealImproved = project.improved.some((s) => s.kind === "improved");

  const [showCritique, setShowCritique] = useState(false);
  const [tweak, setTweak] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  // Which version is currently shown (defaults to the latest).
  const [shownId, setShownId] = useState<string | null>(null);
  const shown = versions.find((s) => s.id === shownId) ?? latest;

  // Version strip labels: sources count separately from improvements, so an
  // adopted original reads "source v2" — never masquerading as an improvement.
  const labels = new Map<string, string>();
  {
    let srcN = 0;
    let impN = 0;
    for (const v of versions) {
      if (v.kind === "improved") labels.set(v.id, `improved v${++impN}`);
      else labels.set(v.id, `source v${++srcN}`);
    }
  }

  // Side-by-side only for a REAL improvement (and only when there's an
  // original to compare against).
  const comparing = !!shown && shown.kind === "improved" && !!original;

  return (
    <ArtifactCard
      title={hasRealImproved ? "Improved source" : "Source"}
      badge={
        approved && shown && approved.id === shown.id ? (
          <Pill tone="emerald">approved</Pill>
        ) : (
          <Pill tone="cyan">draft</Pill>
        )
      }
    >
      {comparing && original && shown ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ComparePane
            imageUrl={original.imageUrl}
            label="Original"
            onZoom={() => setLightbox({ src: original.imageUrl, caption: "Original source" })}
          />
          <ComparePane
            imageUrl={shown.imageUrl}
            label={`Improved${labels.get(shown.id) ? ` (${labels.get(shown.id)})` : ""}`}
            highlight
            onZoom={() => setLightbox({ src: shown.imageUrl, caption: "Improved source" })}
          />
        </div>
      ) : shown ? (
        <SinglePane
          imageUrl={shown.imageUrl}
          onZoom={() =>
            setLightbox({ src: shown.imageUrl, caption: labels.get(shown.id) ?? "Source" })
          }
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-zinc-950 text-sm text-zinc-600 ring-1 ring-zinc-800">
          No source yet.
        </div>
      )}

      {versions.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-zinc-600">versions</span>
          {versions.map((s) => (
            <VersionThumb
              key={s.id}
              imageUrl={s.imageUrl}
              label={labels.get(s.id) ?? "version"}
              selected={shown?.id === s.id}
              onSelect={() => setShownId(s.id)}
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
          src={lightbox.src}
          caption={lightbox.caption}
          downloadName="source"
          onClose={() => setLightbox(null)}
        />
      )}
    </ArtifactCard>
  );
}

/** One pane of the side-by-side compare: image + label underneath. */
function ComparePane({
  imageUrl,
  label,
  highlight = false,
  onZoom,
}: {
  imageUrl: string;
  label: string;
  highlight?: boolean;
  onZoom: () => void;
}) {
  // Multi-MB data URLs render via object URLs (right-click / open-in-tab work).
  const src = useObjectUrl(imageUrl);
  return (
    <div className="min-w-0">
      <div
        className={`overflow-hidden rounded-xl ring-1 ${
          highlight ? "ring-cyan-500/40" : "ring-zinc-800"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={label}
          onClick={onZoom}
          className="aspect-video w-full cursor-zoom-in bg-zinc-950 object-contain"
        />
      </div>
      <p
        className={`mt-1 text-center text-[11px] ${
          highlight ? "text-cyan-300" : "text-zinc-500"
        }`}
      >
        {label}
      </p>
    </div>
  );
}

/** The plain single-source view — no compare chrome. */
function SinglePane({ imageUrl, onZoom }: { imageUrl: string; onZoom: () => void }) {
  const src = useObjectUrl(imageUrl);
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="source"
        onClick={onZoom}
        className="aspect-video w-full cursor-zoom-in bg-zinc-950 object-contain"
      />
    </div>
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
