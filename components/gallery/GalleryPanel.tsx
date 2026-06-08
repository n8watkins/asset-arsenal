"use client";

import { useState } from "react";
import { useLibrary } from "@/lib/icon/use-library";
import type { LibrarySource, LibraryIcon } from "@/lib/icon/use-library";
import { setSourceDrag } from "@/components/gallery/drag";
import { getIconAsDataUrl } from "@/lib/storage/repo";

export interface GalleryPanelProps {
  onUseSource: (sourceId: string) => void;
}

type Tab = "sources" | "icons";

// ---- Utility helpers ----

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function slugify(name: string): string {
  return name.replace(/\s+/g, "_").toLowerCase();
}

// ---- Trash icon ----

function TrashIcon() {
  return (
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
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

// ---- Download icon ----

function DownloadIcon() {
  return (
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
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  );
}

// ---- Source card ----

function SourceCard({
  source,
  onUseSource,
  onRemove,
}: {
  source: LibrarySource;
  onUseSource: (id: string) => void;
  onRemove: (id: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);

  function handleDragStart(e: React.DragEvent) {
    setSourceDrag(e, source.id);
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await onRemove(source.id);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col group">
      {/* Thumbnail */}
      <div
        className="bg-zinc-950 aspect-square relative overflow-hidden cursor-grab active:cursor-grabbing"
        draggable
        onDragStart={handleDragStart}
      >
        <img
          src={source.objectUrl}
          alt={source.fileName ?? "Source image"}
          className="w-full h-full object-contain p-2"
          draggable={false}
        />
        {/* Drag hint overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-start p-1.5 pointer-events-none">
          <span className="text-white/0 group-hover:text-white/70 text-xs bg-black/50 px-1.5 py-0.5 rounded transition-all">
            drag to re-run
          </span>
        </div>
      </div>

      {/* Meta + actions */}
      <div className="p-2.5 flex flex-col gap-1.5">
        <p
          className="text-zinc-200 text-xs font-medium truncate"
          title={source.fileName}
        >
          {source.fileName ?? "Untitled"}
        </p>
        {(source.width != null || source.height != null) && (
          <p className="text-zinc-500 text-xs">
            {source.width}×{source.height}
          </p>
        )}
        <p className="text-zinc-600 text-xs">{formatDate(source.uploadedAt)}</p>

        <div className="flex gap-1.5 mt-0.5">
          <button
            onClick={() => onUseSource(source.id)}
            className="flex-1 text-xs bg-violet-600 hover:bg-violet-500 text-white font-medium px-2 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            Use
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            aria-label="Delete source"
            className="text-zinc-400 hover:text-red-400 disabled:opacity-40 border border-zinc-700 hover:border-red-400/40 p-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Icon card ----

function LibraryIconCard({
  icon,
  onRemove,
}: {
  icon: LibraryIcon;
  onRemove: (id: string) => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function handleDragStart(e: React.DragEvent) {
    const fileName = `${slugify(icon.iconName)}.png`;
    // Best-effort OS drag-out (Chrome supports "DownloadURL")
    e.dataTransfer.setData(
      "DownloadURL",
      `image/png:${fileName}:${icon.objectUrl}`
    );
    e.dataTransfer.effectAllowed = "copy";
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      // Prefer a fresh data URL for maximum compatibility across browsers
      const dataUrl = await getIconAsDataUrl(icon.id);
      const src = dataUrl ?? icon.objectUrl;
      const a = document.createElement("a");
      a.href = src;
      a.download = `${slugify(icon.iconName)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setDownloading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      await onRemove(icon.id);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col group">
      {/* Icon image on checkered background */}
      <div
        className="aspect-square relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{
          backgroundImage:
            "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%)",
          backgroundSize: "16px 16px",
        }}
        draggable
        onDragStart={handleDragStart}
      >
        <img
          src={icon.objectUrl}
          alt={icon.iconName}
          className="w-full h-full object-contain p-3"
          draggable={false}
        />
      </div>

      {/* Meta + actions */}
      <div className="p-2.5 flex flex-col gap-1.5">
        <p
          className="text-zinc-200 text-xs font-medium truncate"
          title={icon.iconName}
        >
          {icon.iconName}
        </p>
        <p className="text-zinc-600 text-xs">{formatDate(icon.createdAt)}</p>

        <div className="flex gap-1.5 mt-0.5">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-1 text-xs border border-zinc-700 hover:border-emerald-500/60 text-emerald-400 disabled:opacity-40 px-2 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <DownloadIcon />
            {downloading ? "…" : "Save"}
          </button>
          <button
            onClick={handleRemove}
            disabled={removing}
            aria-label="Delete icon"
            className="text-zinc-400 hover:text-red-400 disabled:opacity-40 border border-zinc-700 hover:border-red-400/40 p-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <TrashIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Empty state ----

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-zinc-600">
      <svg
        className="w-10 h-10"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
        />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ---- Main panel ----

export default function GalleryPanel({ onUseSource }: GalleryPanelProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("sources");
  const { sources, icons, loading, removeSource, removeIcon, clear } =
    useLibrary();

  async function handleClear() {
    if (
      !window.confirm(
        "Clear all stored sources and generated icons? This cannot be undone."
      )
    )
      return;
    await clear();
  }

  const isEmpty = sources.length === 0 && icons.length === 0;

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
        {!loading && (sources.length > 0 || icons.length > 0) && (
          <span className="bg-violet-600 text-white text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none">
            {sources.length + icons.length}
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
                  Clear all
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

          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 shrink-0 px-5 pt-3 gap-4">
            {(["sources", "icons"] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-xs font-medium capitalize transition-colors border-b-2 focus:outline-none ${
                  activeTab === tab
                    ? "border-violet-500 text-violet-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {tab === "sources"
                  ? `Sources (${sources.length})`
                  : `Icons (${icons.length})`}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-zinc-600 text-sm">
                Loading library…
              </div>
            ) : activeTab === "sources" ? (
              <>
                {sources.length === 0 ? (
                  <EmptyState message="No sources saved yet" />
                ) : (
                  <>
                    <p className="text-zinc-600 text-xs mb-3">
                      Drag a source onto the upload area to re-run it.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {sources.map((source) => (
                        <SourceCard
                          key={source.id}
                          source={source}
                          onUseSource={(id) => {
                            onUseSource(id);
                            setOpen(false);
                          }}
                          onRemove={removeSource}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {icons.length === 0 ? (
                  <EmptyState message="No icons generated yet" />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {icons.map((icon) => (
                      <LibraryIconCard
                        key={icon.id}
                        icon={icon}
                        onRemove={removeIcon}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
