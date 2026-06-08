"use client";

import { useState, useRef, useCallback } from "react";
import {
  ICON_ANALYSIS_PROMPT,
  buildCollectionPromptComposer,
  buildCollectionImageBody,
  buildIndividualPromptComposer,
  buildIconGenerationWrapper,
} from "@/lib/icon/prompts";
import {
  analyzeImage,
  composeCollectionPrompt,
  generateCollectionImage,
  composeIndividualPrompts,
  generateOneIcon,
  generateIconsBatch,
} from "@/lib/icon/client-api";
import { readImageFile } from "@/lib/icon/download";
import {
  SAMPLE_MANIFEST,
  SAMPLE_COLLECTION_PROMPT,
  SAMPLE_INDIVIDUAL_PROMPTS,
} from "@/lib/icon/fixtures";
import type {
  IconManifest,
  IndividualIconPrompts,
  GeneratedIcon,
} from "@/types/icon-pipeline";
import PromptDisclosure from "@/components/icon-pipeline/PromptDisclosure";
import GalleryPicker from "@/components/gallery/GalleryPicker";
import Nav from "@/components/Nav";
import { MODEL_ROLES } from "@/lib/icon/models";

// ---------------------------------------------------------------------------
// Shared bench artifacts — each step's output is lifted here so the next step
// can consume it. Every step is still independently runnable / rerunnable.
// ---------------------------------------------------------------------------

type BenchState = {
  sourceDataUrl: string | null;
  sourceFileName: string | null;
  manifest: IconManifest | null;
  collectionPrompt: string | null;
  collectionImageDataUrl: string | null;
  individualPrompts: IndividualIconPrompts | null;
};

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function RawJson({ data }: { data: unknown }) {
  return (
    <pre className="bg-zinc-950 border border-zinc-800 rounded-xl p-5 text-sm text-zinc-300 font-mono overflow-auto max-h-96 whitespace-pre-wrap break-words">
      {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-red-400 text-sm font-mono bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3">
      {msg}
    </p>
  );
}

function FlowBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 font-mono text-xs ${
        ok
          ? "bg-emerald-900/40 text-emerald-300 border border-emerald-700/40"
          : "bg-zinc-800 text-zinc-500 border border-zinc-700"
      }`}
    >
      {ok ? "✓ " : "• "}
      {label}
    </span>
  );
}

// Labeled output panel — shown in every section regardless of whether a run has happened.
function OutputPanel({
  children,
  empty,
}: {
  children?: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-700/60 bg-zinc-950/60 p-5">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        Output
      </span>
      {empty ? (
        <p className="text-zinc-600 text-sm italic">
          Run this step to see output here.
        </p>
      ) : (
        children
      )}
    </div>
  );
}

function SectionCard({
  title,
  num,
  inputs,
  output,
  model,
  children,
}: {
  title: string;
  num: number;
  inputs: string;
  output: string;
  model: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex flex-col gap-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-violet-400 font-mono text-sm font-bold bg-violet-900/30 border border-violet-700/40 rounded-lg px-2.5 py-1">
          §{num}
        </span>
        <h2 className="text-zinc-100 text-xl font-semibold">{title}</h2>
        <span className="ml-auto font-mono text-xs text-cyan-300/80 bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1">
          model: {model}
        </span>
      </div>
      <p className="text-zinc-500 text-sm font-mono">
        <span className="text-zinc-400">in:</span> {inputs}{"  "}
        <span className="text-zinc-400">→ out:</span> {output}
      </p>
      {children}
    </section>
  );
}

function RunButton({
  onClick,
  busy,
  disabled,
  label = "Run",
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold py-2.5 px-6 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 flex items-center gap-2 self-start text-sm"
    >
      {busy ? (
        <>
          <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
          Running…
        </>
      ) : (
        label
      )}
    </button>
  );
}

// Reusable image input: upload from disk, drop, or pick from the gallery.
// Reports the chosen data URL up to the parent.
function ImageInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null, fileName: string | null) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (f: File) => {
      const { dataUrl } = await readImageFile(f);
      onChange(dataUrl, f.name);
    },
    [onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-zinc-400">{label}</span>
        <GalleryPicker
          onPick={(img) => onChange(img.dataUrl, img.fileName)}
          label="Choose from gallery"
          className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-cyan-400/80 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <span className="text-sm text-zinc-600">or drop / browse below</span>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f && f.type.startsWith("image/")) load(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragging
            ? "border-cyan-500 bg-cyan-950/20"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/30"
        }`}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="preview"
            className="max-h-40 max-w-full rounded-lg object-contain"
          />
        ) : (
          <p className="text-zinc-500 text-sm text-center">
            Drag &amp; drop an image, or click to browse
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) load(f);
          }}
        />
      </div>
    </div>
  );
}

// JSON textarea with live parse feedback.
function JsonEditor<T>({
  label,
  text,
  onTextChange,
  parseError,
}: {
  label: string;
  text: string;
  onTextChange: (text: string) => void;
  parseError: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">
        {label}
      </label>
      <textarea
        value={text}
        onChange={(e) => onTextChange(e.target.value)}
        rows={12}
        spellCheck={false}
        className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full"
      />
      {parseError && <p className="text-red-400 text-sm">{parseError}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// §1 — Analyze
// ---------------------------------------------------------------------------

function Section1({
  state,
  patch,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IconManifest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!state.sourceDataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { manifest } = await analyzeImage(
        state.sourceDataUrl,
        state.sourceFileName ?? undefined,
      );
      setResult(manifest);
      patch({ manifest });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Analyze"
      num={1}
      inputs="source image"
      output="icon manifest JSON"
      model={MODEL_ROLES.visionAnalyzerModel}
    >
      <PromptDisclosure
        label="View exact prompt sent to vision model"
        prompt={ICON_ANALYSIS_PROMPT}
      />
      <p className="text-zinc-500 text-sm italic">
        + the source image is sent as image input alongside this prompt
      </p>
      <ImageInput
        label="Source image:"
        value={state.sourceDataUrl}
        onChange={(dataUrl, fileName) =>
          patch({ sourceDataUrl: dataUrl, sourceFileName: fileName })
        }
      />
      <RunButton onClick={run} busy={busy} disabled={!state.sourceDataUrl} />
      <OutputPanel empty={!error && !result}>
        {error && <ErrorMsg msg={error} />}
        {result && <RawJson data={result} />}
      </OutputPanel>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §2 — Compose collection prompt
// ---------------------------------------------------------------------------

function Section2({
  state,
  patch,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
}) {
  const [manifestText, setManifestText] = useState(() =>
    JSON.stringify(state.manifest ?? SAMPLE_MANIFEST, null, 2),
  );
  const [parsed, setParsed] = useState<IconManifest>(
    state.manifest ?? SAMPLE_MANIFEST,
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const syncFromState = () => {
    if (!state.manifest) return;
    const text = JSON.stringify(state.manifest, null, 2);
    setManifestText(text);
    setParsed(state.manifest);
    setParseError(null);
  };

  const handleChange = (text: string) => {
    setManifestText(text);
    try {
      setParsed(JSON.parse(text) as IconManifest);
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
      const { collectionPrompt } = await composeCollectionPrompt(parsed);
      setResult(collectionPrompt);
      patch({ collectionPrompt });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Compose collection prompt"
      num={2}
      inputs="icon manifest JSON"
      output="collection image prompt (text)"
      model={MODEL_ROLES.collectionPromptModel}
    >
      <PromptDisclosure
        label="View exact prompt sent to composer (live)"
        prompt={buildCollectionPromptComposer(manifestText)}
      />
      <button
        onClick={syncFromState}
        disabled={!state.manifest}
        className="self-start text-sm text-cyan-400/80 hover:text-cyan-300 disabled:opacity-40 disabled:pointer-events-none"
      >
        ↑ pull manifest from §1
      </button>
      <JsonEditor
        label="Icon Manifest JSON (editable)"
        text={manifestText}
        onTextChange={handleChange}
        parseError={parseError}
      />
      <RunButton onClick={run} busy={busy} disabled={!!parseError} />
      <OutputPanel empty={!error && !result}>
        {error && <ErrorMsg msg={error} />}
        {result && <RawJson data={result} />}
      </OutputPanel>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §3 — Generate collection image (contact sheet)
// ---------------------------------------------------------------------------

function Section3({
  state,
  patch,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
}) {
  const [manifestText, setManifestText] = useState(() =>
    JSON.stringify(state.manifest ?? SAMPLE_MANIFEST, null, 2),
  );
  const [parsed, setParsed] = useState<IconManifest>(
    state.manifest ?? SAMPLE_MANIFEST,
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [promptText, setPromptText] = useState(
    state.collectionPrompt ?? SAMPLE_COLLECTION_PROMPT,
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleManifest = (text: string) => {
    setManifestText(text);
    try {
      setParsed(JSON.parse(text) as IconManifest);
      setParseError(null);
    } catch {
      setParseError("Invalid JSON — fix before running.");
    }
  };

  const pull = () => {
    if (state.manifest) {
      setManifestText(JSON.stringify(state.manifest, null, 2));
      setParsed(state.manifest);
      setParseError(null);
    }
    if (state.collectionPrompt) setPromptText(state.collectionPrompt);
  };

  const run = async () => {
    if (parseError || !state.sourceDataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { collectionImage } = await generateCollectionImage({
        sourceImageBase64: state.sourceDataUrl,
        manifest: parsed,
        collectionPrompt: promptText,
      });
      setResult(collectionImage.imageUrl);
      patch({ collectionImageDataUrl: collectionImage.imageUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Generate collection image"
      num={3}
      inputs="source image + manifest + collection prompt"
      output="contact sheet image"
      model={MODEL_ROLES.collectionImageModel}
    >
      <PromptDisclosure
        label="View exact body sent to image model (live)"
        prompt={buildCollectionImageBody(manifestText, promptText)}
      />
      <button
        onClick={pull}
        className="self-start text-sm text-cyan-400/80 hover:text-cyan-300"
      >
        ↑ pull manifest from §1 + prompt from §2
      </button>
      <ImageInput
        label="Source image (reference):"
        value={state.sourceDataUrl}
        onChange={(dataUrl, fileName) =>
          patch({ sourceDataUrl: dataUrl, sourceFileName: fileName })
        }
      />
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">
          Collection prompt (editable)
        </label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={5}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full"
        />
      </div>
      <JsonEditor
        label="Icon Manifest JSON (editable)"
        text={manifestText}
        onTextChange={handleManifest}
        parseError={parseError}
      />
      <RunButton
        onClick={run}
        busy={busy}
        disabled={!!parseError || !state.sourceDataUrl}
      />
      {!state.sourceDataUrl && (
        <p className="text-zinc-500 text-sm">Provide a source image first.</p>
      )}
      <OutputPanel empty={!error && !result}>
        {error && <ErrorMsg msg={error} />}
        {result && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={result}
            alt="contact sheet"
            className="w-full rounded-xl border border-zinc-700 object-contain bg-zinc-950"
          />
        )}
      </OutputPanel>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §4 — Compose individual prompts
// ---------------------------------------------------------------------------

function Section4({
  state,
  patch,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
}) {
  const [manifestText, setManifestText] = useState(() =>
    JSON.stringify(state.manifest ?? SAMPLE_MANIFEST, null, 2),
  );
  const [parsed, setParsed] = useState<IconManifest>(
    state.manifest ?? SAMPLE_MANIFEST,
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IndividualIconPrompts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleManifest = (text: string) => {
    setManifestText(text);
    try {
      setParsed(JSON.parse(text) as IconManifest);
      setParseError(null);
    } catch {
      setParseError("Invalid JSON — fix before running.");
    }
  };

  const pull = () => {
    if (state.manifest) {
      setManifestText(JSON.stringify(state.manifest, null, 2));
      setParsed(state.manifest);
      setParseError(null);
    }
  };

  const run = async () => {
    if (parseError || !state.collectionImageDataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { individualPrompts } = await composeIndividualPrompts({
        collectionImageBase64: state.collectionImageDataUrl,
        manifest: parsed,
      });
      setResult(individualPrompts);
      patch({ individualPrompts });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Compose individual prompts"
      num={4}
      inputs="contact sheet + manifest"
      output="sharedStylePrompt + one prompt per icon"
      model={MODEL_ROLES.individualPromptModel}
    >
      <PromptDisclosure
        label="View exact prompt sent to composer (live)"
        prompt={buildIndividualPromptComposer(manifestText)}
      />
      <p className="text-zinc-500 text-sm italic">
        + the contact sheet (§3) is sent as image input alongside this prompt
      </p>
      <button
        onClick={pull}
        disabled={!state.manifest}
        className="self-start text-sm text-cyan-400/80 hover:text-cyan-300 disabled:opacity-40 disabled:pointer-events-none"
      >
        ↑ pull manifest from §1
      </button>
      <ImageInput
        label="Contact sheet (style reference):"
        value={state.collectionImageDataUrl}
        onChange={(dataUrl) => patch({ collectionImageDataUrl: dataUrl })}
      />
      <JsonEditor
        label="Icon Manifest JSON (editable)"
        text={manifestText}
        onTextChange={handleManifest}
        parseError={parseError}
      />
      <RunButton
        onClick={run}
        busy={busy}
        disabled={!!parseError || !state.collectionImageDataUrl}
      />
      {!state.collectionImageDataUrl && (
        <p className="text-zinc-500 text-sm">Generate or provide a contact sheet first (§3).</p>
      )}
      <OutputPanel empty={!error && !result}>
        {error && <ErrorMsg msg={error} />}
        {result && <RawJson data={result} />}
      </OutputPanel>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §5 — Generate one icon
// ---------------------------------------------------------------------------

function Section5({ state }: { state: BenchState }) {
  const prompts = state.individualPrompts ?? SAMPLE_INDIVIDUAL_PROMPTS;
  const [selectedId, setSelectedId] = useState(prompts.iconPrompts[0]?.iconId);
  const [sharedStyle, setSharedStyle] = useState(prompts.sharedStylePrompt);
  const selected =
    prompts.iconPrompts.find((p) => p.iconId === selectedId) ??
    prompts.iconPrompts[0];
  const [promptText, setPromptText] = useState(selected?.prompt ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedIcon | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSelect = (id: string) => {
    setSelectedId(id);
    const match = prompts.iconPrompts.find((p) => p.iconId === id);
    setPromptText(match?.prompt ?? "");
    setResult(null);
    setError(null);
  };

  const resolvedWrapper = buildIconGenerationWrapper({
    sharedStylePrompt: sharedStyle,
    iconName: selected?.iconName ?? "",
    iconConcept: selected?.concept ?? "",
    iconPrompt: promptText,
  });

  const run = async () => {
    if (!state.collectionImageDataUrl || !selected) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { generatedIcon } = await generateOneIcon({
        collectionImageBase64: state.collectionImageDataUrl,
        sharedStylePrompt: sharedStyle,
        iconPrompt: { ...selected, prompt: promptText },
      });
      setResult(generatedIcon);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title="Generate one icon"
      num={5}
      inputs="contact sheet + sharedStylePrompt + one icon prompt"
      output="single icon image"
      model={MODEL_ROLES.imageGeneratorModel}
    >
      <PromptDisclosure
        label="View full wrapper sent to image model (live)"
        prompt={resolvedWrapper}
      />
      <p className="text-zinc-500 text-sm italic">
        + the contact sheet (§3) is attached as the style reference
      </p>
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">
          Pick an icon
        </label>
        <select
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {prompts.iconPrompts.map((p) => (
            <option key={p.iconId} value={p.iconId}>
              {p.iconName} ({p.iconId})
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">
          sharedStylePrompt (editable)
        </label>
        <textarea
          value={sharedStyle}
          onChange={(e) => setSharedStyle(e.target.value)}
          rows={3}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full"
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-zinc-400 text-sm font-medium uppercase tracking-wide">
          Icon-specific prompt (editable)
        </label>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          rows={4}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-200 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full"
        />
      </div>
      <RunButton onClick={run} busy={busy} disabled={!state.collectionImageDataUrl} />
      {!state.collectionImageDataUrl && (
        <p className="text-zinc-500 text-sm">A contact sheet (§3) is required as the reference.</p>
      )}
      <OutputPanel empty={!error && !result}>
        {error && <ErrorMsg msg={error} />}
        {result && (
          <div className="flex flex-col gap-4">
            {result.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl}
                alt={result.iconName}
                className="w-32 h-32 rounded-xl border border-zinc-700 object-contain bg-zinc-800/50"
              />
            )}
            <RawJson data={result} />
          </div>
        )}
      </OutputPanel>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §6 — Generate batch
// ---------------------------------------------------------------------------

function Section6({ state }: { state: BenchState }) {
  const prompts = state.individualPrompts ?? SAMPLE_INDIVIDUAL_PROMPTS;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedIcon[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!state.collectionImageDataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { generatedIcons } = await generateIconsBatch({
        collectionImageBase64: state.collectionImageDataUrl,
        individualPrompts: prompts,
      });
      setResult(generatedIcons);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const okCount = result?.filter((g) => g.status === "success").length ?? 0;

  return (
    <SectionCard
      title="Generate batch"
      num={6}
      inputs="contact sheet + all icon prompts"
      output="all generated icons"
      model={MODEL_ROLES.imageGeneratorModel}
    >
      <p className="text-zinc-400 text-sm">
        Generates every icon in{" "}
        {state.individualPrompts ? "§4's output" : "the sample prompt set"} (
        {prompts.iconPrompts.length} icons), each using the contact sheet as the
        reference.
      </p>
      <RunButton onClick={run} busy={busy} disabled={!state.collectionImageDataUrl} />
      {!state.collectionImageDataUrl && (
        <p className="text-zinc-500 text-sm">A contact sheet (§3) is required as the reference.</p>
      )}
      <OutputPanel empty={!error && !result}>
        {error && <ErrorMsg msg={error} />}
        {result && (
          <>
            <p className="text-cyan-400 text-sm font-mono">
              {okCount}/{result.length} succeeded.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {result.map((g) => (
                <div
                  key={g.id}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl p-2 flex flex-col gap-2"
                >
                  <div className="aspect-square flex items-center justify-center bg-zinc-900 rounded-lg">
                    {g.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.imageUrl}
                        alt={g.iconName}
                        className="w-full h-full object-contain p-2"
                      />
                    ) : (
                      <span className="text-red-400 text-sm px-2 text-center">
                        {g.error ?? "failed"}
                      </span>
                    )}
                  </div>
                  <span className="text-zinc-300 text-sm truncate">{g.iconName}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </OutputPanel>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BenchPage() {
  const [state, setState] = useState<BenchState>({
    sourceDataUrl: null,
    sourceFileName: null,
    manifest: null,
    collectionPrompt: null,
    collectionImageDataUrl: null,
    individualPrompts: null,
  });

  const patch = useCallback(
    (p: Partial<BenchState>) => setState((s) => ({ ...s, ...p })),
    [],
  );

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10">
        <div className="max-w-4xl mx-auto flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-zinc-100">Test Bench</h1>
            <p className="text-zinc-400 text-base">
              Each step in the icon pipeline as an independent, rerunnable
              breakpoint. Edit any input, view the{" "}
              <span className="text-cyan-400">exact resolved prompt</span> before
              you run, and feed each step&apos;s output into the next.
            </p>
            {/* Artifact flow indicator */}
            <div className="mt-3 flex flex-wrap gap-2">
              <FlowBadge ok={!!state.sourceDataUrl} label="source" />
              <FlowBadge ok={!!state.manifest} label="manifest" />
              <FlowBadge ok={!!state.collectionPrompt} label="collection prompt" />
              <FlowBadge ok={!!state.collectionImageDataUrl} label="contact sheet" />
              <FlowBadge ok={!!state.individualPrompts} label="icon prompts" />
            </div>
          </div>

          <Section1 state={state} patch={patch} />
          <Section2 state={state} patch={patch} />
          <Section3 state={state} patch={patch} />
          <Section4 state={state} patch={patch} />
          <Section5 state={state} />
          <Section6 state={state} />
        </div>
      </main>
    </>
  );
}
