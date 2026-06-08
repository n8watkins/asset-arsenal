"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ICON_ANALYSIS_PROMPT,
  buildPromptPackPrompt,
  buildIconGenerationPrompt,
} from "@/lib/icon/prompts";
import { analyzeImage, fetchPrompts, generateOneIcon } from "@/lib/icon/client-api";
import { readImageFile } from "@/lib/icon/download";
import { SAMPLE_MANIFEST, SAMPLE_PROMPT_PACK } from "@/lib/icon/fixtures";
import type { IconManifest, IconPrompt, GeneratedIcon } from "@/types/icon-pipeline";
import PromptDisclosure from "@/components/icon-pipeline/PromptDisclosure";
import GalleryView from "@/components/gallery/GalleryView";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function RawJson({ data }: { data: unknown }) {
  return (
    <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-zinc-300 font-mono overflow-auto max-h-96 whitespace-pre-wrap break-words">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-red-400 text-sm font-mono bg-red-950/30 border border-red-800/40 rounded-lg px-3 py-2">
      {msg}
    </p>
  );
}

function SectionCard({
  title,
  num,
  children,
}: {
  title: string;
  num: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-violet-400 font-mono text-sm font-bold bg-violet-900/30 border border-violet-700/40 rounded-lg px-2 py-0.5">
          §{num}
        </span>
        <h2 className="text-zinc-100 text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function RunButton({
  onClick,
  busy,
  disabled,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold py-2 px-5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 flex items-center gap-2 self-start"
    >
      {busy ? (
        <>
          <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
          Running…
        </>
      ) : (
        "Run"
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section 1 — Icon Analysis
// ---------------------------------------------------------------------------

function Section1({
  externalImage,
}: {
  /** An image chosen from the gallery, fed in from BenchPage. */
  externalImage?: { dataUrl: string; fileName?: string } | null;
}) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (f: File) => {
    setFile(f);
    setFileName(f.name);
    setResult(null);
    setError(null);
    const { dataUrl: url } = await readImageFile(f);
    setDataUrl(url);
    setPreview(url);
  }, []);

  // When the gallery feeds an image in, adopt it as the analysis image.
  useEffect(() => {
    if (!externalImage) return;
    setFile(null);
    setFileName(externalImage.fileName ?? "gallery-image");
    setDataUrl(externalImage.dataUrl);
    setPreview(externalImage.dataUrl);
    setResult(null);
    setError(null);
  }, [externalImage]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f && f.type.startsWith("image/")) loadFile(f);
    },
    [loadFile],
  );

  const run = async () => {
    if (!dataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await analyzeImage(dataUrl, fileName ?? undefined);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Icon Analysis" num={1}>
      {/* Prompt disclosure */}
      <PromptDisclosure
        label="View exact prompt sent to vision model"
        prompt={ICON_ANALYSIS_PROMPT}
        defaultOpen
      />
      <p className="text-zinc-500 text-xs italic">
        + the uploaded image is sent as image input alongside this prompt
      </p>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragging
            ? "border-cyan-500 bg-cyan-950/20"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/30"
        }`}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="preview"
            className="max-h-40 max-w-full rounded-lg object-contain"
          />
        ) : (
          <p className="text-zinc-500 text-sm text-center">
            Drag & drop an image here, or click to browse
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
          }}
        />
      </div>

      {fileName && (
        <p className="text-zinc-400 text-xs font-mono">
          {fileName}
          {file ? ` (${Math.round(file.size / 1024)} KB)` : " (from gallery)"}
        </p>
      )}

      <RunButton onClick={run} busy={busy} disabled={!dataUrl} />

      {error && <ErrorMsg msg={error} />}
      {result && <RawJson data={result} />}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 2 — Prompt Pack
// ---------------------------------------------------------------------------

function Section2() {
  const [manifestText, setManifestText] = useState(
    () => JSON.stringify(SAMPLE_MANIFEST, null, 2),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<IconManifest>(SAMPLE_MANIFEST);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resolvedPrompt = buildPromptPackPrompt(parsed.iconFamilyStyle, manifestText);

  const handleChange = (text: string) => {
    setManifestText(text);
    try {
      const p = JSON.parse(text) as IconManifest;
      setParsed(p);
      setParseError(null);
    } catch {
      setParseError("Invalid JSON — fix before running.");
    }
  };

  const run = async () => {
    if (parseError) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchPrompts(parsed);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Prompt Pack" num={2}>
      {/* Live-resolved prompt disclosure */}
      <PromptDisclosure
        label="View exact prompt sent to prompt-writer model (live)"
        prompt={resolvedPrompt}
        defaultOpen
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs font-medium uppercase tracking-wide">
          Icon Manifest JSON (editable)
        </label>
        <textarea
          value={manifestText}
          onChange={(e) => handleChange(e.target.value)}
          rows={14}
          spellCheck={false}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-200 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full"
        />
        {parseError && <p className="text-red-400 text-xs">{parseError}</p>}
      </div>

      <RunButton onClick={run} busy={busy} disabled={!!parseError} />

      {error && <ErrorMsg msg={error} />}
      {result && <RawJson data={result} />}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 3 — Single Icon
// ---------------------------------------------------------------------------

function Section3() {
  const icons = SAMPLE_MANIFEST.icons;
  const [selectedId, setSelectedId] = useState(icons[0].id);
  const [promptText, setPromptText] = useState<string>(() => {
    const match = SAMPLE_PROMPT_PACK.prompts.find(
      (p) => p.iconId === icons[0].id,
    );
    return match?.prompt ?? "";
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ generatedIcon: GeneratedIcon } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  // When the select changes, prefill from SAMPLE_PROMPT_PACK
  const handleSelectChange = (id: string) => {
    setSelectedId(id);
    const match = SAMPLE_PROMPT_PACK.prompts.find((p) => p.iconId === id);
    setPromptText(match?.prompt ?? "");
    setResult(null);
    setError(null);
  };

  const selectedIcon = icons.find((i) => i.id === selectedId)!;
  const samplePromptEntry = SAMPLE_PROMPT_PACK.prompts.find(
    (p) => p.iconId === selectedId,
  )!;

  const resolvedPrompt = buildIconGenerationPrompt(
    SAMPLE_MANIFEST.iconFamilyStyle,
    promptText,
  );

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    const iconPrompt: IconPrompt = {
      ...samplePromptEntry,
      prompt: promptText,
    };
    try {
      const res = await generateOneIcon({
        icon: selectedIcon,
        prompt: iconPrompt,
        iconFamilyStyle: SAMPLE_MANIFEST.iconFamilyStyle,
      });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Single Icon Generation" num={3}>
      {/* Live-resolved prompt disclosure */}
      <PromptDisclosure
        label="View full prompt sent to image model (live — this is the wrapper actually sent)"
        prompt={resolvedPrompt}
        defaultOpen
      />

      {/* Icon selector */}
      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs font-medium uppercase tracking-wide">
          Pick an icon
        </label>
        <select
          value={selectedId}
          onChange={(e) => handleSelectChange(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {icons.map((icon) => (
            <option key={icon.id} value={icon.id}>
              {icon.name} ({icon.id})
            </option>
          ))}
        </select>
      </div>

      {/* Editable prompt */}
      <div className="flex flex-col gap-1.5">
        <label className="text-zinc-400 text-xs font-medium uppercase tracking-wide">
          Icon-specific prompt (editable)
        </label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={4}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-200 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full"
        />
      </div>

      <RunButton onClick={run} busy={busy} />

      {error && <ErrorMsg msg={error} />}
      {result && (
        <div className="flex flex-col gap-3">
          {result.generatedIcon?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.generatedIcon.imageUrl}
              alt={result.generatedIcon.iconName}
              className="w-32 h-32 rounded-xl border border-zinc-700 object-contain bg-zinc-800/50"
            />
          )}
          <RawJson data={result} />
        </div>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Section 4 — Batch
// ---------------------------------------------------------------------------

function Section4() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate-icons-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manifest: SAMPLE_MANIFEST,
          promptPack: SAMPLE_PROMPT_PACK,
        }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Request failed.",
        );
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const iconCount = Array.isArray(result?.generatedIcons)
    ? (result.generatedIcons as unknown[]).length
    : null;

  return (
    <SectionCard title="Batch Icon Generation" num={4}>
      <p className="text-zinc-400 text-sm">
        POSTs <code className="text-cyan-400 font-mono text-xs">/api/generate-icons-batch</code>{" "}
        with <code className="text-cyan-400 font-mono text-xs">SAMPLE_MANIFEST</code> +{" "}
        <code className="text-cyan-400 font-mono text-xs">SAMPLE_PROMPT_PACK</code> ({SAMPLE_MANIFEST.icons.length} icons).
        The server builds per-icon wrapped prompts internally via{" "}
        <code className="text-cyan-400 font-mono text-xs">buildIconGenerationPrompt</code>.
      </p>

      <RunButton onClick={run} busy={busy} />

      {error && <ErrorMsg msg={error} />}
      {iconCount !== null && (
        <p className="text-cyan-400 text-sm font-mono">
          Returned {iconCount} generated icon{iconCount !== 1 ? "s" : ""}.
        </p>
      )}
      {result && <RawJson data={result} />}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BenchPage() {
  // Image chosen from the gallery, fed into Section 1's analysis step.
  // A fresh object each click guarantees the effect in Section1 re-runs even
  // if the same image is picked twice.
  const [analysisImage, setAnalysisImage] = useState<{
    dataUrl: string;
    fileName?: string;
  } | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        {/* Title */}
        <div className="flex flex-col gap-1">
          <Link
            href="/"
            className="self-start font-mono text-xs text-cyan-400/80 hover:text-cyan-300"
          >
            ← back to app
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">
            Test Bench
          </h1>
          <p className="text-zinc-500 text-sm">
            Developer endpoint tester for the Asset Arsenal icon pipeline.
            Each section shows the <span className="text-cyan-400">exact resolved prompt</span> before you run.
          </p>
        </div>

        {/* Bench-centric image gallery */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
          <GalleryView
            title="Image Gallery"
            onUseImage={(img) =>
              setAnalysisImage({
                dataUrl: img.dataUrl,
                fileName: img.fileName,
              })
            }
          />
          <p className="text-zinc-500 text-xs">
            Click <span className="text-violet-400">Use</span> on any image to
            send it to Section 1 below for analysis.
          </p>
        </section>

        <Section1 externalImage={analysisImage} />
        <Section2 />
        <Section3 />
        <Section4 />
      </div>
    </main>
  );
}
