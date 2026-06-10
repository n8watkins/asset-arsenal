"use client";

// Fable Bench — collapsible left sidebar (ChatGPT-style).
// "New project" + the saved-project history list (thumb / name / stage chip /
// relative time). Click opens; hover ✕ deletes. Replaces the old ProjectsModal.

import { useEffect, useState } from "react";
import {
  deleteProject as deleteFromStore,
  listProjects,
  loadProject,
  type FableProjectSummary,
} from "@/lib/fable/store";
import type { FableProject } from "@/lib/fable/types";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import { fmtRelative, Pill, STAGE_LABELS } from "./ui";

/** History-row thumbnail. thumbUrl is a stored-image ref for migrated
 *  projects or a data URL for legacy ones (listProjects doesn't migrate) —
 *  useObjectUrl tolerates both shapes. */
function Thumb({ url }: { url: string }) {
  const src = useObjectUrl(url);
  if (!src) return null; // ref still resolving (or missing) — keep the slab
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}

export default function Sidebar({
  open,
  currentId,
  // The current project's updatedAt — changes on EVERY mutation (renames,
  // artifact updates, …), so the list refreshes.
  refreshKey,
  onClose,
  onNew,
  onOpen,
}: {
  open: boolean;
  currentId: string;
  refreshKey: string | number;
  onClose: () => void;
  onNew: () => void;
  onOpen: (p: FableProject) => void;
}) {
  const [items, setItems] = useState<FableProjectSummary[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    listProjects().then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, [open, refreshKey, currentId]);

  async function handleOpen(id: string) {
    if (id === currentId) {
      onClose();
      return;
    }
    const p = await loadProject(id);
    if (p) onOpen(p);
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteFromStore(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <>
      {/* Mobile scrim */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`z-40 flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200 ${
          open ? "w-72" : "w-0"
        } max-md:fixed max-md:inset-y-0 max-md:left-0 overflow-hidden`}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            <span className="text-cyan-400">◆</span> Fable
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Collapse sidebar"
            title="Collapse"
          >
            ⟨
          </button>
        </div>

        <div className="px-3">
          <button
            onClick={onNew}
            className="flex w-full items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:border-cyan-500/50 hover:text-cyan-200"
          >
            <span className="text-base leading-none">＋</span> New project
          </button>
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <p className="px-1 py-1.5 text-[10px] uppercase tracking-widest text-zinc-600">
            History
          </p>
          {items.length === 0 && (
            <p className="px-1 text-xs text-zinc-600">No saved projects yet.</p>
          )}
          <div className="flex flex-col gap-0.5">
            {items.map((p) => (
              <div
                key={p.id}
                onClick={() => handleOpen(p.id)}
                className={`group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 transition-colors ${
                  p.id === currentId ? "bg-zinc-800/70" : "hover:bg-zinc-900"
                }`}
              >
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md bg-zinc-800 ring-1 ring-zinc-800">
                  {p.thumbUrl && <Thumb url={p.thumbUrl} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-zinc-200">{p.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <Pill tone="cyan">{STAGE_LABELS[p.stage]}</Pill>
                    <span className="text-[10px] text-zinc-600">{fmtRelative(p.updatedAt)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, p.id)}
                  className="shrink-0 text-zinc-600 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                  aria-label={`Delete ${p.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}
