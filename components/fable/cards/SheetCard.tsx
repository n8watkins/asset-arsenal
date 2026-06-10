"use client";

// Fable Bench — preview-sheet artifact card (inline in the chat feed).
//
// Renders ONE sheet large with a CSS-grid overlay mapping cells → icon ids;
// hovering a cell shows its id, clicking opens a per-icon popover (Regenerate /
// Refine…). Card actions: generate finals, try another sheet, regenerate sheet.
// Superseded sheets render dimmed + collapsed via `dimmed`.

import { useState } from "react";
import type { FableProject, IconCandidate, PreviewSheet } from "@/lib/fable/types";
import { ArtifactCard, CardAction, Lightbox, Pill } from "../ui";

export default function SheetCard({
  sheet,
  project,
  busy,
  dimmed = false,
  onGenerateFinals,
  onRegenerateSheet,
  onTryAnotherSheet,
  onIconOp,
}: {
  sheet: PreviewSheet;
  project: FableProject;
  busy: boolean;
  dimmed?: boolean;
  onGenerateFinals: () => void;
  onRegenerateSheet: (sheetId: string, instruction: string) => void;
  onTryAnotherSheet: (instruction: string) => void;
  onIconOp: (text: string) => void;
}) {
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [refine, setRefine] = useState("");
  const [instruction, setInstruction] = useState("");
  const [lightbox, setLightbox] = useState(false);

  // Open/close a cell popover; the refine input is cleared on every open so
  // text never leaks from one cell (or sheet) to another.
  const toggleCell = (i: number) => {
    setOpenCell((prev) => (prev === i ? null : i));
    setRefine("");
  };

  const candById = (id: string): IconCandidate | undefined =>
    project.candidates.find((c) => c.id === id);

  const statusTone =
    sheet.status === "approved" ? "emerald" : sheet.status === "superseded" ? "zinc" : "amber";

  return (
    <ArtifactCard
      dimmed={dimmed}
      title={`Preview sheet ${sheet.index}`}
      badge={
        <>
          <Pill tone={statusTone}>{sheet.status}</Pill>
          <span className="text-[10px] text-zinc-500">
            {sheet.grid.rows}×{sheet.grid.cols}
          </span>
        </>
      }
    >
      <div className="relative inline-block w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sheet.imageUrl}
          alt={`sheet ${sheet.index}`}
          className="w-full rounded-xl ring-1 ring-zinc-800"
        />
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: `repeat(${sheet.grid.cols}, 1fr)`,
            gridTemplateRows: `repeat(${sheet.grid.rows}, 1fr)`,
          }}
        >
          {Array.from({ length: sheet.grid.rows * sheet.grid.cols }).map((_, i) => {
            const iconId = sheet.iconIds[i];
            if (!iconId) return <div key={i} />;
            const cand = candById(iconId);
            // NOT a <button>: the popover inside holds its own button + input,
            // and nesting interactive elements in a button breaks hydration and
            // swallows keys (space "clicks" the parent instead of typing).
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                onClick={() => toggleCell(i)}
                onKeyDown={(e) => {
                  // Only treat keys aimed at the CELL itself — never keystrokes
                  // bubbling up from the popover's input.
                  if (e.target !== e.currentTarget) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleCell(i);
                  }
                }}
                className="group relative cursor-pointer border border-transparent transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/10 focus:outline-none focus-visible:border-cyan-500/60"
                title={cand?.name ?? iconId}
              >
                <span className="pointer-events-none absolute left-1 top-1 rounded bg-zinc-950/80 px-1 text-[9px] font-mono text-cyan-300 opacity-0 transition-opacity group-hover:opacity-100">
                  {cand?.name ?? iconId}
                </span>
                {openCell === i && (
                  <div
                    className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 cursor-default rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs font-medium text-zinc-100">{cand?.name ?? iconId}</p>
                    <p className="font-mono text-[10px] text-zinc-500">{iconId}</p>
                    <button
                      onClick={() => {
                        onIconOp(`Regenerate the ${cand?.name ?? iconId} icon (${iconId}).`);
                        setOpenCell(null);
                      }}
                      disabled={busy}
                      className="mt-2 w-full rounded-lg bg-violet-500/15 px-2 py-1 text-xs text-violet-200 ring-1 ring-violet-500/40 hover:bg-violet-500/25 disabled:opacity-40"
                    >
                      Regenerate this icon
                    </button>
                    <input
                      value={refine}
                      onChange={(e) => setRefine(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter" && refine.trim() && !busy) {
                          onIconOp(`For ${iconId} (${cand?.name ?? ""}): ${refine.trim()}`);
                          setRefine("");
                          setOpenCell(null);
                        }
                      }}
                      placeholder="refine…"
                      className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={() => setLightbox(true)}
        className="mt-1 text-[10px] text-zinc-600 hover:text-zinc-400"
      >
        enlarge
      </button>

      {sheet.status === "draft" && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardAction tone="emerald" onClick={onGenerateFinals} disabled={busy}>
              ✓ Looks good — generate finals
            </CardAction>
            <CardAction
              tone="violet"
              onClick={() => onTryAnotherSheet(instruction.trim() || "Try another variation.")}
              disabled={busy}
            >
              ↻ Try another sheet
            </CardAction>
          </div>
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) {
                onRegenerateSheet(sheet.id, instruction.trim() || "Regenerate this sheet.");
                setInstruction("");
              }
            }}
            placeholder="instruction… e.g. warmer palette, thicker strokes (↵ regenerates this sheet)"
            disabled={busy}
            className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
          />
        </div>
      )}

      {lightbox && <Lightbox src={sheet.imageUrl} onClose={() => setLightbox(false)} />}
    </ArtifactCard>
  );
}
