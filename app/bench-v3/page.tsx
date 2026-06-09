"use client";

// Bench V3 — the "grid" pipeline.
//
// Shares V2's mega-analysis front, then generates ALL selected icons in ONE
// grid image (4×4 = 16 per grid) and slices it locally into individual icons.
// One image call instead of N → ~16× cheaper than V2; the trade-off is lower
// per-icon resolution and slicing edge-cases. Two slicers, same cost:
//   CV   — find icons by their pixels (robust to grid drift). Default.
//   math — assume a perfect grid and cut by arithmetic (chops on drift).

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import GalleryPicker, { type PickedImage } from "@/components/gallery/GalleryPicker";
import { megaAnalyze, generateGrid } from "@/lib/icon/client-api";
import { persistBenchIcons } from "@/lib/icon/bench-persist";
import { readImageFile } from "@/lib/icon/download";
import {
  DEFAULT_STACK,
  estimateStepCostUSD,
  imageCostUSD,
} from "@/lib/icon/model-reference";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";
import type {
  MegaAnalysis,
  MegaAnalysisIcon,
  GeneratedIcon,
  SliceMode,
} from "@/types/icon-pipeline";

const ROWS = 4;
const COLS = 4;
const PER_GRID = ROWS * COLS; // 16

const ANALYZE_MODEL = DEFAULT_STACK.models.analyze;
const IMAGE_MODEL = DEFAULT_STACK.models.generateIcons;
const IMAGE_QUALITY = DEFAULT_STACK.quality.generateIcons;

function fmtUsd(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
}

type EditableIcon = MegaAnalysisIcon & { include: boolean };

type GridResult = {
  gridImageBase64: string;
  expectedCount: number;
  detectedCount: number;
};

export default function BenchV3Page() {
  const [ref, setRef] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [analysis, setAnalysis] = useState<MegaAnalysis | null>(null);
  const [icons, setIcons] = useState<EditableIcon[]>([]);
  const [mode, setMode] = useState<SliceMode>("cv");

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedIcon[] | null>(null);
  const [grids, setGrids] = useState<GridResult[]>([]);
  const [genCost, setGenCost] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const runIdRef = useRef<string>(crypto.randomUUID());
  const createdAtRef = useRef<string>(new Date().toISOString());

  const includedCount = icons.filter((i) => i.include).length;
  const gridCount = Math.max(1, Math.ceil(includedCount / PER_GRID));
  const estGenCost = useMemo(
    () => imageCostUSD(IMAGE_MODEL, IMAGE_QUALITY, gridCount),
    [gridCount],
  );
  const estAnalyzeCost = useMemo(() => estimateStepCostUSD("analyze", ANALYZE_MODEL), []);

  const setReference = useCallback((dataUrl: string, fileName: string) => {
    setRef({ dataUrl, fileName });
    setAnalysis(null);
    setIcons([]);
    setResults(null);
    setGrids([]);
    setAnalyzeErr(null);
    setGenErr(null);
    setGenCost(null);
    setSaved(null);
  }, []);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!(IMAGE_UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(file.type)) {
        setAnalyzeErr(`Unsupported type "${file.type || "unknown"}". Allowed: PNG, JPEG, WebP.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setAnalyzeErr(`${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB limit.`);
        return;
      }
      const { dataUrl } = await readImageFile(file);
      setReference(dataUrl, file.name);
    },
    [setReference],
  );

  const onPick = useCallback(
    (img: PickedImage) => setReference(img.dataUrl, img.fileName),
    [setReference],
  );

  const clearRef = useCallback(() => {
    setRef(null);
    setAnalysis(null);
    setIcons([]);
    setResults(null);
    setGrids([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const runAnalyze = useCallback(async () => {
    if (!ref) return;
    setAnalyzing(true);
    setAnalyzeErr(null);
    setResults(null);
    setGrids([]);
    setGenErr(null);
    setSaved(null);
    try {
      const { analysis: a } = await megaAnalyze(ref.dataUrl, ref.fileName, ANALYZE_MODEL);
      setAnalysis(a);
      setIcons(a.icons.map((ic) => ({ ...ic, include: true })));
    } catch (err) {
      setAnalyzeErr(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [ref]);

  const runGenerate = useCallback(async () => {
    if (!ref || !analysis) return;
    const batch = icons.filter((i) => i.include);
    if (batch.length === 0) return;

    setGenerating(true);
    setGenErr(null);
    setResults(null);
    setGrids([]);
    setGenCost(null);
    setSaved(null);

    // Tile into 4×4 grids: one image call per chunk of 16.
    const chunks: EditableIcon[][] = [];
    for (let i = 0; i < batch.length; i += PER_GRID) chunks.push(batch.slice(i, i + PER_GRID));

    const allIcons: GeneratedIcon[] = [];
    const allGrids: GridResult[] = [];
    try {
      for (const chunk of chunks) {
        const res = await generateGrid({
          referenceImageBase64: ref.dataUrl,
          sharedStylePrompt: analysis.sharedStylePrompt,
          icons: chunk.map((i) => ({
            iconId: i.id,
            iconName: i.name,
            concept: i.concept,
            prompt: i.prompt,
          })),
          rows: ROWS,
          cols: COLS,
          mode,
          model: IMAGE_MODEL,
          quality: IMAGE_QUALITY,
        });
        allIcons.push(...res.generatedIcons);
        allGrids.push({
          gridImageBase64: res.gridImageBase64,
          expectedCount: res.expectedCount,
          detectedCount: res.detectedCount,
        });
        // Surface progress as each grid lands.
        setResults([...allIcons]);
        setGrids([...allGrids]);
      }
      setGenCost(fmtUsd(imageCostUSD(IMAGE_MODEL, IMAGE_QUALITY, allGrids.length)));
      const n = await persistBenchIcons(allIcons, {
        runId: runIdRef.current,
        createdAt: createdAtRef.current,
        sourceId: runIdRef.current,
      });
      setSaved(n);
    } catch (err) {
      setGenErr(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }, [ref, analysis, icons, mode]);

  const updatePrompt = useCallback((id: string, prompt: string) => {
    setIcons((prev) => prev.map((i) => (i.id === id ? { ...i, prompt } : i)));
  }, []);
  const toggleInclude = useCallback((id: string) => {
    setIcons((prev) => prev.map((i) => (i.id === id ? { ...i, include: !i.include } : i)));
  }, []);

  const anyMismatch = grids.some((g) => g.detectedCount !== g.expectedCount);

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">Bench V3</h1>
              <span className="rounded-md bg-fuchsia-900/30 px-2 py-0.5 text-xs text-fuchsia-300 ring-1 ring-fuchsia-700/40">
                grid pipeline
              </span>
            </div>
            <p className="max-w-2xl text-sm text-zinc-400">
              Same analyze front as{" "}
              <Link href="/bench-v2" className="text-cyan-400/80 hover:text-cyan-300">
                Bench V2
              </Link>
              , but all icons are generated in <strong className="text-zinc-200">one {ROWS}×{COLS} grid</strong>{" "}
              and sliced locally — one image call instead of N (~{PER_GRID}× cheaper),
              at the cost of lower per-icon resolution. Slicing is free either way.
            </p>
          </div>

          {/* Step 1 — reference image */}
          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-violet-400">1</span>
              <h2 className="text-lg font-semibold">Reference image</h2>
            </div>

            {!ref ? (
              <div className="flex flex-col gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-6 py-10 text-center transition-colors hover:border-cyan-500/60"
                >
                  <span className="text-sm text-zinc-400">Click to browse</span>
                  <span className="text-xs text-zinc-600">PNG, JPEG, or WebP · max {IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600">or</span>
                  <GalleryPicker onPick={onPick} />
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={IMAGE_UPLOAD_LIMITS.allowedMimeTypes.join(",")}
                  className="hidden"
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-start gap-4">
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={ref.dataUrl} alt={ref.fileName} className="max-h-48 rounded-xl border border-zinc-800 object-contain" />
                  <button
                    type="button"
                    onClick={clearRef}
                    aria-label="Remove image"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-300 hover:border-red-500/60 hover:text-red-300"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-300">{ref.fileName}</span>
                  <button type="button" onClick={clearRef} className="self-start text-xs text-zinc-500 hover:text-red-300">
                    ✕ Remove image
                  </button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={runAnalyze}
                disabled={!ref || analyzing}
                className="rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-300 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {analyzing ? "Analyzing…" : "▸ Analyze & compose all prompts"}
              </button>
              <span className="text-xs text-zinc-500">{ANALYZE_MODEL} · est. {fmtUsd(estAnalyzeCost)}</span>
            </div>
            {analyzeErr && <p className="text-sm text-red-400">{analyzeErr}</p>}
          </section>

          {/* Style guide */}
          {analysis && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">2</span>
                <h2 className="text-lg font-semibold">Style guide</h2>
                <span className="text-xs text-zinc-500">{analysis.iconCount} icons detected</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <StyleField label="Color palette" value={analysis.sharedIconFamilyStyle.colorPalette.join(", ")} />
                <StyleField label="Line style" value={analysis.sharedIconFamilyStyle.lineStyle} />
                <StyleField label="Shape language" value={analysis.sharedIconFamilyStyle.shapeLanguage} />
                <StyleField label="Glow" value={analysis.sharedIconFamilyStyle.glowStyle ?? "none"} />
                <StyleField label="Background rule" value={analysis.sharedIconFamilyStyle.backgroundRule} />
                <StyleField label="Avoids" value={analysis.sharedIconFamilyStyle.negativeRules.join(", ")} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs uppercase tracking-widest text-zinc-500">Shared style prompt</span>
                <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-300">{analysis.sharedStylePrompt}</p>
              </div>
            </section>
          )}

          {/* Per-icon prompts + slicer + generate */}
          {analysis && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">3</span>
                <h2 className="text-lg font-semibold">Icon prompts &amp; grid</h2>
                <span className="text-xs text-zinc-500">
                  {includedCount} of {icons.length} selected · {gridCount} grid{gridCount === 1 ? "" : "s"} of {PER_GRID}
                </span>
              </div>

              {/* Slicer toggle */}
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3">
                <span className="text-xs uppercase tracking-widest text-zinc-500">Slicer</span>
                {(["cv", "math"] as SliceMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      mode === m
                        ? "bg-fuchsia-500/15 text-fuchsia-200 ring-1 ring-fuchsia-500/40"
                        : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                    }`}
                  >
                    {m === "cv" ? "CV (find by pixels)" : "Math (fixed grid)"}
                  </button>
                ))}
                <span className="text-xs text-zinc-600">
                  {mode === "cv"
                    ? "Detects icons by their pixels — tolerant of grid drift."
                    : "Cuts by arithmetic — chops icons if the grid drifts."}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {icons.map((ic) => (
                  <div
                    key={ic.id}
                    className={`flex flex-col gap-2 rounded-xl border p-4 transition-opacity ${
                      ic.include ? "border-zinc-800 bg-zinc-950/40" : "border-zinc-900 bg-zinc-950/20 opacity-50"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2">
                        <input type="checkbox" checked={ic.include} onChange={() => toggleInclude(ic.id)} className="h-4 w-4 accent-fuchsia-500" />
                        <span className="font-medium text-zinc-100">{ic.name}</span>
                      </label>
                      <span className="font-mono text-xs text-zinc-600">{ic.id}</span>
                      <span className="text-xs text-zinc-500">· {ic.concept}</span>
                    </div>
                    <textarea
                      value={ic.prompt}
                      onChange={(e) => updatePrompt(ic.id, e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300 focus:border-fuchsia-500/60 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={runGenerate}
                  disabled={generating || includedCount === 0}
                  className="rounded-xl bg-fuchsia-500/15 px-4 py-2.5 text-sm font-medium text-fuchsia-200 ring-1 ring-fuchsia-500/40 transition-colors hover:bg-fuchsia-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generating ? "Generating grid…" : `▸ Generate ${gridCount} grid${gridCount === 1 ? "" : "s"} → slice`}
                </button>
                <span className="text-xs text-zinc-500">
                  {IMAGE_MODEL} {IMAGE_QUALITY} · est. {fmtUsd(estGenCost)}
                  {genCost ? ` · ran ${genCost}` : ""}
                </span>
              </div>
              {genErr && <p className="text-sm text-red-400">{genErr}</p>}
              {saved !== null && (
                <p className="text-xs text-emerald-400/80">Saved {saved} icon{saved === 1 ? "" : "s"} to the gallery.</p>
              )}
            </section>
          )}

          {/* Raw grids */}
          {grids.length > 0 && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">4</span>
                <h2 className="text-lg font-semibold">Raw grid{grids.length === 1 ? "" : "s"}</h2>
                <span className="text-xs text-zinc-500">the {mode.toUpperCase()} slicer cut these</span>
              </div>
              {anyMismatch && (
                <div className="rounded-lg border border-amber-700/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-300">
                  Slice count didn&apos;t match expected on at least one grid — the model&apos;s layout likely drifted.
                  Inspect the raw grid below; try the other slicer, or re-roll.
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {grids.map((g, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.gridImageBase64} alt={`grid ${i + 1}`} className="w-full rounded-lg" style={{ background: "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 20px 20px" }} />
                    <span className={`text-xs ${g.detectedCount === g.expectedCount ? "text-emerald-400/80" : "text-amber-400"}`}>
                      grid {i + 1}: detected {g.detectedCount} / expected {g.expectedCount}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Sliced results */}
          {results && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">5</span>
                <h2 className="text-lg font-semibold">Sliced icons</h2>
                <span className="text-xs text-zinc-500">{results.length} cut out</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {results.map((r) => (
                  <div key={r.id} className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.imageUrl}
                      alt={r.iconName}
                      className="aspect-square w-full rounded-lg object-contain"
                      style={{ background: "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 16px 16px" }}
                    />
                    <span className="truncate text-[11px] text-zinc-400">{r.iconName}</span>
                  </div>
                ))}
              </div>
              <Link href="/gallery" className="self-start text-xs text-cyan-400/80 hover:text-cyan-300">
                View in gallery ↗
              </Link>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

function StyleField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-300">{value || "—"}</span>
    </div>
  );
}
