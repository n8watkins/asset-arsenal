"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
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
import PipelineOutline from "@/components/bench/PipelineOutline";
import { OutputTabs, InterpretedResult } from "@/components/bench/interpreted";
import {
  type Stack,
  DEFAULT_STACK,
  type StepKey,
  STEPS,
  costForStep,
  getModel,
  imageCostUSD,
  realizedTextCostUSD,
} from "@/lib/icon/model-reference";
import { loadStacks } from "@/lib/icon/stacks";
import { persistBenchIcons, persistBenchCollectionImage } from "@/lib/icon/bench-persist";
import type { TokenUsage } from "@/types/icon-pipeline";

function fmtUsd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

// Estimated cost label for a bench section, given the selected stack.
// `single` = the §5 case (one icon) vs §6 (the whole batch).
// `batchCount` overrides the stack's nominal iconCount with the real batch size
// (e.g. §4's actual prompt count) so the estimate matches what would be spent.
function stepCostLabel(
  stepKey: StepKey,
  stack: Stack,
  single = false,
  batchCount?: number,
): string {
  if (single && stepKey === "generateIcons") {
    const per = getModel(stack.models.generateIcons)?.imagePricing?.[stack.quality.generateIcons] ?? 0;
    return `${fmtUsd(per)} / icon`;
  }
  const step = STEPS.find((s) => s.key === stepKey)!;
  const effStack: Stack =
    stepKey === "generateIcons" && batchCount != null
      ? { ...stack, iconCount: batchCount }
      : stack;
  const { cost } = costForStep(step, effStack);
  if (stepKey === "generateIcons") return `${fmtUsd(cost)} · ${effStack.iconCount} icons`;
  return fmtUsd(cost);
}

// Realized cost from a text call's reported token usage (null if not reported).
function realizedTextLabel(model: string, usage?: TokenUsage): string | null {
  if (!usage) return null;
  return fmtUsd(realizedTextCostUSD(model, usage));
}

// ---------------------------------------------------------------------------
// Shared bench artifacts — each step's output is lifted here so the next step
// can consume it. Every step is still independently runnable / rerunnable.
// ---------------------------------------------------------------------------

type BenchState = {
  stack: Stack;
  sourceDataUrl: string | null;
  sourceFileName: string | null;
  manifest: IconManifest | null;
  collectionPrompt: string | null;
  collectionImageDataUrl: string | null;
  individualPrompts: IndividualIconPrompts | null;
  // Batch icons from the most recent run (manual §6 or a chain cascade), shared
  // so §6 reflects whatever last produced them.
  generatedIcons: GeneratedIcon[] | null;
  // Cap on how many icons to compose prompts for (null = all). Applied at §4 so
  // the request itself only asks for N — not compose-all-then-pick.
  iconLimit: number | null;
};

// Truncate a manifest to its first N icons so §4 composes only N prompts
// (cheaper, and the model can't overproduce). null/0 or N ≥ all → unchanged.
function limitManifest(manifest: IconManifest, limit: number | null): IconManifest {
  if (!limit || limit >= manifest.icons.length) return manifest;
  const icons = manifest.icons.slice(0, limit);
  return { ...manifest, icons, iconCount: icons.length };
}

// The five paid steps in chain order. A "run to §N" cascade executes these in
// sequence from the source image up to (and including) the chosen target.
const CHAIN_ORDER: StepKey[] = [
  "analyze",
  "collectionPrompt",
  "collectionImage",
  "individualPrompts",
  "generateIcons",
];

const CHAIN_LABEL: Record<StepKey, string> = {
  analyze: "§1 manifest",
  collectionPrompt: "§2 collection prompt",
  collectionImage: "§3 collection image",
  individualPrompts: "§4 icon prompts",
  generateIcons: "§5 icons",
};

// Section number (1-indexed) for a chain step.
function stepNum(step: StepKey): number {
  return CHAIN_ORDER.indexOf(step) + 1;
}

// What a chain run needs already present to *begin* at a given step. Returns a
// friendly message naming the missing artifact, or null if the start is valid.
// Upstream steps are skipped, so their outputs must already live in shared state
// (from an earlier run, a manual section, or a pasted/pulled value).
function missingForStart(step: StepKey, s: BenchState): string | null {
  switch (step) {
    case "analyze":
      return s.sourceDataUrl ? null : "§1 needs a source image — add one below.";
    case "collectionPrompt":
      return s.manifest ? null : "Starting at §2 needs a manifest (run §1 first).";
    case "collectionImage":
      if (!s.sourceDataUrl) return "Starting at §3 needs a source image (§1).";
      if (!s.manifest) return "Starting at §3 needs a manifest (§1).";
      if (!s.collectionPrompt) return "Starting at §3 needs a collection prompt (§2).";
      return null;
    case "individualPrompts":
      if (!s.collectionImageDataUrl) return "Starting at §4 needs a collection image (§3).";
      if (!s.manifest) return "Starting at §4 needs a manifest (§1).";
      return null;
    case "generateIcons":
      if (!s.collectionImageDataUrl) return "Starting at §5 needs a collection image (§3).";
      if (!s.individualPrompts) return "Starting at §5 needs icon prompts (§4).";
      return null;
  }
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="text-red-400 text-sm font-mono bg-red-950/30 border border-red-800/40 rounded-lg px-4 py-3">
      {msg}
    </p>
  );
}

function SectionCard({
  title,
  num,
  inputs,
  output,
  model,
  cost,
  realized,
  children,
}: {
  title: string;
  num: number;
  inputs: string;
  output: string;
  model: string;
  cost: string;
  realized?: string | null;
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
        <span
          className="font-mono text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1"
          title="Estimated cost for this step with the selected stack"
        >
          est {cost}
        </span>
        {realized && (
          <span
            className="font-mono text-xs text-emerald-300/90 bg-emerald-950/40 border border-emerald-800/40 rounded-md px-2.5 py-1"
            title="Actual realized cost from the last run"
          >
            actual {realized}
          </span>
        )}
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

  const clear = useCallback(() => {
    onChange(null, null);
    // Reset the file input so re-selecting the same file fires onChange again.
    if (inputRef.current) inputRef.current.value = "";
  }, [onChange]);

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
        {value && (
          <button
            type="button"
            onClick={clear}
            className="ml-auto rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-colors hover:border-red-700/60 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            ✕ Remove image
          </button>
        )}
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
        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragging
            ? "border-cyan-500 bg-cyan-950/20"
            : "border-zinc-700 hover:border-zinc-500 bg-zinc-800/30"
        }`}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt="preview"
              className="max-h-40 max-w-full rounded-lg object-contain"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                clear();
              }}
              title="Remove image"
              aria-label="Remove image"
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full border border-zinc-600 bg-zinc-900/80 text-zinc-300 transition-colors hover:border-red-600 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              ✕
            </button>
          </>
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
// Stack picker — selects which model + quality config every step runs with.
// ---------------------------------------------------------------------------

const STACK_STEPS: { key: StepKey; label: string }[] = [
  { key: "analyze", label: "§1 analyze" },
  { key: "collectionPrompt", label: "§2 collection prompt" },
  { key: "collectionImage", label: "§3 collection image" },
  { key: "individualPrompts", label: "§4 individual prompts" },
  { key: "generateIcons", label: "§5/6 generate icons" },
];

function StackPicker({
  stack,
  options,
  onSelect,
}: {
  stack: Stack;
  options: Stack[];
  onSelect: (name: string) => void;
}) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Stack
        </span>
        <select
          value={stack.name}
          onChange={(e) => onSelect(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {options.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </select>
        <Link
          href="/models"
          className="ml-auto text-sm font-medium text-cyan-400/80 hover:text-cyan-300"
        >
          build &amp; save stacks →
        </Link>
      </div>
      <div className="flex flex-wrap gap-2">
        {STACK_STEPS.map(({ key, label }) => {
          const isImage =
            key === "collectionImage" || key === "generateIcons";
          const quality = isImage
            ? key === "collectionImage"
              ? stack.quality.collectionImage
              : stack.quality.generateIcons
            : null;
          return (
            <span
              key={key}
              className="font-mono text-xs text-zinc-400 bg-zinc-800 border border-zinc-700 rounded-md px-2.5 py-1"
            >
              <span className="text-zinc-500">{label}:</span>{" "}
              <span className="text-cyan-300/80">{stack.models[key]}</span>
              {quality && (
                <span className="text-zinc-500"> @ {quality}</span>
              )}
            </span>
          );
        })}
      </div>
      <p className="text-zinc-600 text-xs">
        Every step below runs with this stack&apos;s model (and image quality).
        Edit or add stacks on the models page.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Chain control — pick how far down the pipeline to run, then cascade §1 → §N.
// ---------------------------------------------------------------------------

function ChainControl({
  from,
  onFrom,
  target,
  onTarget,
  iconLimit,
  onIconLimit,
  onRun,
  busy,
  currentStep,
  done,
  error,
  blocked,
  estCost,
  iconCountUsed,
}: {
  from: StepKey;
  onFrom: (s: StepKey) => void;
  target: StepKey;
  onTarget: (s: StepKey) => void;
  iconLimit: number | null;
  onIconLimit: (n: number | null) => void;
  onRun: () => void;
  busy: boolean;
  currentStep: StepKey | null;
  done: StepKey[];
  error: string | null;
  blocked: string | null;
  estCost: number;
  iconCountUsed: number;
}) {
  const fromIdx = CHAIN_ORDER.indexOf(from);
  const targetIdx = CHAIN_ORDER.indexOf(target);
  const isSingle = fromIdx === targetIdx;
  const includesIcons = targetIdx >= CHAIN_ORDER.indexOf("generateIcons");
  const runLabel = isSingle
    ? `▸ Run §${stepNum(from)}`
    : `▸ Run §${stepNum(from)}–§${stepNum(target)}`;

  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Run chain
        </span>
        <span className="text-sm text-zinc-400">from</span>
        <select
          value={from}
          onChange={(e) => onFrom(e.target.value as StepKey)}
          disabled={busy}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          {CHAIN_ORDER.map((k) => (
            <option key={k} value={k}>
              {CHAIN_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="text-sm text-zinc-400">through</span>
        <select
          value={target}
          onChange={(e) => onTarget(e.target.value as StepKey)}
          disabled={busy}
          className="bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        >
          {CHAIN_ORDER.map((k) => (
            <option key={k} value={k}>
              {CHAIN_LABEL[k]}
            </option>
          ))}
        </select>
        <span className="text-sm text-zinc-400">·</span>
        <label className="text-sm text-zinc-400">icons</label>
        <input
          type="number"
          min={1}
          inputMode="numeric"
          value={iconLimit ?? ""}
          onChange={(e) => {
            const v = e.target.value.trim();
            onIconLimit(v === "" ? null : Math.max(1, Math.floor(Number(v)) || 1));
          }}
          placeholder="all"
          disabled={busy}
          title="How many icons to compose prompts for at §4 (blank = all)"
          className="w-20 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
        />
        <RunButton
          onClick={onRun}
          busy={busy}
          disabled={!!blocked}
          label={runLabel}
        />
        {blocked && <span className="text-zinc-500 text-sm">{blocked}</span>}
      </div>

      {/* Estimated cost for exactly what this run covers. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">Estimated cost for this run:</span>
        <span
          className="font-mono text-cyan-300"
          title="Sum of the per-step estimates for the selected range, with the selected stack"
        >
          {fmtUsd(estCost)}
        </span>
        <span className="font-mono text-xs text-zinc-600">
          {isSingle ? `§${stepNum(from)} only` : `§${stepNum(from)}–§${stepNum(target)}`}
          {includesIcons &&
            ` · ${iconCountUsed} icon${iconCountUsed === 1 ? "" : "s"} at §5`}
        </span>
      </div>

      {/* Progress strip. Steps inside the from→through range are active; steps
          before `from` are skipped (their output is reused from shared state). */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CHAIN_ORDER.map((k, i) => {
          const inRange = i >= fromIdx && i <= targetIdx;
          const skipped = i < fromIdx;
          const isDone = done.includes(k);
          const isRunning = currentStep === k;
          const cls = skipped
            ? "text-zinc-500 border-zinc-800 bg-zinc-900 line-through decoration-zinc-700"
            : !inRange
              ? "text-zinc-600 border-zinc-800 bg-zinc-900"
              : isDone
                ? "text-emerald-300 border-emerald-800/50 bg-emerald-950/40"
                : isRunning
                  ? "text-cyan-300 border-cyan-700/50 bg-cyan-950/40 animate-pulse"
                  : "text-zinc-400 border-zinc-700 bg-zinc-800";
          return (
            <span
              key={k}
              className={`font-mono text-xs rounded-md border px-2.5 py-1 ${cls}`}
            >
              {isDone ? "✓ " : isRunning ? "● " : skipped ? "↩ " : ""}
              {CHAIN_LABEL[k]}
            </span>
          );
        })}
      </div>

      <p className="text-zinc-600 text-xs">
        Runs the selected range straight through in order, feeding each output to
        the next (no pause between steps — it stops only on an error). Steps
        before <span className="text-zinc-400">from</span> are skipped and reuse
        whatever&apos;s already on the page.{" "}
        <span className="text-zinc-400">
          To go one step at a time, set <em>from</em> and <em>through</em> to the
          same step
        </span>{" "}
        — it runs just that step, then auto-advances to the next, so clicking{" "}
        <span className="font-mono">Run</span> again walks the chain one step
        forward each time (no scrolling needed). When the range finishes, images
        persist to the gallery. The icon count caps how many prompts §4 composes
        (so &ldquo;1&rdquo; makes a one-icon request, not compose-all-then-pick).
        Each step is also still runnable on its own in the sections below.
      </p>

      {error && <ErrorMsg msg={error} />}
    </section>
  );
}

// ---------------------------------------------------------------------------
// §1 — Analyze
// ---------------------------------------------------------------------------

function Section1({
  state,
  patch,
  chainBusy,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
  chainBusy: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IconManifest | null>(null);
  const [realized, setRealized] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!state.sourceDataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRealized(null);
    try {
      const { manifest, usage } = await analyzeImage(
        state.sourceDataUrl,
        state.sourceFileName ?? undefined,
        state.stack.models.analyze,
      );
      setResult(manifest);
      setRealized(realizedTextLabel(state.stack.models.analyze, usage));
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
      model={state.stack.models.analyze}
      cost={stepCostLabel("analyze", state.stack)}
      realized={realized}
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
      <RunButton onClick={run} busy={busy} disabled={!state.sourceDataUrl || chainBusy} />
      <OutputTabs
        empty={!error && !result && !state.manifest}
        rawData={result ?? state.manifest ?? (error ? { error } : null)}
        interpreted={
          error ? (
            <ErrorMsg msg={error} />
          ) : (result ?? state.manifest) ? (
            <InterpretedResult kind="manifest" data={(result ?? state.manifest)!} />
          ) : null
        }
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §2 — Compose collection prompt
// ---------------------------------------------------------------------------

function Section2({
  state,
  patch,
  chainBusy,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
  chainBusy: boolean;
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
  const [realized, setRealized] = useState<string | null>(null);
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
    setRealized(null);
    try {
      const { collectionPrompt, usage } = await composeCollectionPrompt(
        parsed,
        state.stack.models.collectionPrompt,
      );
      setResult(collectionPrompt);
      setRealized(realizedTextLabel(state.stack.models.collectionPrompt, usage));
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
      model={state.stack.models.collectionPrompt}
      cost={stepCostLabel("collectionPrompt", state.stack)}
      realized={realized}
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
      <RunButton onClick={run} busy={busy} disabled={!!parseError || chainBusy} />
      <OutputTabs
        empty={!error && !result && !state.collectionPrompt}
        rawData={result ?? state.collectionPrompt ?? (error ? { error } : null)}
        interpreted={
          error ? (
            <ErrorMsg msg={error} />
          ) : (result ?? state.collectionPrompt) ? (
            <InterpretedResult kind="collectionPrompt" data={(result ?? state.collectionPrompt)!} />
          ) : null
        }
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §3 — Generate collection image
// ---------------------------------------------------------------------------

function Section3({
  state,
  patch,
  onPersist,
  chainBusy,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
  onPersist: (dataUrl: string) => Promise<number>;
  chainBusy: boolean;
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
  const [realized, setRealized] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
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
    setRealized(null);
    setSaved(null);
    try {
      const { collectionImage } = await generateCollectionImage({
        sourceImageBase64: state.sourceDataUrl,
        manifest: parsed,
        collectionPrompt: promptText,
        model: state.stack.models.collectionImage,
        quality: state.stack.quality.collectionImage,
      });
      setResult(collectionImage.imageUrl);
      setRealized(
        fmtUsd(imageCostUSD(state.stack.models.collectionImage, state.stack.quality.collectionImage, 1)),
      );
      patch({ collectionImageDataUrl: collectionImage.imageUrl });
      setSaved(await onPersist(collectionImage.imageUrl));
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
      output="collection image image"
      model={state.stack.models.collectionImage}
      cost={stepCostLabel("collectionImage", state.stack)}
      realized={realized}
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
        disabled={!!parseError || !state.sourceDataUrl || chainBusy}
      />
      {!state.sourceDataUrl && (
        <p className="text-zinc-500 text-sm">Provide a source image first.</p>
      )}
      <SavedNote saved={saved} noun="collection image" />
      <OutputTabs
        empty={!error && !result && !state.collectionImageDataUrl}
        rawData={
          (result ?? state.collectionImageDataUrl)
            ? { imageUrl: result ?? state.collectionImageDataUrl }
            : error
              ? { error }
              : null
        }
        interpreted={
          error ? (
            <ErrorMsg msg={error} />
          ) : (result ?? state.collectionImageDataUrl) ? (
            <InterpretedResult
              kind="collectionImage"
              data={{ imageUrl: (result ?? state.collectionImageDataUrl)! }}
            />
          ) : null
        }
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §4 — Compose individual prompts
// ---------------------------------------------------------------------------

function Section4({
  state,
  patch,
  chainBusy,
}: {
  state: BenchState;
  patch: (p: Partial<BenchState>) => void;
  chainBusy: boolean;
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
  const [realized, setRealized] = useState<string | null>(null);
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

  // Apply the bench-wide icon cap: §4 only composes prompts for the first N.
  const limited = limitManifest(parsed, state.iconLimit);
  const limitedText = JSON.stringify(limited, null, 2);
  const isLimited =
    state.iconLimit != null && state.iconLimit < parsed.icons.length;

  const run = async () => {
    if (parseError || !state.collectionImageDataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRealized(null);
    try {
      const { individualPrompts, usage } = await composeIndividualPrompts({
        collectionImageBase64: state.collectionImageDataUrl,
        manifest: limited,
        model: state.stack.models.individualPrompts,
      });
      setResult(individualPrompts);
      setRealized(realizedTextLabel(state.stack.models.individualPrompts, usage));
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
      inputs="collection image + manifest"
      output="sharedStylePrompt + one prompt per icon"
      model={state.stack.models.individualPrompts}
      cost={stepCostLabel("individualPrompts", state.stack)}
      realized={realized}
    >
      <PromptDisclosure
        label="View exact prompt sent to composer (live)"
        prompt={buildIndividualPromptComposer(limitedText)}
      />
      <p className="text-zinc-500 text-sm italic">
        + the collection image (§3) is sent as image input alongside this prompt
      </p>
      {isLimited && (
        <p className="text-amber-300/80 text-sm">
          Capped to the first {state.iconLimit} of {parsed.icons.length} icons
          (set on the chain control above) — this request composes{" "}
          {state.iconLimit} prompt{state.iconLimit === 1 ? "" : "s"}.
        </p>
      )}
      <button
        onClick={pull}
        disabled={!state.manifest}
        className="self-start text-sm text-cyan-400/80 hover:text-cyan-300 disabled:opacity-40 disabled:pointer-events-none"
      >
        ↑ pull manifest from §1
      </button>
      <ImageInput
        label="Collection image (style reference):"
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
        disabled={!!parseError || !state.collectionImageDataUrl || chainBusy}
      />
      {!state.collectionImageDataUrl && (
        <p className="text-zinc-500 text-sm">Generate or provide a collection image first (§3).</p>
      )}
      <OutputTabs
        empty={!error && !result && !state.individualPrompts}
        rawData={result ?? state.individualPrompts ?? (error ? { error } : null)}
        interpreted={
          error ? (
            <ErrorMsg msg={error} />
          ) : (result ?? state.individualPrompts) ? (
            <InterpretedResult kind="individualPrompts" data={(result ?? state.individualPrompts)!} />
          ) : null
        }
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// §5 — Generate one icon
// ---------------------------------------------------------------------------

function Section5({
  state,
  onPersist,
  chainBusy,
}: {
  state: BenchState;
  onPersist: (icons: GeneratedIcon[]) => Promise<number>;
  chainBusy: boolean;
}) {
  const prompts = state.individualPrompts ?? SAMPLE_INDIVIDUAL_PROMPTS;
  const [selectedId, setSelectedId] = useState(prompts.iconPrompts[0]?.iconId);
  const [sharedStyle, setSharedStyle] = useState(prompts.sharedStylePrompt);
  const selected =
    prompts.iconPrompts.find((p) => p.iconId === selectedId) ??
    prompts.iconPrompts[0];
  const [promptText, setPromptText] = useState(selected?.prompt ?? "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedIcon | null>(null);
  const [realized, setRealized] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Re-sync the editable fields from §4's output. Keeps the current icon
  // selection when it still exists in the new prompt set.
  const syncFromState = useCallback(
    (p: IndividualIconPrompts) => {
      const keep =
        p.iconPrompts.find((ip) => ip.iconId === selectedId) ?? p.iconPrompts[0];
      setSharedStyle(p.sharedStylePrompt);
      setSelectedId(keep?.iconId);
      setPromptText(keep?.prompt ?? "");
    },
    [selectedId],
  );

  // Auto-sync whenever §4 (or a chain run) produces a new prompt set — the
  // seeded-at-mount values would otherwise go stale and a paid image call would
  // be sent with old fixture text.
  useEffect(() => {
    if (state.individualPrompts) syncFromState(state.individualPrompts);
    // Keyed on the prompts object identity only — re-running on selectedId /
    // syncFromState changes would clobber in-progress manual edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.individualPrompts]);

  const onSelect = (id: string) => {
    setSelectedId(id);
    const match = prompts.iconPrompts.find((p) => p.iconId === id);
    setPromptText(match?.prompt ?? "");
    setResult(null);
    setRealized(null);
    setSaved(null);
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
    setRealized(null);
    setSaved(null);
    try {
      const { generatedIcon } = await generateOneIcon({
        collectionImageBase64: state.collectionImageDataUrl,
        sharedStylePrompt: sharedStyle,
        iconPrompt: { ...selected, prompt: promptText },
        model: state.stack.models.generateIcons,
        quality: state.stack.quality.generateIcons,
      });
      setResult(generatedIcon);
      if (generatedIcon.status === "success") {
        setRealized(
          fmtUsd(imageCostUSD(state.stack.models.generateIcons, state.stack.quality.generateIcons, 1)),
        );
        setSaved(await onPersist([generatedIcon]));
      }
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
      inputs="collection image + sharedStylePrompt + one icon prompt"
      output="single icon image"
      model={state.stack.models.generateIcons}
      cost={stepCostLabel("generateIcons", state.stack, true)}
      realized={realized}
    >
      <PromptDisclosure
        label="View full wrapper sent to image model (live)"
        prompt={resolvedWrapper}
      />
      <p className="text-zinc-500 text-sm italic">
        + the collection image (§3) is attached as the style reference
      </p>
      <button
        onClick={() => state.individualPrompts && syncFromState(state.individualPrompts)}
        disabled={!state.individualPrompts}
        className="self-start text-sm text-cyan-400/80 hover:text-cyan-300 disabled:opacity-40 disabled:pointer-events-none"
      >
        ↑ pull prompts from §4
      </button>
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
      <RunButton onClick={run} busy={busy} disabled={!state.collectionImageDataUrl || chainBusy} />
      {!state.collectionImageDataUrl && (
        <p className="text-zinc-500 text-sm">A collection image (§3) is required as the reference.</p>
      )}
      <SavedNote saved={saved} />
      <OutputTabs
        empty={!error && !result}
        rawData={result ?? (error ? { error } : null)}
        interpreted={
          error ? (
            <ErrorMsg msg={error} />
          ) : result ? (
            <InterpretedResult kind="icon" data={result} />
          ) : null
        }
      />
    </SectionCard>
  );
}

// "✓ saved to gallery" confirmation shown after a successful generation persists.
function SavedNote({ saved, noun = "icon" }: { saved: number | null; noun?: string }) {
  if (!saved) return null;
  return (
    <p className="text-emerald-300/90 text-sm font-medium flex items-center gap-1.5">
      <span>✓</span>
      Saved {saved} {noun}
      {saved === 1 ? "" : "s"} to the{" "}
      <Link href="/gallery" className="underline hover:text-emerald-200">
        gallery
      </Link>
    </p>
  );
}

// ---------------------------------------------------------------------------
// §6 — Generate batch
// ---------------------------------------------------------------------------

function Section6({
  state,
  onPersist,
  chainBusy,
}: {
  state: BenchState;
  onPersist: (icons: GeneratedIcon[]) => Promise<number>;
  chainBusy: boolean;
}) {
  const prompts = state.individualPrompts ?? SAMPLE_INDIVIDUAL_PROMPTS;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GeneratedIcon[] | null>(null);
  const [realized, setRealized] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!state.collectionImageDataUrl) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setRealized(null);
    setSaved(null);
    try {
      const { generatedIcons } = await generateIconsBatch({
        collectionImageBase64: state.collectionImageDataUrl,
        individualPrompts: prompts,
        model: state.stack.models.generateIcons,
        quality: state.stack.quality.generateIcons,
      });
      setResult(generatedIcons);
      const ok = generatedIcons.filter((g) => g.status === "success").length;
      setRealized(
        fmtUsd(imageCostUSD(state.stack.models.generateIcons, state.stack.quality.generateIcons, ok)),
      );
      setSaved(await onPersist(generatedIcons));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };


  return (
    <SectionCard
      title="Generate batch"
      num={6}
      inputs="collection image + all icon prompts"
      output="all generated icons"
      model={state.stack.models.generateIcons}
      cost={stepCostLabel(
        "generateIcons",
        state.stack,
        false,
        prompts.iconPrompts.length,
      )}
      realized={realized}
    >
      <p className="text-zinc-400 text-sm">
        Generates every icon in{" "}
        {state.individualPrompts ? "§4's output" : "the sample prompt set"} (
        {prompts.iconPrompts.length} icons), each using the collection image as the
        reference.
      </p>
      <RunButton onClick={run} busy={busy} disabled={!state.collectionImageDataUrl || chainBusy} />
      {!state.collectionImageDataUrl && (
        <p className="text-zinc-500 text-sm">A collection image (§3) is required as the reference.</p>
      )}
      <SavedNote saved={saved} />
      <OutputTabs
        empty={!error && !result && !state.generatedIcons}
        rawData={result ?? state.generatedIcons ?? (error ? { error } : null)}
        interpreted={
          error ? (
            <ErrorMsg msg={error} />
          ) : (result ?? state.generatedIcons) ? (
            <InterpretedResult kind="icons" data={(result ?? state.generatedIcons)!} />
          ) : null
        }
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BenchPage() {
  const [state, setState] = useState<BenchState>({
    stack: DEFAULT_STACK,
    sourceDataUrl: null,
    sourceFileName: null,
    manifest: null,
    collectionPrompt: null,
    collectionImageDataUrl: null,
    individualPrompts: null,
    generatedIcons: null,
    iconLimit: null,
  });

  const patch = useCallback(
    (p: Partial<BenchState>) => setState((s) => ({ ...s, ...p })),
    [],
  );

  // Each bench page-load is one persistence "run": icons generated in §5/§6 are
  // saved to the gallery under this run id so outputs survive a refresh.
  const runIdRef = useRef<string | null>(null);
  runIdRef.current ??= crypto.randomUUID();
  const createdAtRef = useRef<string>(new Date().toISOString());

  const persistIcons = useCallback(
    (icons: GeneratedIcon[]) =>
      persistBenchIcons(icons, {
        runId: runIdRef.current!,
        createdAt: createdAtRef.current,
        sourceId: runIdRef.current!,
        manifest: state.manifest,
        collectionPrompt: state.collectionPrompt,
        individualPrompts: state.individualPrompts,
      }),
    [state.manifest, state.collectionPrompt, state.individualPrompts],
  );

  const persistCollectionImage = useCallback(
    (dataUrl: string) => persistBenchCollectionImage(dataUrl),
    [],
  );

  // ---- Chain orchestrator: run a §from → §through range automatically ----
  // The range is dynamic: steps before `from` are skipped and their outputs are
  // pulled from shared state, so you can run §1–§4, inspect, then continue §5.
  const [chainFrom, setChainFrom] = useState<StepKey>("analyze");
  const [chainTarget, setChainTarget] = useState<StepKey>("generateIcons");
  const [chainBusy, setChainBusy] = useState(false);
  const [chainStep, setChainStep] = useState<StepKey | null>(null);
  const [chainDone, setChainDone] = useState<StepKey[]>([]);
  const [chainError, setChainError] = useState<string | null>(null);

  // Estimated cost of the selected range, with the selected stack. §5 scales
  // with how many icons get generated. If the range re-composes §4, the chain
  // caps that at `iconLimit` (falling back to the stack's iconCount when
  // blank); if §4 is skipped, the existing prompt set IS the batch, so use its
  // real length instead of the stack's nominal count.
  const iconCountUsed = useMemo(() => {
    const fromIdx = CHAIN_ORDER.indexOf(chainFrom);
    const targetIdx = CHAIN_ORDER.indexOf(chainTarget);
    const promptsIdx = CHAIN_ORDER.indexOf("individualPrompts");
    const recomposesPrompts = fromIdx <= promptsIdx && targetIdx >= promptsIdx;
    if (!recomposesPrompts && state.individualPrompts) {
      return state.individualPrompts.iconPrompts.length;
    }
    return state.iconLimit ?? state.stack.iconCount;
  }, [chainFrom, chainTarget, state.individualPrompts, state.iconLimit, state.stack.iconCount]);
  const chainEst = useMemo(() => {
    const fromIdx = CHAIN_ORDER.indexOf(chainFrom);
    const targetIdx = CHAIN_ORDER.indexOf(chainTarget);
    const effStack: Stack = { ...state.stack, iconCount: iconCountUsed };
    let total = 0;
    for (let i = fromIdx; i <= targetIdx; i++) {
      const step = STEPS.find((s) => s.key === CHAIN_ORDER[i])!;
      total += costForStep(step, effStack).cost;
    }
    return total;
  }, [chainFrom, chainTarget, state.stack, iconCountUsed]);

  // Keep from ≤ through whichever end the user moves.
  const selectChainFrom = useCallback((s: StepKey) => {
    setChainFrom(s);
    setChainTarget((t) =>
      CHAIN_ORDER.indexOf(s) > CHAIN_ORDER.indexOf(t) ? s : t,
    );
  }, []);
  const selectChainTarget = useCallback((s: StepKey) => {
    setChainTarget(s);
    setChainFrom((f) =>
      CHAIN_ORDER.indexOf(s) < CHAIN_ORDER.indexOf(f) ? s : f,
    );
  }, []);

  const runChain = useCallback(async () => {
    const blocked = missingForStart(chainFrom, state);
    if (blocked) {
      setChainError(blocked);
      return;
    }
    const fromIdx = CHAIN_ORDER.indexOf(chainFrom);
    const targetIdx = CHAIN_ORDER.indexOf(chainTarget);
    const inRange = (i: number) => i >= fromIdx && i <= targetIdx;
    const { models, quality } = state.stack;
    const src = state.sourceDataUrl;

    setChainBusy(true);
    setChainError(null);
    setChainDone([]);
    setChainStep(null);

    // Seed artifacts from shared state (skipped upstream steps reuse these),
    // then thread them through locals — setState is async, so we can't read
    // `state` back mid-cascade.
    let manifest = state.manifest;
    let collectionPrompt = state.collectionPrompt;
    let collectionImage = state.collectionImageDataUrl;
    let individualPrompts = state.individualPrompts;
    const done: StepKey[] = [];
    let running: StepKey = chainFrom; // tracked locally for accurate error labels

    try {
      if (inRange(0)) {
        running = "analyze";
        setChainStep("analyze");
        manifest = (await analyzeImage(src!, state.sourceFileName ?? undefined, models.analyze)).manifest;
        patch({ manifest });
        done.push("analyze");
        setChainDone([...done]);
      }
      if (inRange(1)) {
        running = "collectionPrompt";
        setChainStep("collectionPrompt");
        collectionPrompt = (await composeCollectionPrompt(manifest!, models.collectionPrompt)).collectionPrompt;
        patch({ collectionPrompt });
        done.push("collectionPrompt");
        setChainDone([...done]);
      }
      if (inRange(2)) {
        running = "collectionImage";
        setChainStep("collectionImage");
        collectionImage = (
          await generateCollectionImage({
            sourceImageBase64: src!,
            manifest: manifest!,
            collectionPrompt: collectionPrompt!,
            model: models.collectionImage,
            quality: quality.collectionImage,
          })
        ).collectionImage.imageUrl;
        patch({ collectionImageDataUrl: collectionImage });
        await persistBenchCollectionImage(collectionImage);
        done.push("collectionImage");
        setChainDone([...done]);
      }
      if (inRange(3)) {
        running = "individualPrompts";
        setChainStep("individualPrompts");
        individualPrompts = (
          await composeIndividualPrompts({
            collectionImageBase64: collectionImage!,
            manifest: limitManifest(manifest!, state.iconLimit),
            model: models.individualPrompts,
          })
        ).individualPrompts;
        patch({ individualPrompts });
        done.push("individualPrompts");
        setChainDone([...done]);
      }
      if (inRange(4)) {
        running = "generateIcons";
        setChainStep("generateIcons");
        const { generatedIcons } = await generateIconsBatch({
          collectionImageBase64: collectionImage!,
          individualPrompts: individualPrompts!,
          model: models.generateIcons,
          quality: quality.generateIcons,
        });
        patch({ generatedIcons });
        await persistBenchIcons(generatedIcons, {
          runId: runIdRef.current!,
          createdAt: createdAtRef.current,
          sourceId: runIdRef.current!,
          manifest,
          collectionPrompt,
          individualPrompts,
        });
        done.push("generateIcons");
        setChainDone([...done]);
      }

      // Advance the start to the step after this range so the next click
      // continues where we left off (e.g. ran §1–§4 → next run is §5).
      const nextIdx = Math.min(targetIdx + 1, CHAIN_ORDER.length - 1);
      setChainFrom(CHAIN_ORDER[nextIdx]);
      setChainTarget((t) =>
        CHAIN_ORDER.indexOf(t) < nextIdx ? CHAIN_ORDER[nextIdx] : t,
      );
    } catch (err) {
      setChainError(
        `${CHAIN_LABEL[running]} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setChainStep(null);
      setChainBusy(false);
    }
  }, [state, chainFrom, chainTarget, patch]);

  // Saved stacks come from localStorage; load once on mount (client-only).
  const [savedStacks, setSavedStacks] = useState<Stack[]>([]);
  useEffect(() => {
    setSavedStacks(loadStacks());
  }, []);

  // The picker offers DEFAULT_STACK first, then every saved stack by name.
  const stackOptions = [DEFAULT_STACK, ...savedStacks];
  const selectStack = (name: string) => {
    const found = stackOptions.find((s) => s.name === name) ?? DEFAULT_STACK;
    // Deep-clone so editing the selection never mutates the stored stack.
    patch({ stack: structuredClone(found) });
  };

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10">
        <div className="max-w-4xl mx-auto flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h1 className="text-3xl font-bold text-zinc-100">Test Bench</h1>
              <Link
                href="/models"
                className="text-sm font-medium text-cyan-400/80 hover:text-cyan-300"
              >
                💲 Model costs &amp; capabilities →
              </Link>
            </div>
            <PipelineOutline
              present={{
                source: !!state.sourceDataUrl,
                manifest: !!state.manifest,
                collectionPrompt: !!state.collectionPrompt,
                collectionImage: !!state.collectionImageDataUrl,
                iconPrompts: !!state.individualPrompts,
              }}
            />
          </div>

          <StackPicker
            stack={state.stack}
            options={stackOptions}
            onSelect={selectStack}
          />

          <ChainControl
            from={chainFrom}
            onFrom={selectChainFrom}
            target={chainTarget}
            onTarget={selectChainTarget}
            iconLimit={state.iconLimit}
            onIconLimit={(n) => patch({ iconLimit: n })}
            onRun={runChain}
            busy={chainBusy}
            currentStep={chainStep}
            done={chainDone}
            error={chainError}
            blocked={missingForStart(chainFrom, state)}
            estCost={chainEst}
            iconCountUsed={iconCountUsed}
          />

          <Section1 state={state} patch={patch} chainBusy={chainBusy} />
          <Section2 state={state} patch={patch} chainBusy={chainBusy} />
          <Section3 state={state} patch={patch} onPersist={persistCollectionImage} chainBusy={chainBusy} />
          <Section4 state={state} patch={patch} chainBusy={chainBusy} />
          <Section5 state={state} onPersist={persistIcons} chainBusy={chainBusy} />
          <Section6 state={state} onPersist={persistIcons} chainBusy={chainBusy} />
        </div>
      </main>
    </>
  );
}
