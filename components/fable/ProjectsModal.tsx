"use client";

// Fable Bench — Projects panel. Lists saved projects (newest first), open/delete.

import { useEffect, useState } from "react";
import { totalCostUSD } from "@/lib/fable/pricing";
import {
  deleteProject as deleteFromStore,
  listProjects,
  loadProject,
  type FableProjectSummary,
} from "@/lib/fable/store";
import type { FableProject } from "@/lib/fable/types";
import { fmtRelative, fmtUsd, Pill, STAGE_LABELS } from "./ui";

export default function ProjectsModal({
  open,
  currentId,
  onClose,
  onOpen,
}: {
  open: boolean;
  currentId: string;
  onClose: () => void;
  onOpen: (p: FableProject) => void;
}) {
  const [items, setItems] = useState<FableProjectSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listProjects()
      .then(setItems)
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  async function handleOpen(id: string) {
    const p = await loadProject(id);
    if (p) onOpen(p);
  }

  async function handleDelete(id: string) {
    await deleteFromStore(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-100">Projects</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 overflow-auto p-4 sm:grid-cols-2">
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-zinc-500">No saved projects yet.</p>
          )}
          {items.map((p) => (
            <div
              key={p.id}
              className={`group flex gap-3 rounded-xl border bg-zinc-900/40 p-2 ${
                p.id === currentId ? "border-cyan-500/40" : "border-zinc-800"
              }`}
            >
              <button onClick={() => handleOpen(p.id)} className="flex min-w-0 flex-1 gap-3 text-left">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                  {p.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbUrl} alt={p.name} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-100">{p.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Pill tone="cyan">{STAGE_LABELS[p.stage]}</Pill>
                    <span className="text-[10px] text-zinc-500">{fmtRelative(p.updatedAt)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-zinc-600">
                    {p.counts.candidates} icons · {p.counts.finals} finals
                  </p>
                </div>
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="self-start text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                aria-label={`Delete ${p.name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Re-exported so the page can show a cost without recomputing.
export { totalCostUSD, fmtUsd };
