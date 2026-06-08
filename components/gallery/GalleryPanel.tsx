"use client";

import { useState } from "react";
import { useLibrary } from "@/lib/icon/use-library";
import GalleryView from "@/components/gallery/GalleryView";

export interface GalleryPanelProps {
  onUseSource: (sourceId: string) => void;
}

// ---- Main panel ----

export default function GalleryPanel({ onUseSource }: GalleryPanelProps) {
  const [open, setOpen] = useState(false);
  // Panel owns its own library instance just for the count badge + Clear.
  // GalleryView (inside the drawer) has its own instance; after Clear we close
  // the drawer so reopening reflects the emptied library.
  const { sources, icons, loading, clear } = useLibrary();

  async function handleClear() {
    if (
      !window.confirm(
        "Clear all stored sources and generated icons? This cannot be undone."
      )
    )
      return;
    await clear();
    setOpen(false);
  }

  const count = sources.length + icons.length;
  const isEmpty = count === 0;

  return (
    <>
      {/* Toggle button — fixed bottom-left */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-50 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs font-mono px-3 py-2 rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 flex items-center gap-2"
        aria-label="Toggle library panel"
      >
        {/* Book-open icon */}
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
        Library
        {!loading && count > 0 && (
          <span className="bg-violet-600 text-white text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none">
            {count}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer panel — fixed left side */}
      {open && (
        <div className="fixed top-0 left-0 h-full w-full max-w-lg z-40 bg-zinc-950 border-r border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
            <div>
              <h3 className="text-zinc-100 font-semibold text-sm">Library</h3>
              <p className="text-zinc-500 text-xs mt-0.5">
                {loading
                  ? "Loading…"
                  : `${sources.length} source${sources.length !== 1 ? "s" : ""} · ${icons.length} icon${icons.length !== 1 ? "s" : ""}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {!isEmpty && (
                <button
                  onClick={handleClear}
                  className="text-xs text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-400/60 px-2.5 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  Clear library
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-zinc-400 hover:text-zinc-200 transition-colors p-1 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
                aria-label="Close library"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Scrollable content — the reusable gallery */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <GalleryView
              title="Library"
              onUseImage={(img) => {
                // The drawer only forwards source images into the pipeline via
                // the existing onUseSource contract (which expects a source id).
                if (img.kind === "source") {
                  onUseSource(img.id);
                  setOpen(false);
                }
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
