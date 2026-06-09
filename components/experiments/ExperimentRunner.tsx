"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SIGNATURE_PRESETS, modelsForSignature } from "@/lib/experiments/model-registry";
import { runCell } from "@/lib/experiments/run-client";
import type { CellResult, CellSettings } from "@/lib/experiments/run-cell";

// The experiment runner: pick an I/O signature → it filters the model list →
// set up two cells that vary ONE axis (prompt or model) → run both → compare the
// outputs side by side. No Gemini in this flow; Gemini lives in the side chat.

type Slot = { status: "idle" | "loading" | "done" | "error"; result?: CellResult; error?: string };
const IDLE: Slot = { status: "idle" };

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function CellCard({ title, slot }: { title: string; slot: Slot }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-cyan-300">{title}</span>
        {slot.result?.costUSD !== undefined && (
          <span className="font-mono text-xs text-zinc-500">
            ${slot.result.costUSD.toFixed(4)}
          </span>
        )}
      </div>

      {slot.status === "idle" && (
        <p className="py-8 text-center text-sm text-zinc-600">— not run yet —</p>
      )}
      {slot.status === "loading" && (
        <div className="flex items-center gap-2 py-8 text-sm text-zinc-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" /> running…
        </div>
      )}
      {slot.status === "error" && (
        <p className="rounded-lg border border-red-700/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {slot.error}
        </p>
      )}
      {slot.status === "done" && slot.result && (
        <>
          {slot.result.kind === "image" && slot.result.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slot.result.image}
              alt={title}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 object-contain"
            />
          ) : (
            <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-200">
              {slot.result.text}
            </pre>
          )}
          {slot.result.usage && (
            <p className="font-mono text-xs text-zinc-600">
              {slot.result.usage.inputTokens} in · {slot.result.usage.outputTokens} out tok
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function ExperimentRunner() {
  const [sigIdx, setSigIdx] = useState(0);
  const preset = SIGNATURE_PRESETS[sigIdx];
  const io = preset.io;
  const models = useMemo(() => modelsForSignature(io), [sigIdx, io]);
  const needsImage = io.inputs.includes("image");
  const outputsImage = io.output === "image";

  const [axis, setAxis] = useState<"model" | "prompt">("model");
  const [sharedPrompt, setSharedPrompt] = useState("");
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [modelA, setModelA] = useState("");
  const [modelB, setModelB] = useState("");
  const [sharedModel, setSharedModel] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");
  const [background, setBackground] = useState<"auto" | "transparent" | "opaque">("auto");
  const [A, setA] = useState<Slot>(IDLE);
  const [B, setB] = useState<Slot>(IDLE);

  const fileRef = useRef<HTMLInputElement>(null);

  // Reset model picks + results whenever the signature changes.
  useEffect(() => {
    setModelA(models[0]?.id ?? "");
    setModelB(models[1]?.id ?? models[0]?.id ?? "");
    setSharedModel(models[0]?.id ?? "");
    setA(IDLE);
    setB(IDLE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sigIdx]);

  const canRun =
    (needsImage ? !!image : true) &&
    (axis === "model"
      ? sharedPrompt.trim() !== "" && !!modelA && !!modelB
      : promptA.trim() !== "" && promptB.trim() !== "" && !!sharedModel);

  async function runOne(set: (s: Slot) => void, input: Parameters<typeof runCell>[0]) {
    set({ status: "loading" });
    try {
      const result = await runCell(input);
      set({ status: "done", result });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Run failed." });
    }
  }

  function onRun() {
    const settings: CellSettings | undefined = outputsImage ? { quality, background } : undefined;
    const img = needsImage ? image ?? undefined : undefined;
    if (axis === "model") {
      void runOne(setA, { model: modelA, text: sharedPrompt, image: img, settings });
      void runOne(setB, { model: modelB, text: sharedPrompt, image: img, settings });
    } else {
      void runOne(setA, { model: sharedModel, text: promptA, image: img, settings });
      void runOne(setB, { model: sharedModel, text: promptB, image: img, settings });
    }
  }

  const titleA = axis === "model" ? modelA || "Model A" : "Prompt A";
  const titleB = axis === "model" ? modelB || "Model B" : "Prompt B";

  const selectCls =
    "rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-cyan-500/50 focus:outline-none";
  const areaCls =
    "resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40";

  return (
    <div className="flex flex-col gap-6">
      {/* Signature + axis */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            What goes in → what comes out
          </label>
          <select
            value={sigIdx}
            onChange={(e) => setSigIdx(Number(e.target.value))}
            className={selectCls}
          >
            {SIGNATURE_PRESETS.map((p, i) => (
              <option key={p.title} value={i}>
                {p.title} — {p.desc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 self-start rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
          {(["model", "prompt"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAxis(a)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                axis === a
                  ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
            >
              {a === "model" ? "Vary model (1 prompt, 2 models)" : "Vary prompt (1 model, 2 prompts)"}
            </button>
          ))}
        </div>
      </div>

      {/* Optional shared reference/input image */}
      {needsImage && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-700 bg-zinc-950 text-xs text-zinc-600 hover:border-cyan-500/50"
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="input" className="h-full w-full object-contain" />
            ) : (
              "+ Image"
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              setImage(f ? await readAsDataUrl(f) : null);
            }}
          />
          <span className="text-xs text-zinc-500">Shared input image (sent to both cells)</span>
        </div>
      )}

      {/* Inputs that vary by axis */}
      {axis === "model" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Prompt (sent to both models)
            </label>
            <textarea
              value={sharedPrompt}
              onChange={(e) => setSharedPrompt(e.target.value)}
              rows={4}
              placeholder="The prompt to test across two models…"
              className={areaCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500">Model A</label>
              <select value={modelA} onChange={(e) => setModelA(e.target.value)} className={selectCls}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m.status === "deprecated" ? " (deprecated)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500">Model B</label>
              <select value={modelB} onChange={(e) => setModelB(e.target.value)} className={selectCls}>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m.status === "deprecated" ? " (deprecated)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500">Model (runs both prompts)</label>
            <select value={sharedModel} onChange={(e) => setSharedModel(e.target.value)} className={selectCls}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}{m.status === "deprecated" ? " (deprecated)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500">Prompt A</label>
              <textarea value={promptA} onChange={(e) => setPromptA(e.target.value)} rows={4} placeholder="First prompt…" className={areaCls} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500">Prompt B</label>
              <textarea value={promptB} onChange={(e) => setPromptB(e.target.value)} rows={4} placeholder="Second prompt…" className={areaCls} />
            </div>
          </div>
        </div>
      )}

      {/* Image settings + run */}
      <div className="flex flex-wrap items-center gap-3">
        {outputsImage && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500">Quality</label>
              <select value={quality} onChange={(e) => setQuality(e.target.value as typeof quality)} className={selectCls}>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500">Background</label>
              <select value={background} onChange={(e) => setBackground(e.target.value as typeof background)} className={selectCls}>
                <option value="auto">auto</option>
                <option value="transparent">transparent</option>
                <option value="opaque">opaque</option>
              </select>
            </div>
          </>
        )}
        <button
          onClick={onRun}
          disabled={!canRun || A.status === "loading" || B.status === "loading"}
          className="ml-auto rounded-lg bg-cyan-500/15 px-5 py-2 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/25 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Run both
        </button>
      </div>

      {/* Outputs side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <CellCard title={titleA} slot={A} />
        <CellCard title={titleB} slot={B} />
      </div>
    </div>
  );
}
