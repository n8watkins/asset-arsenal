"use client";

// Bench V2 — the "collapsed" pipeline.
//
// Hypothesis: §1 can do far more in one pass. Instead of analyze → collection
// prompt → collection image → per-icon prompts → generate, V2 runs ONE vision
// call that returns the manifest, a shared style paragraph, and a ready-to-go
// prompt for every icon — then generates each icon using the ORIGINAL source
// image as the style reference. Two model calls of "thinking" (here: one) become
// the whole front of the chain; §3's collection image is dropped entirely.
//
// This is deliberately the clean test of "does the collection image earn its
// cost?" — judge V2's icons against the full Bench chain.

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import GalleryPicker, { type PickedImage } from "@/components/gallery/GalleryPicker";
import { megaAnalyze, generateIconsV2Batch } from "@/lib/icon/client-api";
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
} from "@/types/icon-pipeline";

function fmtUsd(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
}

// The analyze + generate models come from the cheapest baseline stack. V2 keeps
// the front conservative on purpose — the experiment is the pipeline shape.
const ANALYZE_MODEL = DEFAULT_STACK.models.analyze;
const IMAGE_MODEL = DEFAULT_STACK.models.generateIcons;
const IMAGE_QUALITY = DEFAULT_STACK.quality.generateIcons;

// A locally-editable copy of an analyzed icon: its prompt is tunable and it can
// be toggled out of the generation batch.
type EditableIcon = MegaAnalysisIcon & { include: boolean };

export default function BenchV2Page() {
  const [ref, setRef] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [analysis, setAnalysis] = useState<MegaAnalysis | null>(null);
  const [icons, setIcons] = useState<EditableIcon[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [analyzeCost, setAnalyzeCost] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedIcon[] | null>(null);
  const [genCost, setGenCost] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // One persistence "run" per page load — generated icons land in the gallery.
  const runIdRef = useRef<string>(crypto.randomUUID());
  const createdAtRef = useRef<string>(new Date().toISOString());

  const includedCount = icons.filter((i) => i.include).length;
  const estGenCost = useMemo(
    () => imageCostUSD(IMAGE_MODEL, IMAGE_QUALITY, includedCount),
    [includedCount],
  );
  const estAnalyzeCost = useMemo(
    () => estimateStepCostUSD("analyze", ANALYZE_MODEL),
    [],
  );

  const setReference = useCallback((dataUrl: string, fileName: string) => {
    setRef({ dataUrl, fileName });
    // A new reference invalidates any prior analysis/results.
    setAnalysis(null);
    setIcons([]);
    setResults(null);
    setAnalyzeErr(null);
    setGenErr(null);
    setAnalyzeCost(null);
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const runAnalyze = useCallback(async () => {
    if (!ref) return;
    setAnalyzing(true);
    setAnalyzeErr(null);
    setResults(null);
    setGenErr(null);
    setSaved(null);
    try {
      const { analysis: a } = await megaAnalyze(ref.dataUrl, ref.fileName, ANALYZE_MODEL);
      setAnalysis(a);
      setIcons(a.icons.map((ic) => ({ ...ic, include: true })));
      setAnalyzeCost(fmtUsd(estimateStepCostUSD("analyze", ANALYZE_MODEL)));
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
    setGenCost(null);
    setSaved(null);
    try {
      const { generatedIcons } = await generateIconsV2Batch({
        referenceImageBase64: ref.dataUrl,
        sharedStylePrompt: analysis.sharedStylePrompt,
        icons: batch.map((i) => ({
          iconId: i.id,
          iconName: i.name,
          concept: i.concept,
          prompt: i.prompt,
        })),
        model: IMAGE_MODEL,
        quality: IMAGE_QUALITY,
      });
      setResults(generatedIcons);
      const ok = generatedIcons.filter((g) => g.status === "success").length;
      setGenCost(fmtUsd(imageCostUSD(IMAGE_MODEL, IMAGE_QUALITY, ok)));
      const n = await persistBenchIcons(generatedIcons, {
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
  }, [ref, analysis, icons]);

  const updatePrompt = useCallback((id: string, prompt: string) => {
    setIcons((prev) => prev.map((i) => (i.id === id ? { ...i, prompt } : i)));
  }, []);
  const toggleInclude = useCallback((id: string) => {
    setIcons((prev) => prev.map((i) => (i.id === id ? { ...i, include: !i.include } : i)));
  }, []);

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">Bench V2</h1>
              <span className="rounded-md bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-700/40">
                collapsed pipeline
              </span>
            </div>
            <p className="max-w-2xl text-sm text-zinc-400">
              One vision pass does §1 + §2 + §4 at once — manifest, shared style,
              and a prompt for every icon — then each icon is generated using your{" "}
              <strong className="text-zinc-200">source image</strong> as the style
              reference. No collection image step. It&apos;s the clean test of
              whether the collection image earns its cost vs the full{" "}
              <Link href="/bench" className="text-cyan-400/80 hover:text-cyan-300">
                Bench
              </Link>{" "}
              chain.
            </p>
          </div>

          {/* Step 1 — reference image */}
          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-violet-400">1</span>
              <h2 className="text-lg font-semibold">Reference image</h2>
              <span className="text-xs text-zinc-500">the dashboard / UI to mine</span>
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
                  <img
                    src={ref.dataUrl}
                    alt={ref.fileName}
                    className="max-h-48 rounded-xl border border-zinc-800 object-contain"
                  />
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
                  <button
                    type="button"
                    onClick={clearRef}
                    className="self-start text-xs text-zinc-500 hover:text-red-300"
                  >
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
              <span className="text-xs text-zinc-500">
                {ANALYZE_MODEL} · est. {fmtUsd(estAnalyzeCost)}
                {analyzeCost ? ` · ran ~${analyzeCost}` : ""}
              </span>
            </div>
            {analyzeErr && <p className="text-sm text-red-400">{analyzeErr}</p>}
          </section>

          {/* Style guide */}
          {analysis && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">2</span>
                <h2 className="text-lg font-semibold">Style guide</h2>
                <span className="text-xs text-zinc-500">
                  {analysis.iconCount} icons detected
                </span>
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
                <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-300">
                  {analysis.sharedStylePrompt}
                </p>
              </div>
            </section>
          )}

          {/* Per-icon prompts */}
          {analysis && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">3</span>
                <h2 className="text-lg font-semibold">Icon prompts</h2>
                <span className="text-xs text-zinc-500">
                  {includedCount} of {icons.length} selected · editable
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
                        <input
                          type="checkbox"
                          checked={ic.include}
                          onChange={() => toggleInclude(ic.id)}
                          className="h-4 w-4 accent-cyan-500"
                        />
                        <span className="font-medium text-zinc-100">{ic.name}</span>
                      </label>
                      <span className="font-mono text-xs text-zinc-600">{ic.id}</span>
                      <span className="text-xs text-zinc-500">· {ic.concept}</span>
                      <span
                        className={`ml-auto rounded px-1.5 py-0.5 text-[10px] ${
                          ic.confidence === "high"
                            ? "bg-emerald-900/30 text-emerald-300"
                            : ic.confidence === "medium"
                              ? "bg-amber-900/30 text-amber-300"
                              : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {ic.confidence}
                      </span>
                    </div>
                    <textarea
                      value={ic.prompt}
                      onChange={(e) => updatePrompt(ic.id, e.target.value)}
                      rows={3}
                      className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-950 p-2 text-xs text-zinc-300 focus:border-cyan-500/60 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={runGenerate}
                  disabled={generating || includedCount === 0}
                  className="rounded-xl bg-violet-500/15 px-4 py-2.5 text-sm font-medium text-violet-200 ring-1 ring-violet-500/40 transition-colors hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {generating ? "Generating (3 at a time)…" : `▸ Generate ${includedCount} icon${includedCount === 1 ? "" : "s"}`}
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

          {/* Results */}
          {results && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">4</span>
                <h2 className="text-lg font-semibold">Results</h2>
                <span className="text-xs text-zinc-500">
                  {results.filter((r) => r.status === "success").length}/{results.length} succeeded
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {results.map((r) => (
                  <div key={r.id} className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-2">
                    {r.status === "success" && r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageUrl} alt={r.iconName} className="aspect-square w-full rounded-lg object-contain" />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-red-950/30 text-center text-[10px] text-red-400">
                        {r.error ?? "failed"}
                      </div>
                    )}
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
