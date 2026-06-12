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
  frameDims,
  sliceSpritesheet,
  MAX_FRAMES,
  type GridSpec,
  type SlicedFrame,
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

export default function SpriteBench() {
  const [source, setSource] = useState<SourceSheet | null>(null);
  const [grid, setGrid] = useState<GridSpec>(DEFAULT_GRID);
  const [frames, setFrames] = useState<SlicedFrame[]>([]);
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
    setFrames(sliceSpritesheet(source.img, grid));
    setExcluded(new Set());
    setGif(null);
  }, [source, grid]);

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

  // ---- Frame selection ----
  const included = frames.filter(
    (f) => !excluded.has(f.index) && !(skipBlank && f.blank),
  );

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
  }, [included, fps, pingPong, transparent, bgColor]);

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
    const v = Math.max(0, Number(raw) || 0);
    setGrid((g) => ({ ...g, [field]: field === "rows" || field === "cols" ? Math.max(1, v) : v }));
  };

  const numInput = (label: string, field: keyof GridSpec, min: number) => (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-400">
      {label}
      <input
        type="number"
        min={min}
        value={grid[field]}
        onChange={(e) => setGridField(field, e.target.value)}
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
            {/* Animation preview */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Live preview
              </h2>
              <AnimationPreview frames={included} fps={fps} pingPong={pingPong} />
            </section>

            {/* Sheet + grid overlay */}
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
                    className="max-w-full rounded-lg border border-zinc-800"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <canvas
                    ref={overlayRef}
                    className="pointer-events-none absolute inset-0 h-full w-full"
                  />
                </div>
              </section>
            )}

            {/* Frame strip */}
            {frames.length > 0 && (
              <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                    Frames
                  </h2>
                  <span className="text-xs text-zinc-500">
                    {included.length} of {frames.length} in animation — click to toggle
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {frames.map((f) => {
                    const skipped = skipBlank && f.blank;
                    const off = excluded.has(f.index) || skipped;
                    return (
                      <button
                        key={f.index}
                        type="button"
                        onClick={() => !skipped && toggleFrame(f.index)}
                        title={
                          skipped
                            ? "Blank frame (auto-skipped)"
                            : off
                              ? "Excluded — click to include"
                              : "Included — click to exclude"
                        }
                        className={`relative rounded-lg border p-0.5 transition-all ${
                          off
                            ? "border-zinc-800 opacity-30"
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
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
