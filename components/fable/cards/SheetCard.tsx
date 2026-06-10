"use client";

// Fable Bench — preview-sheet artifact card (inline in the chat feed).
//
// Renders ONE sheet large. Hover/click are handled on the <img> ITSELF (cell
// computed from mouse coords + grid dims) so the native image context menu —
// right-click, open-image-in-new-tab — still works; the highlight + "icon_004 —
// Settings" label live in a pointer-events-none overlay. Clicking a cell opens
// a per-icon popover (Regenerate / Refine…) that calls the STRUCTURED op path
// directly (no agent round-trip). Card actions: generate finals, try another
// sheet, regenerate sheet. Superseded sheets render dimmed via `dimmed`.

import { useState } from "react";
import type { FableOp, FableProject, IconCandidate, PreviewSheet } from "@/lib/fable/types";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import { ArtifactCard, CardAction, Lightbox, Pill } from "../ui";
import BackdropPicker, { backdropCss } from "./BackdropPicker";

export default function SheetCard({
  sheet,
  project,
  busy,
  dimmed = false,
  onGenerateFinals,
  onRegenerateSheet,
  onTryAnotherSheet,
  onIconOp,
  onSetViewBackground,
}: {
  sheet: PreviewSheet;
  project: FableProject;
  busy: boolean;
  dimmed?: boolean;
  onGenerateFinals: () => void;
  onRegenerateSheet: (sheetId: string, instruction: string) => void;
  onTryAnotherSheet: (instruction: string) => void;
  /** Structured mechanical op — executed directly, no agent round-trip. */
  onIconOp: (ops: FableOp[], description: string) => void;
  /** B14: persist the display-only backdrop choice on the project. */
  onSetViewBackground: (bg: string) => void;
}) {
  const [hoverCell, setHoverCell] = useState<number | null>(null);
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [refine, setRefine] = useState("");
  const [instruction, setInstruction] = useState("");
  const [lightbox, setLightbox] = useState(false);

  const displaySrc = useObjectUrl(sheet.imageUrl);
  const { rows, cols } = sheet.grid;

  // Map a mouse event on the <img> to a populated cell index (or null).
  const cellFromEvent = (e: React.MouseEvent<HTMLImageElement>): number | null => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const col = Math.min(cols - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * cols)));
    const row = Math.min(rows - 1, Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * rows)));
    const i = row * cols + col;
    return sheet.iconIds[i] ? i : null;
  };

  // Open/close a cell popover; the refine input is cleared on every open so
  // text never leaks from one cell (or sheet) to another. B11: dialogue is
  // available on draft AND approved sheets; superseded sheets are history —
  // their single action is "Branch from this version" below.
  const toggleCell = (i: number | null) => {
    if (sheet.status === "superseded") return;
    setOpenCell((prev) => (i === null || prev === i ? null : i));
    setRefine("");
  };

  const candById = (id: string): IconCandidate | undefined =>
    project.candidates.find((c) => c.id === id);

  const cellLabel = (i: number): string => {
    const iconId = sheet.iconIds[i];
    const cand = iconId ? candById(iconId) : undefined;
    return cand ? `${iconId} — ${cand.name}` : (iconId ?? "");
  };

  const statusTone =
    sheet.status === "approved" ? "emerald" : sheet.status === "superseded" ? "zinc" : "amber";

  const openIconId = openCell !== null ? sheet.iconIds[openCell] : null;
  const openCand = openIconId ? candById(openIconId) : undefined;

  return (
    <ArtifactCard
      dimmed={dimmed}
      title={`Preview sheet ${sheet.index}`}
      badge={
        <>
          <Pill tone={statusTone}>{sheet.status}</Pill>
          <span className="text-[10px] text-zinc-500">
            {rows}×{cols}
          </span>
        </>
      }
    >
      <div className="relative inline-block w-full">
        {/* The image OWNS the pointer — right-click / open-in-new-tab work.
            B14: the wrapper's CSS background shows through transparent sheets
            (checkerboard by default, recolorable via the picker below). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displaySrc}
          alt={`sheet ${sheet.index}`}
          className="w-full cursor-pointer rounded-xl ring-1 ring-zinc-800"
          style={{ background: backdropCss(project.viewBackground) }}
          onMouseMove={(e) => setHoverCell(cellFromEvent(e))}
          onMouseLeave={() => setHoverCell(null)}
          onClick={(e) => toggleCell(cellFromEvent(e))}
        />

        {/* Hover highlight + identify label — pointer-events-none overlay. */}
        {hoverCell !== null && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute rounded border border-cyan-500/60 bg-cyan-500/10"
              style={{
                left: `${((hoverCell % cols) / cols) * 100}%`,
                top: `${(Math.floor(hoverCell / cols) / rows) * 100}%`,
                width: `${100 / cols}%`,
                height: `${100 / rows}%`,
              }}
            >
              <span className="absolute left-1 top-1 rounded bg-zinc-950/80 px-1 text-[9px] font-mono text-cyan-300">
                {cellLabel(hoverCell)}
              </span>
            </div>
          </div>
        )}

        {/* Enlarge affordance — visible button over the image corner. */}
        <button
          onClick={() => setLightbox(true)}
          className="absolute right-2 top-2 rounded-lg bg-zinc-950/70 px-2 py-1 text-[11px] text-zinc-300 ring-1 ring-zinc-700/70 backdrop-blur-sm transition-colors hover:text-cyan-200"
          title="Enlarge"
          aria-label="Enlarge sheet"
        >
          ⤢ Enlarge
        </button>

        {/* Per-icon popover, anchored under the opened cell (interactive). */}
        {openCell !== null && openIconId && (
          <div
            className="absolute z-20 mt-1 w-56 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left shadow-xl"
            style={{
              left: `${(((openCell % cols) + 0.5) / cols) * 100}%`,
              top: `${((Math.floor(openCell / cols) + 1) / rows) * 100}%`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-medium text-zinc-100">{openCand?.name ?? openIconId}</p>
            <p className="font-mono text-[10px] text-zinc-500">{openIconId}</p>
            <button
              onClick={() => {
                onIconOp(
                  [{ op: "regenerate_icon", iconId: openIconId, name: null, instruction: null }],
                  `Regenerate the ${openCand?.name ?? openIconId} icon (${openIconId}).`,
                );
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
                  onIconOp(
                    [
                      {
                        op: "regenerate_icon",
                        iconId: openIconId,
                        name: null,
                        instruction: refine.trim(),
                      },
                    ],
                    `Refine ${openIconId} (${openCand?.name ?? ""}): ${refine.trim()}`,
                  );
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
              // Enter only fires with real text — bare Enter must never spend.
              if (e.key === "Enter" && instruction.trim() && !busy) {
                onRegenerateSheet(sheet.id, instruction.trim());
                setInstruction("");
              }
            }}
            placeholder="instruction… e.g. warmer palette, thicker strokes (↵ regenerates this sheet)"
            disabled={busy}
            className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
          />
        </div>
      )}

      {/* B11: approved sheets stay conversational — an instruction renders a
          NEW draft variant over the same icons; the approved sheet itself is
          never mutated or superseded. */}
      {sheet.status === "approved" && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && instruction.trim() && !busy) {
                onTryAnotherSheet(instruction.trim());
                setInstruction("");
              }
            }}
            placeholder="instruction… (↵ renders a NEW draft variant — this approved sheet stays)"
            disabled={busy}
            className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
          />
        </div>
      )}

      {/* B11: superseded sheets get exactly one action — branch a new draft
          from this version, using its prompt as the base instruction. */}
      {sheet.status === "superseded" && (
        <div className="mt-3">
          <CardAction
            tone="violet"
            onClick={() =>
              onTryAnotherSheet(
                `Branch from an earlier sheet version. Recreate that version's direction as the base, then keep it consistent. That version's full prompt was:\n${sheet.prompt}`,
              )
            }
            disabled={busy}
          >
            ⎇ Branch from this version
          </CardAction>
        </div>
      )}

      {/* B14: display-only backdrop behind transparent sheets — pure CSS. */}
      <div className="mt-3">
        <BackdropPicker value={project.viewBackground} onChange={onSetViewBackground} />
      </div>

      {lightbox && (
        <Lightbox
          src={sheet.imageUrl}
          caption={`Preview sheet ${sheet.index}`}
          downloadName={`sheet-${sheet.index}`}
          onClose={() => setLightbox(false)}
        />
      )}
    </ArtifactCard>
  );
}
