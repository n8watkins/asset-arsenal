"use client";

import { useMemo, useRef, useState } from "react";
import { useLibrary } from "@/lib/icon/use-library";
import { setSourceDrag } from "@/components/gallery/drag";
import { getSourceAsDataUrl, getIconAsDataUrl } from "@/lib/storage/repo";
import { downloadDataUrl, slugify } from "@/lib/icon/download";
import { IMAGE_UPLOAD_LIMITS } from "@/lib/icon/models";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GalleryImage {
  id: string;
  /** Drives behaviour (drag, data-url fetch, delete): a source vs an icon record. */
  kind: "source" | "icon";
  /**
   * Drives the badge: user-uploaded, AI-generated, or AI-elevated (a source
   * upgraded by Bench S — it groups with sources but is machine-made).
   */
  origin: "uploaded" | "ai" | "elevated";
  objectUrl: string;
  fileName: string;
  getDataUrl: () => Promise<string | undefined>;
}

export interface GalleryViewProps {
  /** Smaller tiles + scroll cap, for embedding (e.g. main page). */
  compact?: boolean;
  title?: string;
  /** When true, hides upload + delete — the gallery is only mutable at /gallery. */
  readOnly?: boolean;
  onUseImage?: (img: {
    id: string;
    dataUrl: string;
    fileName: string;
    kind: "source" | "icon";
  }) => void;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Download filename helpers
// ---------------------------------------------------------------------------

/** Split "shot.png" → { base: "shot", ext: "png" }; no extension → ext "". */
function splitExt(fileName: string): { base: string; ext: string } {
  const m = /^(.*)\.([a-z0-9]+)$/i.exec(fileName);
  return m ? { base: m[1], ext: m[2].toLowerCase() } : { base: fileName, ext: "" };
}

/** Best-effort extension from a data URL's mime type ("" if unknown). */
function extFromDataUrl(dataUrl: string): string {
  const m = /^data:image\/([a-z0-9.+-]+)/i.exec(dataUrl);
  if (!m) return "";
  const sub = m[1].toLowerCase();
  if (sub === "jpeg") return "jpg";
  if (sub === "svg+xml") return "svg";
  return sub;
}

// ---------------------------------------------------------------------------
// Tile
// ---------------------------------------------------------------------------

function OriginBadge({ origin }: { origin: GalleryImage["origin"] }) {
  const isUploaded = origin === "uploaded";
  const classes = isUploaded
    ? "bg-cyan-600/20 text-cyan-300 border-cyan-500/40"
    : "bg-violet-600/20 text-violet-300 border-violet-500/40";
  const label =
    origin === "uploaded"
      ? "Uploaded"
      : origin === "elevated"
        ? "AI-elevated"
        : "AI-generated";
  return (
    <span
      className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border ${classes}`}
    >
      {label}
    </span>
  );
}

function GalleryTile({
  image,
  compact,
  readOnly,
  onUseImage,
  onRemove,
}: {
  image: GalleryImage;
  compact: boolean;
  readOnly: boolean;
  onUseImage?: GalleryViewProps["onUseImage"];
  onRemove: (img: GalleryImage) => Promise<void>;
}) {
  const [busy, setBusy] = useState<"use" | "download" | "remove" | null>(null);

  function handleDragStart(e: React.DragEvent) {
    if (image.kind === "source") {
      setSourceDrag(e, image.id);
    } else {
      // Best-effort OS drag-out for generated icons.
      const fileName = `${slugify(image.fileName)}.png`;
      e.dataTransfer.setData(
        "DownloadURL",
        `image/png:${fileName}:${image.objectUrl}`
      );
      e.dataTransfer.effectAllowed = "copy";
    }
  }

  async function handleUse() {
    if (!onUseImage) return;
    setBusy("use");
    try {
      const dataUrl = await image.getDataUrl();
      if (dataUrl) {
        onUseImage({
          id: image.id,
          dataUrl,
          fileName: image.fileName,
          kind: image.kind,
        });
      }
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    setBusy("download");
    try {
      const dataUrl = (await image.getDataUrl()) ?? image.objectUrl;
      // Slugify the name without its extension, then re-attach a real
      // extension (original name first, then the blob's mime type).
      const { base: rawBase, ext: nameExt } = splitExt(image.fileName);
      const ext =
        image.kind === "icon" ? "png" : nameExt || extFromDataUrl(dataUrl);
      const base = slugify(rawBase) || "image";
      downloadDataUrl(dataUrl, ext ? `${base}.${ext}` : base);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    setBusy("remove");
    try {
      await onRemove(image);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col group">
      <div
        className="relative overflow-hidden cursor-grab active:cursor-grabbing aspect-square"
        style={
          image.kind === "icon"
            ? {
                backgroundImage:
                  "repeating-conic-gradient(#3f3f46 0% 25%, #27272a 0% 50%)",
                backgroundSize: "16px 16px",
              }
            : { backgroundColor: "#09090b" }
        }
        draggable
        onDragStart={handleDragStart}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.objectUrl}
          alt={image.fileName}
          className={`w-full h-full object-contain ${compact ? "p-1.5" : "p-2.5"}`}
          draggable={false}
        />
        <div className="absolute top-1.5 left-1.5">
          <OriginBadge origin={image.origin} />
        </div>
      </div>

      <div className={`flex flex-col gap-1.5 ${compact ? "p-2" : "p-2.5"}`}>
        <p
          className="text-zinc-200 text-xs font-medium truncate"
          title={image.fileName}
        >
          {image.fileName}
        </p>

        <div className="flex gap-1.5">
          {onUseImage && (
            <button
              onClick={handleUse}
              disabled={busy !== null}
              className="flex-1 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium px-2 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              {busy === "use" ? "…" : "Use"}
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={busy !== null}
            aria-label="Download image"
            className="text-emerald-400 hover:text-emerald-300 disabled:opacity-40 border border-zinc-700 hover:border-emerald-500/60 px-2 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500 text-xs"
          >
            {busy === "download" ? "…" : "↓"}
          </button>
          {!readOnly && (
            <button
              onClick={handleRemove}
              disabled={busy !== null}
              aria-label="Delete image"
              className="text-zinc-400 hover:text-red-400 disabled:opacity-40 border border-zinc-700 hover:border-red-400/40 p-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <TrashIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

function GalleryGroup({
  heading,
  accent,
  images,
  compact,
  readOnly,
  emptyMessage,
  onUseImage,
  onRemove,
}: {
  heading: string;
  accent: "uploaded" | "ai";
  images: GalleryImage[];
  compact: boolean;
  readOnly: boolean;
  emptyMessage: string;
  onUseImage?: GalleryViewProps["onUseImage"];
  onRemove: (img: GalleryImage) => Promise<void>;
}) {
  const accentDot = accent === "uploaded" ? "bg-cyan-400" : "bg-violet-400";

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${accentDot}`} />
        <h4 className="text-zinc-200 text-xs font-semibold uppercase tracking-wide">
          {heading}
        </h4>
        <span className="text-zinc-500 text-xs">({images.length})</span>
      </div>

      {images.length === 0 ? (
        <p className="text-zinc-600 text-xs py-3 px-1">{emptyMessage}</p>
      ) : (
        <div
          className={
            compact
              ? "grid grid-cols-3 sm:grid-cols-4 gap-2"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
          }
        >
          {images.map((image) => (
            <GalleryTile
              key={`${image.kind}-${image.id}`}
              image={image}
              compact={compact}
              readOnly={readOnly}
              onUseImage={onUseImage}
              onRemove={onRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function GalleryView({
  compact = false,
  title,
  readOnly = false,
  onUseImage,
}: GalleryViewProps) {
  const { sources, icons, loading, removeSource, removeIcon, addImages } =
    useLibrary();

  const [dragOver, setDragOver] = useState(false);
  // Project filter ("" = All projects → identical to the pre-filter gallery).
  // Options come from distinct projectName values on loaded records; legacy
  // records have none, so the dropdown only appears once a bench tags records.
  const [projectFilter, setProjectFilter] = useState("");
  const [uploadResult, setUploadResult] = useState<{
    added: number;
    errors: string[];
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  // In compact mode the dropzone is collapsed behind a button to save space.
  const [showUpload, setShowUpload] = useState(!compact && !readOnly);
  const inputRef = useRef<HTMLInputElement>(null);

  const projectNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of sources) if (s.projectName) names.add(s.projectName);
    for (const ic of icons) if (ic.projectName) names.add(ic.projectName);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [sources, icons]);

  // Filter in memory before grouping; "" (All projects) passes everything
  // through untouched, so unfiltered rendering is byte-identical to before.
  const visibleSources = useMemo(
    () =>
      projectFilter
        ? sources.filter((s) => s.projectName === projectFilter)
        : sources,
    [sources, projectFilter]
  );
  const visibleIcons = useMemo(
    () =>
      projectFilter
        ? icons.filter((ic) => ic.projectName === projectFilter)
        : icons,
    [icons, projectFilter]
  );

  // Uploaded sources vs. AI-generated collection images both live in the
  // "sources" store; the category tag separates them. Collection images are
  // AI-generated, so they render in the AI-generated group (kind stays "source"
  // so drag/use/delete still behave like a source).
  const uploadedImages = useMemo<GalleryImage[]>(
    () =>
      visibleSources
        .filter((s) => s.category !== "icon-collection")
        .map((s) => ({
          id: s.id,
          kind: "source" as const,
          // Bench S saves AI-elevated sources with category "elevated"; they
          // group with sources but are badged as machine-made.
          origin: s.category === "elevated" ? ("elevated" as const) : ("uploaded" as const),
          objectUrl: s.objectUrl,
          fileName: s.fileName ?? "Untitled",
          getDataUrl: () => getSourceAsDataUrl(s.id),
        })),
    [visibleSources]
  );

  const collectionImages = useMemo<GalleryImage[]>(
    () =>
      visibleSources
        .filter((s) => s.category === "icon-collection")
        .map((s) => ({
          id: s.id,
          kind: "source" as const,
          origin: "ai" as const,
          objectUrl: s.objectUrl,
          fileName: s.fileName ?? "Collection image",
          getDataUrl: () => getSourceAsDataUrl(s.id),
        })),
    [visibleSources]
  );

  const iconImages = useMemo<GalleryImage[]>(
    () =>
      visibleIcons.map((ic) => ({
        id: ic.id,
        kind: "icon" as const,
        origin: "ai" as const,
        objectUrl: ic.objectUrl,
        fileName: ic.iconName,
        getDataUrl: () => getIconAsDataUrl(ic.id),
      })),
    [visibleIcons]
  );

  // AI-generated group = collection images first, then individual icons.
  const aiImages = useMemo<GalleryImage[]>(
    () => [...collectionImages, ...iconImages],
    [collectionImages, iconImages]
  );

  async function handleAddFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      const res = await addImages(files);
      setUploadResult(res);
    } finally {
      setUploading(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      handleAddFiles(e.target.files);
    }
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleAddFiles(files);
  }

  async function handleRemove(img: GalleryImage) {
    if (img.kind === "source") await removeSource(img.id);
    else await removeIcon(img.id);
  }

  const accept = IMAGE_UPLOAD_LIMITS.allowedMimeTypes.join(",");

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {title && (
          <h3 className="text-zinc-100 font-semibold text-sm">{title}</h3>
        )}
        {projectNames.length > 0 && (
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            aria-label="Filter by project"
            className="text-xs bg-zinc-900 text-zinc-300 border border-zinc-700 hover:border-zinc-500 rounded-lg px-2 py-1 transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="">All projects</option>
            {projectNames.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        )}
        {compact && !showUpload && !readOnly && (
          <button
            onClick={() => setShowUpload(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 border border-zinc-700 hover:border-zinc-500 px-2.5 py-1 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            + Upload
          </button>
        )}
      </div>

      {/* Upload control */}
      {showUpload && !readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`border-2 border-dashed rounded-xl flex items-center justify-between gap-3 px-3 py-2.5 transition-colors ${
            dragOver
              ? "border-cyan-400 bg-cyan-400/5"
              : "border-zinc-700 hover:border-zinc-500"
          }`}
        >
          <p className="text-zinc-400 text-xs">
            Drag &amp; drop images, or{" "}
            <span className="text-cyan-400">upload</span>. PNG/JPEG/WebP, max{" "}
            {IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB.
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="shrink-0 text-xs bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white font-medium px-3 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            {uploading ? "Uploading…" : "Upload images"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={accept}
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {/* Upload result line */}
      {uploadResult && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-zinc-400">
            Added {uploadResult.added}
            {uploadResult.errors.length > 0
              ? ` · ${uploadResult.errors.length} skipped`
              : ""}
          </p>
          {uploadResult.errors.map((err, i) => (
            <p key={i} className="text-xs text-red-400">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Groups */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-zinc-600 text-sm">
          Loading gallery…
        </div>
      ) : (
        <div
          className={`flex flex-col gap-5 ${
            compact ? "max-h-72 overflow-auto pr-1" : ""
          }`}
        >
          <GalleryGroup
            heading="Uploaded"
            accent="uploaded"
            images={uploadedImages}
            compact={compact}
            readOnly={readOnly}
            emptyMessage="No uploaded images yet."
            onUseImage={onUseImage}
            onRemove={handleRemove}
          />
          <GalleryGroup
            heading="AI-generated"
            accent="ai"
            images={aiImages}
            compact={compact}
            readOnly={readOnly}
            emptyMessage="No generated images yet. Run the pipeline to create some."
            onUseImage={onUseImage}
            onRemove={handleRemove}
          />
        </div>
      )}
    </div>
  );
}
