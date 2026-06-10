"use client";

// Fable Bench — preview_review canvas. Each sheet rendered large with a CSS grid
// overlay mapping cells → icon ids; clicking a cell opens a per-icon popover.

import { useState } from "react";
import type { FableProject, IconCandidate, PreviewSheet } from "@/lib/fable/types";
import { GhostButton, Pill, PrimaryButton } from "./ui";

export default function SheetViewer({
  project,
  busy,
  devMode,
  onGenerateFinals,
  onRegenerateSheet,
  onIconOp,
  onTryAnotherSheet,
}: {
  project: FableProject;
  busy: boolean;
  devMode: boolean;
  onGenerateFinals: () => void;
  onRegenerateSheet: (sheetId: string, instruction: string) => void;
  // Dispatches a revise_icons-style op for one cell through the chat/agent path.
  onIconOp: (text: string) => void;
  onTryAnotherSheet: (instruction: string) => void;
}) {
  const drafts = project.sheets.filter((s) => s.status === "draft");
  const superseded = project.sheets.filter((s) => s.status === "superseded");
  const [instruction, setInstruction] = useState("");
  const candById = (id: string): IconCandidate | undefined =>
    project.candidates.find((c) => c.id === id);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Preview sheets</h2>
        <p className="text-sm text-zinc-500">
          Hover a cell to see which icon it is. Click to refine just that one, or approve the lot.
        </p>
      </div>

      {drafts.map((sheet) => (
        <SheetCard
          key={sheet.id}
          sheet={sheet}
          candById={candById}
          devMode={devMode}
          busy={busy}
          onRegenerateSheet={onRegenerateSheet}
          onIconOp={onIconOp}
        />
      ))}

      {drafts.length === 0 && (
        <p className="text-sm text-zinc-600">No draft sheets. Generate previews from the blueprint.</p>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap gap-2">
          <PrimaryButton onClick={onGenerateFinals} disabled={busy || drafts.length === 0}>
            Looks good — generate finals →
          </PrimaryButton>
          <GhostButton
            onClick={() => onTryAnotherSheet(instruction.trim() || "Try another variation.")}
            disabled={busy}
          >
            Try another sheet
          </GhostButton>
        </div>
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="instruction for the next sheet… e.g. warmer palette, thicker strokes"
          disabled={busy}
          className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
        />
      </div>

      {superseded.length > 0 && (
        <details className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <summary className="cursor-pointer text-xs text-zinc-500">
            History · {superseded.length} superseded sheet{superseded.length === 1 ? "" : "s"}
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {superseded.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={s.id}
                src={s.imageUrl}
                alt={`sheet ${s.index}`}
                className="h-24 w-24 rounded-lg object-cover opacity-50 ring-1 ring-zinc-800"
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function SheetCard({
  sheet,
  candById,
  devMode,
  busy,
  onRegenerateSheet,
  onIconOp,
}: {
  sheet: PreviewSheet;
  candById: (id: string) => IconCandidate | undefined;
  devMode: boolean;
  busy: boolean;
  onRegenerateSheet: (sheetId: string, instruction: string) => void;
  onIconOp: (text: string) => void;
}) {
  const [openCell, setOpenCell] = useState<number | null>(null);
  const [refine, setRefine] = useState("");
  const [regen, setRegen] = useState("");

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium text-zinc-200">Sheet {sheet.index}</span>
        <Pill tone="amber">draft</Pill>
        <span className="text-[10px] text-zinc-500">
          {sheet.grid.rows}×{sheet.grid.cols}
        </span>
      </div>

      <div className="relative inline-block w-full max-w-xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sheet.imageUrl} alt={`sheet ${sheet.index}`} className="w-full rounded-lg ring-1 ring-zinc-800" />
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
            return (
              <button
                key={i}
                onClick={() => setOpenCell(openCell === i ? null : i)}
                className="group relative border border-transparent transition-colors hover:border-cyan-500/60 hover:bg-cyan-500/10"
                title={cand?.name ?? iconId}
              >
                <span className="pointer-events-none absolute left-1 top-1 rounded bg-zinc-950/80 px-1 text-[9px] font-mono text-cyan-300 opacity-0 transition-opacity group-hover:opacity-100">
                  {iconId}
                </span>
                {openCell === i && (
                  <div
                    className="absolute left-1/2 top-full z-20 mt-1 w-56 -translate-x-1/2 rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-left shadow-xl"
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
              </button>
            );
          })}
        </div>
      </div>

      {devMode && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-zinc-600">sheet prompt</summary>
          <p className="mt-1 whitespace-pre-wrap text-zinc-500">{sheet.prompt}</p>
        </details>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={regen}
          onChange={(e) => setRegen(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) {
              onRegenerateSheet(sheet.id, regen.trim() || "Regenerate this sheet.");
              setRegen("");
            }
          }}
          placeholder="regenerate whole sheet with…"
          disabled={busy}
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
        />
        <GhostButton
          className="px-3 py-1.5 text-xs"
          onClick={() => {
            onRegenerateSheet(sheet.id, regen.trim() || "Regenerate this sheet.");
            setRegen("");
          }}
          disabled={busy}
        >
          Regenerate sheet
        </GhostButton>
      </div>
    </div>
  );
}
