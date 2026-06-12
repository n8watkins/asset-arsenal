"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";
import GalleryPicker from "@/components/gallery/GalleryPicker";
import AnimationPreview from "@/components/sprite/AnimationPreview";
import { readImageFile } from "@/lib/icon/download";
import { downloadZip, zipEntriesFromDataUrls } from "@/lib/zip";
import { encodeGif } from "@/lib/sprite/gif";
import {
  autoDetectGrid,
  computeStabilizeTweaks,
  frameDims,
  sliceSpritesheet,
  MAX_FRAMES,
  type FrameTweak,
  type GridSpec,
  type SlicedFrame,
  type StabilizeAnchor,
} from "@/lib/sprite/slice";

// Sprite bench: slice a sprite sheet on a grid, preview the animation live,
// export an animated GIF (or the frames as a zip). Everything runs locally in
// the browser — zero model calls, zero cost. Inspired by collidingScopes'
// MIT-licensed spritesheet-to-gif; reimplemented here with live preview,
// auto-grid detection, blank-frame skipping, per-frame toggles, ping-pong,
// transparency-preserving encoding, and gallery integration.

interface SourceSheet {
  dataUrl: string;
  img: HTMLImageElement;
  name: string;
  width: number;
  height: number;
}

const DEFAULT_GRID: GridSpec = {
  rows: 4,
  cols: 4,
  offsetTop: 0,
  offsetBottom: 0,
  offsetLeft: 0,
  offsetRight: 0,
};

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image."));
    img.src = dataUrl;
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const v = m ? parseInt(m[1], 16) : 0xffffff;
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

function gridToDraft(g: GridSpec): Record<keyof GridSpec, string> {
  return {
    rows: String(g.rows),
    cols: String(g.cols),
    offsetTop: String(g.offsetTop),
    offsetBottom: String(g.offsetBottom),
    offsetLeft: String(g.offsetLeft),
    offsetRight: String(g.offsetRight),
  };
}

export default function SpriteBench() {
  const [source, setSource] = useState<SourceSheet | null>(null);
  const [grid, setGrid] = useState<GridSpec>(DEFAULT_GRID);
  // Inputs edit this string draft; grid only updates on valid numbers, so a
  // field can sit empty while the user types a replacement.
  const [draft, setDraft] = useState<Record<keyof GridSpec, string>>(() =>
    gridToDraft(DEFAULT_GRID),
  );
  const [frames, setFrames] = useState<SlicedFrame[]>([]);
  const [tweaks, setTweaks] = useState<Map<number, FrameTweak>>(new Map());
  const [order, setOrder] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<StabilizeAnchor>("bottom");
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [skipBlank, setSkipBlank] = useState(true);
  const [fps, setFps] = useState(10);
  const [pingPong, setPingPong] = useState(false);
  const [transparent, setTransparent] = useState(true);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [gif, setGif] = useState<{ url: string; bytes: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const gifUrlRef = useRef<string | null>(null);

  // ---- Source intake (file / drop / paste / gallery) ----
  const acceptFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setError(null);
    try {
      const { dataUrl } = await readImageFile(file);
      const img = await loadImage(dataUrl);
      setSource({
        dataUrl,
        img,
        name: file.name,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }, []);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) =>
        f.type.startsWith("image/"),
      );
      if (file) void acceptFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [acceptFile]);

  const handleGalleryPick = useCallback(
    async (img: { dataUrl: string; fileName: string }) => {
      setError(null);
      try {
        const el = await loadImage(img.dataUrl);
        setSource({
          dataUrl: img.dataUrl,
          img: el,
          name: img.fileName,
          width: el.naturalWidth,
          height: el.naturalHeight,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load that image.");
      }
    },
    [],
  );

  // ---- Slice whenever the sheet or grid changes ----
  useEffect(() => {
    if (!source) {
      setFrames([]);
      return;
    }
    if (grid.rows * grid.cols > MAX_FRAMES) {
      setFrames([]);
      setError(`That grid is ${grid.rows}×${grid.cols} — over the ${MAX_FRAMES}-frame cap.`);
      return;
    }
    setError(null);
    const sliced = sliceSpritesheet(source.img, grid);
    setFrames(sliced);
    setOrder(sliced.map((f) => f.index));
    setTweaks(new Map());
    setSelected(null);
    setExcluded(new Set());
    setGif(null);
  }, [source, grid]);

  // Keep the input drafts in sync when the grid changes for other reasons
  // (auto-detect, a committed keystroke). An empty draft never reaches here
  // because invalid input doesn't update the grid.
  useEffect(() => {
    setDraft(gridToDraft(grid));
  }, [grid]);

  // ---- Grid overlay on the sheet preview ----
  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { frameW, frameH } = frameDims(source.width, source.height, grid);
    if (frameW < 1 || frameH < 1) return;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.9)"; // cyan-400
    ctx.lineWidth = Math.max(1, Math.round(source.width / 512));
    const effW = frameW * grid.cols;
    const effH = frameH * grid.rows;
    ctx.strokeRect(grid.offsetLeft, grid.offsetTop, effW, effH);
    for (let c = 1; c < grid.cols; c++) {
      const x = grid.offsetLeft + c * frameW;
      ctx.beginPath();
      ctx.moveTo(x, grid.offsetTop);
      ctx.lineTo(x, grid.offsetTop + effH);
      ctx.stroke();
    }
    for (let r = 1; r < grid.rows; r++) {
      const y = grid.offsetTop + r * frameH;
      ctx.beginPath();
      ctx.moveTo(grid.offsetLeft, y);
      ctx.lineTo(grid.offsetLeft + effW, y);
      ctx.stroke();
    }
  }, [source, grid]);

  // ---- Frame selection (in display order) ----
  const included = order
    .map((i) => frames[i])
    .filter(
      (f): f is SlicedFrame =>
        !!f && !excluded.has(f.index) && !(skipBlank && f.blank),
    );

  const previewFrames = included.map((f) => ({
    imageData: f.imageData,
    hold: tweaks.get(f.index)?.hold ?? 1,
  }));

  const toggleFrame = useCallback((index: number) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    setGif(null);
  }, []);

  // ---- Auto-detect ----
  const handleAutoDetect = useCallback(() => {
    if (!source) return;
    const detected = autoDetectGrid(source.img);
    if (detected) setGrid(detected);
    else setError("Couldn't auto-detect a grid — sprites may not have background gaps between them.");
  }, [source]);

  // ---- Per-frame tweaks (nudge / hold / stabilize) ----
  const applyTweaks = useCallback(
    (next: Map<number, FrameTweak>) => {
      if (!source) return;
      setTweaks(next);
      setFrames(sliceSpritesheet(source.img, grid, next));
      setGif(null);
    },
    [source, grid],
  );

  const updateTweak = useCallback(
    (index: number, patch: Partial<FrameTweak>) => {
      const cur = tweaks.get(index) ?? { dx: 0, dy: 0, hold: 1 };
      const merged = { ...cur, ...patch };
      const next = new Map(tweaks);
      if (merged.dx === 0 && merged.dy === 0 && merged.hold === 1) next.delete(index);
      else next.set(index, merged);
      applyTweaks(next);
    },
    [tweaks, applyTweaks],
  );

  const handleStabilize = useCallback(() => {
    if (!source) return;
    const computed = computeStabilizeTweaks(source.img, grid, anchor, tweaks);
    if (computed) applyTweaks(computed);
    else setError("Couldn't stabilize — need at least two frames with content.");
  }, [source, grid, anchor, tweaks, applyTweaks]);

  // ---- Export ----
  const handleGenerate = useCallback(() => {
    if (included.length === 0) return;
    setBusy(true);
    setError(null);
    // Let the busy state paint before the synchronous encode.
    setTimeout(() => {
      try {
        // Ping-pong is baked into the file: forward + reversed middle.
        const sequence = pingPong
          ? [...included, ...included.slice(1, -1).reverse()]
          : included;
        const blob = encodeGif(
          sequence.map((f) => f.imageData),
          {
            delayMs: 1000 / fps,
            delaysMs: sequence.map(
              (f) => (1000 / fps) * (tweaks.get(f.index)?.hold ?? 1),
            ),
            transparent,
            background: hexToRgb(bgColor),
          },
        );
        if (gifUrlRef.current) URL.revokeObjectURL(gifUrlRef.current);
        const url = URL.createObjectURL(blob);
        gifUrlRef.current = url;
        setGif({ url, bytes: blob.size });
      } catch (e) {
        setError(e instanceof Error ? e.message : "GIF encoding failed.");
      } finally {
        setBusy(false);
      }
    }, 30);
  }, [included, fps, pingPong, transparent, bgColor, tweaks]);

  useEffect(
    () => () => {
      if (gifUrlRef.current) URL.revokeObjectURL(gifUrlRef.current);
    },
    [],
  );

  // Frames in the exported file (ping-pong appends the reversed middle).
  const exportCount = pingPong
    ? Math.max(included.length, included.length * 2 - 2)
    : included.length;

  const handleDownloadFrames = useCallback(() => {
    if (!source || included.length === 0) return;
    const base = source.name.replace(/\.[a-z0-9]+$/i, "") || "sprite";
    downloadZip(
      `${base}-frames.zip`,
      zipEntriesFromDataUrls(
        included.map((f, i) => ({
          name: `${base}-frame-${String(i + 1).padStart(2, "0")}`,
          dataUrl: f.dataUrl,
        })),
      ),
    );
  }, [source, included]);

  const setGridField = (field: keyof GridSpec, raw: string) => {
    setDraft((d) => ({ ...d, [field]: raw }));
    const n = parseInt(raw, 10);
    if (Number.isNaN(n)) return; // empty/partial input: keep the last valid grid
    const v = field === "rows" || field === "cols" ? Math.max(1, n) : Math.max(0, n);
    setGrid((g) => (g[field] === v ? g : { ...g, [field]: v }));
  };

  const numInput = (label: string, field: keyof GridSpec, min: number) => (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
      {label}
      <input
        type="number"
        min={min}
        value={draft[field]}
        onChange={(e) => setGridField(field, e.target.value)}
        onBlur={() => setDraft((d) => ({ ...d, [field]: String(grid[field]) }))}
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-cyan-500 focus:outline-none"
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Sprite bench</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Slice a sprite sheet, preview the animation live, export a GIF or the
            frames as a zip. Runs entirely in the browser — no model calls, $0.
          </p>
        </header>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          {/* Left column: source + grid + export */}
          <div className="flex flex-col gap-6">
            {/* Source */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Sprite sheet
              </h2>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files[0];
                  if (file) void acceptFile(file);
                }}
                className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
                  dragOver
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-zinc-700 hover:border-zinc-500"
                }`}
              >
                <span className="text-sm font-medium text-zinc-200">
                  Drop, click, or paste a sprite sheet
                </span>
                <span className="text-xs text-zinc-500">PNG with transparency works best</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void acceptFile(file);
                  e.target.value = "";
                }}
              />
              <div className="mt-3 flex items-center gap-3">
                <GalleryPicker onPick={handleGalleryPick} label="From gallery" />
                {source && (
                  <span className="truncate text-xs text-zinc-500">
                    {source.name} · {source.width}×{source.height}
                  </span>
                )}
              </div>
            </section>

            {/* Grid */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  Grid
                </h2>
                <button
                  type="button"
                  onClick={handleAutoDetect}
                  disabled={!source}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 disabled:opacity-40"
                >
                  Auto-detect
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {numInput("Rows", "rows", 1)}
                {numInput("Columns", "cols", 1)}
                {numInput("Offset top", "offsetTop", 0)}
                {numInput("Offset bottom", "offsetBottom", 0)}
                {numInput("Offset left", "offsetLeft", 0)}
                {numInput("Offset right", "offsetRight", 0)}
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  checked={skipBlank}
                  onChange={(e) => {
                    setSkipBlank(e.target.checked);
                    setGif(null);
                  }}
                  className="accent-cyan-400"
                />
                Skip blank frames automatically
              </label>
              <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3">
                <button
                  type="button"
                  onClick={handleStabilize}
                  disabled={!source}
                  title="Auto-align the sprite across frames so the animation doesn't jitter"
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 disabled:opacity-40"
                >
                  Stabilize frames
                </button>
                <select
                  value={anchor}
                  onChange={(e) => setAnchor(e.target.value as StabilizeAnchor)}
                  className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="bottom">anchor: feet (bottom)</option>
                  <option value="center">anchor: center</option>
                </select>
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Stabilize aligns each frame&apos;s content to a common anchor —
                fixes sprites that drift around between cells.
              </p>
            </section>

            {/* Export */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Export
              </h2>
              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-between gap-3 text-sm text-zinc-300">
                  <span>
                    Speed{" "}
                    <span className="text-xs text-zinc-500">
                      ({fps} fps · {Math.round(1000 / fps)}ms/frame)
                    </span>
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={fps}
                    onChange={(e) => {
                      setFps(Number(e.target.value));
                      setGif(null);
                    }}
                    className="w-40 accent-cyan-400"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={pingPong}
                    onChange={(e) => {
                      setPingPong(e.target.checked);
                      setGif(null);
                    }}
                    className="accent-cyan-400"
                  />
                  Ping-pong (forward then back)
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={transparent}
                    onChange={(e) => {
                      setTransparent(e.target.checked);
                      setGif(null);
                    }}
                    className="accent-cyan-400"
                  />
                  Transparent background
                  {!transparent && (
                    <input
                      type="color"
                      value={bgColor}
                      onChange={(e) => {
                        setBgColor(e.target.value);
                        setGif(null);
                      }}
                      className="ml-2 h-7 w-10 cursor-pointer rounded border border-zinc-700 bg-transparent"
                      title="Background color"
                    />
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={included.length === 0 || busy}
                  className="rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400 disabled:opacity-40"
                >
                  {busy ? "Encoding…" : `Generate GIF (${exportCount} frames)`}
                </button>
                {gif && (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={gif.url}
                      alt="Generated sprite animation"
                      className="max-h-48 rounded-lg"
                      style={{
                        imageRendering: "pixelated",
                        backgroundImage:
                          "conic-gradient(#3f3f46 0 25%, #27272a 0 50%, #3f3f46 0 75%, #27272a 0)",
                        backgroundSize: "16px 16px",
                      }}
                    />
                    <div className="flex items-center gap-3">
                      <a
                        href={gif.url}
                        download="sprite-animation.gif"
                        className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-cyan-400"
                      >
                        Download GIF
                      </a>
                      <span className="text-xs text-zinc-500">
                        {(gif.bytes / 1024).toFixed(1)} KB
                      </span>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleDownloadFrames}
                  disabled={included.length === 0}
                  className="rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 disabled:opacity-40"
                >
                  Download frames (.zip)
                </button>
              </div>
            </section>
          </div>

          {/* Right column: previews */}
          <div className="flex flex-col gap-6">
            {/* Sheet + grid overlay (compact, at the top so the preview can
                stay pinned next to the frame editor below) */}
            {source && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  Sheet · grid overlay
                </h2>
                <div className="relative inline-block max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={source.dataUrl}
                    alt="Sprite sheet"
                    className="max-h-64 max-w-full rounded-lg border border-zinc-800"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <canvas
                    ref={overlayRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />
                </div>
              </section>
            )}

            {/* Animation preview — sticky so it stays in view while you
                scroll/nudge individual frames underneath */}
            <section className="sticky top-20 z-10 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 backdrop-blur-md">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Live preview
              </h2>
              <AnimationPreview frames={previewFrames} fps={fps} pingPong={pingPong} />
            </section>

            {/* Frame strip */}
            {frames.length > 0 && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Frames
                  </h2>
                  <span className="text-xs text-zinc-500">
                    {included.length} of {frames.length} in animation — click a frame to edit
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.map((idx) => {
                    const f = frames[idx];
                    if (!f) return null;
                    const skipped = skipBlank && f.blank;
                    const off = excluded.has(f.index) || skipped;
                    const isSel = selected === f.index;
                    return (
                      <button
                        key={f.index}
                        type="button"
                        onClick={() => setSelected(isSel ? null : f.index)}
                        title={skipped ? "Blank frame (auto-skipped)" : `Frame ${f.index + 1} — click to edit`}
                        className={`relative rounded-lg border p-0.5 transition-all ${
                          isSel
                            ? "border-cyan-300 ring-2 ring-cyan-400/60"
                            : off
                              ? "border-zinc-800 opacity-30 hover:opacity-60"
                              : "border-cyan-500/50 hover:border-cyan-400"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={f.dataUrl}
                          alt={`Frame ${f.index + 1}`}
                          className="h-14 w-14 rounded object-contain"
                          style={{
                            imageRendering: "pixelated",
                            backgroundImage:
                              "conic-gradient(#3f3f46 0 25%, #27272a 0 50%, #3f3f46 0 75%, #27272a 0)",
                            backgroundSize: "8px 8px",
                          }}
                        />
                        {skipped && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-zinc-800 px-1 text-[9px] uppercase text-zinc-400">
                            blank
                          </span>
                        )}
                        {!skipped && excluded.has(f.index) && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-zinc-800 px-1 text-[9px] uppercase text-zinc-400">
                            off
                          </span>
                        )}
                        {tweaks.has(f.index) && (
                          <span
                            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-cyan-400"
                            title="Adjusted"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {selected !== null && frames[selected] && (() => {
                  const f = frames[selected];
                  const t = tweaks.get(selected) ?? { dx: 0, dy: 0, hold: 1 };
                  const pos = order.indexOf(selected);
                  const skipped = skipBlank && f.blank;
                  const nudge = (dx: number, dy: number, step: number) =>
                    updateTweak(selected, { dx: t.dx + dx * step, dy: t.dy + dy * step });
                  const move = (dir: -1 | 1) => {
                    const j = pos + dir;
                    if (j < 0 || j >= order.length) return;
                    const next = [...order];
                    [next[pos], next[j]] = [next[j], next[pos]];
                    setOrder(next);
                    setGif(null);
                  };
                  const btn =
                    "rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 disabled:opacity-40";
                  return (
                    <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950/60 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-zinc-200">
                          Frame {pos + 1}
                          <span className="ml-2 text-xs font-normal text-zinc-500">
                            cell {f.index + 1}{skipped ? " · blank" : ""}
                          </span>
                        </h3>
                        <button type="button" onClick={() => setSelected(null)} className={btn}>
                          Close
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm text-zinc-300">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!excluded.has(f.index) && !skipped}
                            disabled={skipped}
                            onChange={() => toggleFrame(f.index)}
                            className="accent-cyan-400"
                          />
                          In animation
                        </label>
                        <div className="flex items-center gap-2" title="Nudge the crop. Shift-click = 8px">
                          <span className="text-xs text-zinc-500">Nudge</span>
                          <button type="button" className={btn} onClick={(e) => nudge(-1, 0, e.shiftKey ? 8 : 1)}>←</button>
                          <button type="button" className={btn} onClick={(e) => nudge(1, 0, e.shiftKey ? 8 : 1)}>→</button>
                          <button type="button" className={btn} onClick={(e) => nudge(0, -1, e.shiftKey ? 8 : 1)}>↑</button>
                          <button type="button" className={btn} onClick={(e) => nudge(0, 1, e.shiftKey ? 8 : 1)}>↓</button>
                          <span className="text-xs tabular-nums text-zinc-500">
                            dx {t.dx} · dy {t.dy}
                          </span>
                          {(t.dx !== 0 || t.dy !== 0) && (
                            <button
                              type="button"
                              className={btn}
                              onClick={() => updateTweak(selected, { dx: 0, dy: 0 })}
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2" title="How long this frame is shown">
                          <span className="text-xs text-zinc-500">Duration</span>
                          <button
                            type="button"
                            className={btn}
                            disabled={t.hold <= 1}
                            onClick={() => updateTweak(selected, { hold: Math.max(1, t.hold - 1) })}
                          >
                            −
                          </button>
                          <span className="text-xs tabular-nums text-zinc-400">
                            ×{t.hold} ({Math.round((1000 / fps) * t.hold)}ms)
                          </span>
                          <button
                            type="button"
                            className={btn}
                            disabled={t.hold >= 10}
                            onClick={() => updateTweak(selected, { hold: Math.min(10, t.hold + 1) })}
                          >
                            +
                          </button>
                        </div>
                        <div className="flex items-center gap-2" title="Reorder this frame in the animation">
                          <span className="text-xs text-zinc-500">Order</span>
                          <button type="button" className={btn} disabled={pos <= 0} onClick={() => move(-1)}>
                            ◀ earlier
                          </button>
                          <button
                            type="button"
                            className={btn}
                            disabled={pos >= order.length - 1}
                            onClick={() => move(1)}
                          >
                            later ▶
                          </button>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-zinc-500">
                        Tip: shift-click the nudge arrows to move 8px at a time. The
                        cyan dot marks adjusted frames.
                      </p>
                    </div>
                  );
                })()}
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
