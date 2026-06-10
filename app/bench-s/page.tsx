"use client";

// Bench S — source generation. UPSTREAM of V2/V3: take a bland source (the
// user's real screenshot/UI) and produce "source material" — a STYLE BRIEF +
// an ELEVATED source image (polished, identity preserved, NOT redesigned). The
// elevated image saves to the gallery, so V2/V3 can pick it as their reference.
//
// Input modes: image upload (live). URL → screenshot is DEFERRED — shown with
// its modeled cost so the trade-off is visible, capture wired later.

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import GalleryPicker, { type PickedImage } from "@/components/gallery/GalleryPicker";
import { analyzeStyleBrief, elevateSource } from "@/lib/icon/client-api";
import { saveSource } from "@/lib/storage/repo";
import { readImageFile } from "@/lib/icon/download";
import {
  CATALOG,
  DEFAULT_STACK,
  estimateStepCostUSD,
  imageCostUSD,
  realizedTextCostUSD,
  getModel,
  type ImageQuality,
} from "@/lib/icon/model-reference";
import { IMAGE_UPLOAD_LIMITS, MAX_FILE_SIZE_BYTES } from "@/lib/icon/models";
import type { StyleBrief, SourceImage } from "@/types/icon-pipeline";

const ANALYZE_MODEL = DEFAULT_STACK.models.analyze;
// Derived from the catalog (single source of truth for model facts) instead of
// a hardcoded list — new image models show up here automatically.
const IMAGE_MODELS = CATALOG.filter((m) => m.kind === "image").map((m) => m.id);
const QUALITIES: ImageQuality[] = ["low", "medium", "high"];
// Modeled marginal cost of the deferred URL→screenshot capture (a screenshot API).
const SCREENSHOT_COST = 0.003;

function usd(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
}

export default function BenchSPage() {
  const [src, setSrc] = useState<{ dataUrl: string; fileName: string } | null>(null);
  const [brief, setBrief] = useState<StyleBrief | null>(null);
  const [elevated, setElevated] = useState<string | null>(null);
  const [model, setModel] = useState<string>("gpt-image-1-mini");
  const [quality, setQuality] = useState<ImageQuality>("medium");

  const [briefing, setBriefing] = useState(false);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  const [briefRan, setBriefRan] = useState<string | null>(null);
  const [elevating, setElevating] = useState(false);
  const [elevateErr, setElevateErr] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const briefCost = useMemo(() => estimateStepCostUSD("analyze", ANALYZE_MODEL), []);
  const elevateCost = useMemo(() => imageCostUSD(model, quality, 1), [model, quality]);
  const totalImageMode = briefCost + elevateCost;

  const reset = useCallback((dataUrl: string | null, fileName: string) => {
    setSrc(dataUrl ? { dataUrl, fileName } : null);
    setBrief(null);
    setElevated(null);
    setBriefErr(null);
    setBriefRan(null);
    setElevateErr(null);
    setSavedNote(null);
  }, []);

  const onFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (!(IMAGE_UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(file.type)) {
        setBriefErr(`Unsupported type "${file.type || "unknown"}". Allowed: PNG, JPEG, WebP.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setBriefErr(`${(file.size / 1024 / 1024).toFixed(1)} MB exceeds the ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB limit.`);
        return;
      }
      const { dataUrl } = await readImageFile(file);
      reset(dataUrl, file.name);
    },
    [reset],
  );

  const onPick = useCallback((img: PickedImage) => reset(img.dataUrl, img.fileName), [reset]);

  const clearSrc = useCallback(() => {
    reset(null, "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  const runBrief = useCallback(async () => {
    if (!src) return;
    setBriefing(true);
    setBriefErr(null);
    setBriefRan(null);
    try {
      const { brief: b, usage } = await analyzeStyleBrief(src.dataUrl, ANALYZE_MODEL);
      setBrief(b);
      // Realized cost from the call's reported token usage (not the estimate).
      setBriefRan(usage ? usd(realizedTextCostUSD(ANALYZE_MODEL, usage)) : null);
    } catch (err) {
      setBriefErr(err instanceof Error ? err.message : String(err));
    } finally {
      setBriefing(false);
    }
  }, [src]);

  const runElevate = useCallback(async () => {
    if (!src) return;
    setElevating(true);
    setElevateErr(null);
    setElevated(null);
    setSavedNote(null);
    try {
      const { imageBase64 } = await elevateSource({
        imageBase64: src.dataUrl,
        improvements: brief?.improvements,
        model,
        quality,
      });
      setElevated(imageBase64);
      // Save as a gallery SOURCE so V2/V3 can pick it as their reference.
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const source: SourceImage = {
        id: crypto.randomUUID(),
        imageUrl: imageBase64,
        fileName: `elevated-${stamp}.png`,
        uploadedAt: new Date().toISOString(),
      };
      try {
        // "elevated" (not "source") so the gallery can badge it honestly as
        // AI-elevated rather than "Uploaded" — it stays in the same group and
        // remains pickable everywhere a source is.
        await saveSource(source, "elevated");
        setSavedNote("Saved to gallery as a source — pick it in Bench V2 / V3.");
      } catch {
        setSavedNote("Generated, but saving to the gallery failed.");
      }
    } catch (err) {
      setElevateErr(err instanceof Error ? err.message : String(err));
    } finally {
      setElevating(false);
    }
  }, [src, brief, model, quality]);

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">Bench S</h1>
              <span className="rounded-md bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-700/40">
                source generation
              </span>
            </div>
            <p className="max-w-2xl text-sm text-zinc-400">
              Upstream of the icon benches: turn a bland <strong className="text-zinc-200">source</strong>{" "}
              (your real screenshot/UI) into <strong className="text-zinc-200">source material</strong> —
              a style brief + an elevated, polished source image (identity preserved,
              not redesigned). The elevated image saves to the gallery, so{" "}
              <Link href="/bench-v2" className="text-cyan-400/80 hover:text-cyan-300">Bench V2</Link>{" "}
              can use it as its reference.
            </p>
          </div>

          {/* Step 1 — source input */}
          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-violet-400">1</span>
              <h2 className="text-lg font-semibold">Source</h2>
            </div>

            {!src ? (
              <div className="flex flex-col gap-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 px-6 py-10 text-center transition-colors hover:border-emerald-500/60"
                >
                  <span className="text-sm text-zinc-400">Click to browse</span>
                  <span className="text-xs text-zinc-600">PNG, JPEG, or WebP · max {IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-600">or</span>
                  <GalleryPicker onPick={onPick} />
                </div>
                {/* Deferred URL mode */}
                <div className="flex flex-col gap-1 rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-3 opacity-70">
                  <div className="flex items-center gap-2">
                    <input disabled placeholder="https://your-site.com  (URL → screenshot)" className="flex-1 cursor-not-allowed rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-500" />
                    <span className="rounded-md bg-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-400">deferred</span>
                  </div>
                  <span className="text-xs text-zinc-600">
                    Capture wired later (provider TBD). Modeled cost: ~{usd(SCREENSHOT_COST)}/shot — negligible vs the elevation model. See the cost panel below.
                  </span>
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
                  <img src={src.dataUrl} alt={src.fileName} className="max-h-48 rounded-xl border border-zinc-800 object-contain" />
                  <button type="button" onClick={clearSrc} aria-label="Remove image" className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs text-zinc-300 hover:border-red-500/60 hover:text-red-300">✕</button>
                </div>
                <div className="flex flex-col gap-1 text-sm">
                  <span className="text-zinc-300">{src.fileName}</span>
                  <button type="button" onClick={clearSrc} className="self-start text-xs text-zinc-500 hover:text-red-300">✕ Remove image</button>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={runBrief}
                disabled={!src || briefing}
                className="rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-300 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {briefing ? "Analyzing…" : "▸ Analyze style"}
              </button>
              <span className="text-xs text-zinc-500">
                {ANALYZE_MODEL} · est. {usd(briefCost)}
                {briefRan ? ` · ran ~${briefRan}` : ""}
              </span>
            </div>
            {briefErr && <p className="text-sm text-red-400">{briefErr}</p>}
          </section>

          {/* Step 2 — style brief */}
          {brief && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">2</span>
                <h2 className="text-lg font-semibold">Style brief</h2>
              </div>
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-300">{brief.summary}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Color palette" value={brief.colorPalette.join(", ")} />
                <Field label="Typography" value={brief.typography} />
                <Field label="Line style" value={brief.lineStyle} />
                <Field label="Shape language" value={brief.shapeLanguage} />
                <Field label="Mood" value={brief.mood.join(", ")} />
                <Field label="Strengths" value={brief.strengths.join(" · ")} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Improvements the elevation will target</span>
                <ul className="flex list-disc flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 pl-7 text-sm text-zinc-300">
                  {brief.improvements.map((imp, i) => <li key={i}>{imp}</li>)}
                </ul>
              </div>
            </section>
          )}

          {/* Step 3 — elevate */}
          {brief && (
            <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-violet-400">3</span>
                <h2 className="text-lg font-semibold">Elevate source</h2>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-xs uppercase tracking-widest text-zinc-500">Model</span>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200">
                    {IMAGE_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-xs uppercase tracking-widest text-zinc-500">Quality</span>
                  <select value={quality} onChange={(e) => setQuality(e.target.value as ImageQuality)} className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200">
                    {QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                </label>
                {getModel(model)?.status === "deprecated" && (
                  <span className="rounded bg-amber-900/30 px-2 py-0.5 text-[10px] text-amber-300">deprecated model</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={runElevate}
                  disabled={!src || elevating}
                  className="rounded-xl bg-emerald-500/15 px-4 py-2.5 text-sm font-medium text-emerald-200 ring-1 ring-emerald-500/40 transition-colors hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {elevating ? "Elevating…" : "▸ Elevate source"}
                </button>
                <span className="text-xs text-zinc-500">{model} {quality} · est. {usd(elevateCost)}</span>
              </div>
              {elevateErr && <p className="text-sm text-red-400">{elevateErr}</p>}

              {elevated && (
                <div className="flex flex-col gap-2 pt-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">Elevated source material</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={elevated} alt="elevated source" className="max-h-96 rounded-xl border border-zinc-800 object-contain" />
                  {savedNote && <p className="text-xs text-emerald-400/80">{savedNote}</p>}
                </div>
              )}
            </section>
          )}

          {/* Cost panel */}
          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold">Cost — image mode vs URL mode</h2>
            <p className="text-sm text-zinc-400">
              The elevation model is the whole cost; the screenshot is a rounding error,
              so the URL path is worthwhile on money — the real cost is owning a capture dependency.
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <span className="text-xs uppercase tracking-widest text-zinc-500">Image upload (live)</span>
                <span className="text-sm text-zinc-300">brief {usd(briefCost)} + elevate {usd(elevateCost)}</span>
                <span className="font-mono text-lg text-zinc-100">{usd(totalImageMode)}</span>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                <span className="text-xs uppercase tracking-widest text-zinc-500">URL → screenshot (deferred)</span>
                <span className="text-sm text-zinc-300">+ screenshot ~{usd(SCREENSHOT_COST)}</span>
                <span className="font-mono text-lg text-zinc-100">{usd(totalImageMode + SCREENSHOT_COST)}</span>
                <span className="text-[11px] text-zinc-600">+{Math.round((SCREENSHOT_COST / totalImageMode) * 100)}% — negligible</span>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                  <tr><th className="px-4 py-2 font-medium">Elevation model</th><th className="px-4 py-2 font-medium">low</th><th className="px-4 py-2 font-medium">medium</th><th className="px-4 py-2 font-medium">high</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {IMAGE_MODELS.map((m) => (
                    <tr key={m} className={`text-zinc-300 ${m === model ? "bg-emerald-950/20" : ""}`}>
                      <td className="px-4 py-2 font-mono text-xs">{m}</td>
                      {QUALITIES.map((q) => (
                        <td key={q} className="px-4 py-2 font-mono text-xs">{usd(imageCostUSD(m, q, 1))}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-600">Per elevated source (1 image). Style brief adds {usd(briefCost)} either way.</p>
          </section>
        </div>
      </main>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-300">{value || "—"}</span>
    </div>
  );
}
