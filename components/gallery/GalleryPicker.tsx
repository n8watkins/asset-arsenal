"use client";

import { useState } from "react";
import Link from "next/link";
import { useLibrary } from "@/lib/icon/use-library";
import { getSourceAsDataUrl, getIconAsDataUrl } from "@/lib/storage/repo";

export interface PickedImage {
  id: string;
  dataUrl: string;
  fileName: string;
  kind: "source" | "icon";
}

export interface GalleryPickerProps {
  /** Called with the chosen image (data URL resolved) when the user picks one. */
  onPick: (img: PickedImage) => void;
  label?: string;
  className?: string;
}

// A deliberate "choose ONE image from the gallery" picker. The gallery itself
// stays a standalone library; this just references a single image from it.
//
// The library (blobs + object URLs) is only loaded while the dialog is open:
// PickerDialog is the sole useLibrary consumer and is mounted on open /
// unmounted on close, so each open refetches fresh data and unmount runs the
// hook's object-URL revocation cleanup.
export default function GalleryPicker({
  onPick,
  label = "Choose from gallery",
  className,
}: GalleryPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        }
      >
        {label}
      </button>

      {open && <PickerDialog onPick={onPick} onClose={() => setOpen(false)} />}
    </>
  );
}

function PickerDialog({
  onPick,
  onClose,
}: {
  onPick: (img: PickedImage) => void;
  onClose: () => void;
}) {
  const { sources, icons, loading } = useLibrary();
  const [resolving, setResolving] = useState<string | null>(null);

  async function choose(
    id: string,
    kind: "source" | "icon",
    fileName: string,
  ) {
    setResolving(id);
    const dataUrl =
      kind === "source"
        ? await getSourceAsDataUrl(id)
        : await getIconAsDataUrl(id);
    setResolving(null);
    if (dataUrl) {
      onPick({ id, dataUrl, fileName, kind });
      onClose();
    }
  }

  const empty = sources.length === 0 && icons.length === 0;

  // Group consistently with GalleryView: collection images live in the sources
  // store but are AI-generated, so they list with the icons, not the uploads.
  const uploadedSources = sources.filter((s) => s.category !== "icon-collection");
  const collectionSources = sources.filter((s) => s.category === "icon-collection");

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">
            Choose an image from the gallery
          </h3>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            close ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {loading && <p className="text-sm text-zinc-500">Loading…</p>}

          {!loading && empty && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <p className="text-sm text-zinc-400">
                Your gallery is empty.
              </p>
              <Link
                href="/gallery"
                className="text-xs text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
              >
                Open the gallery to upload images ↗
              </Link>
            </div>
          )}

          {!loading && !empty && (
            <div className="flex flex-col gap-5">
              <PickerGroup
                label="Uploaded"
                dotClass="bg-cyan-400"
                items={uploadedSources.map((s) => ({
                  id: s.id,
                  objectUrl: s.objectUrl,
                  name: s.fileName ?? "image",
                  kind: "source" as const,
                }))}
                resolving={resolving}
                onChoose={choose}
              />
              <PickerGroup
                label="AI-generated"
                dotClass="bg-violet-400"
                items={[
                  ...collectionSources.map((s) => ({
                    id: s.id,
                    objectUrl: s.objectUrl,
                    name: s.fileName ?? "Collection image",
                    kind: "source" as const,
                  })),
                  ...icons.map((ic) => ({
                    id: ic.id,
                    objectUrl: ic.objectUrl,
                    name: ic.iconName,
                    kind: "icon" as const,
                  })),
                ]}
                resolving={resolving}
                onChoose={choose}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PickerGroup({
  label,
  dotClass,
  items,
  resolving,
  onChoose,
}: {
  label: string;
  dotClass: string;
  items: { id: string; objectUrl: string; name: string; kind: "source" | "icon" }[];
  resolving: string | null;
  onChoose: (id: string, kind: "source" | "icon", name: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
          {label}
        </span>
        <span className="text-xs text-zinc-600">({items.length})</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-600">None yet.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {items.map((it) => (
            <button
              key={`${it.kind}-${it.id}`}
              type="button"
              disabled={resolving !== null}
              onClick={() => onChoose(it.id, it.kind, it.name)}
              className="group relative flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-left transition-colors hover:border-cyan-500/60 disabled:opacity-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.objectUrl}
                alt={it.name}
                className="aspect-square w-full rounded-lg object-contain"
              />
              <span className="truncate text-[11px] text-zinc-400">
                {resolving === it.id ? "Loading…" : it.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
