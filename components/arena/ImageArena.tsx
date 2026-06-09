"use client";

import { useRef, useState } from "react";
import { judgeImages } from "@/lib/gemini/arena-client";
import { saveExperiment } from "@/lib/gemini/arena-store";
import { JUDGE_MODELS, DEFAULT_JUDGE_MODEL } from "@/lib/gemini/models";
import type { ImageJudgment } from "@/lib/gemini/schemas/image-judgment.schema";
import Verdict from "./Verdict";

// Multimodal image-pair judge: drop two generated icons, optionally note the
// prompt that produced each + the intent, and Gemini picks the stronger image.
// Completes the loop your OpenAI pipeline generates; Gemini only judges.

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function ImageSlot({
  label,
  image,
  prompt,
  onImage,
  onPrompt,
}: {
  label: string;
  image: string | null;
  prompt: string;
  onImage: (dataUrl: string | null) => void;
  onPrompt: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-zinc-700 bg-zinc-950 text-sm text-zinc-600 transition-colors hover:border-cyan-500/50 hover:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={label} className="h-full w-full object-contain" />
        ) : (
          <span>Click to upload</span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          onImage(file ? await readAsDataUrl(file) : null);
        }}
      />
      <textarea
        value={prompt}
        onChange={(e) => onPrompt(e.target.value)}
        rows={2}
        placeholder="prompt that produced it (optional)"
        className="resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
      />
    </div>
  );
}

export interface ImageArenaProps {
  onSaved?: () => void;
}

export default function ImageArena({ onSaved }: ImageArenaProps) {
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const [promptA, setPromptA] = useState("");
  const [promptB, setPromptB] = useState("");
  const [intent, setIntent] = useState("");
  const [tag, setTag] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_JUDGE_MODEL);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [judgment, setJudgment] = useState<ImageJudgment | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);

  const canCompare = !!imageA && !!imageB && !loading;

  async function onCompare() {
    if (!imageA || !imageB) return;
    setLoading(true);
    setError(null);
    setJudgment(null);
    setSavedLabel(null);
    try {
      const { judgment, raw, usage } = await judgeImages({
        imageA,
        imageB,
        intent,
        promptA,
        promptB,
        model,
      });
      setJudgment(judgment);
      const exp = await saveExperiment({
        kind: "image-comparison",
        model,
        inputs: {
          intent: intent.trim() || undefined,
          promptA: promptA.trim() || undefined,
          promptB: promptB.trim() || undefined,
          imageA,
          imageB,
        },
        judgment,
        raw,
        usage,
        tag,
      });
      setSavedLabel(exp.label);
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Intent / brief <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What should the icon be? Used to judge which image fits better."
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ImageSlot
          label="Image A"
          image={imageA}
          prompt={promptA}
          onImage={setImageA}
          onPrompt={setPromptA}
        />
        <ImageSlot
          label="Image B"
          image={imageB}
          prompt={promptB}
          onImage={setImageB}
          onPrompt={setPromptB}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Judge</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-cyan-500/50 focus:outline-none"
          >
            {JUDGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} — {m.blurb}
              </option>
            ))}
          </select>
        </div>
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder="tag (optional)"
          className="w-40 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none"
        />
        <button
          onClick={onCompare}
          disabled={!canCompare}
          className="ml-auto rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/25 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Judging…" : "Compare images"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {judgment && (
        <Verdict
          judgment={judgment}
          badge={
            savedLabel ? (
              <span className="rounded-md bg-zinc-800/60 px-2 py-0.5 font-mono text-xs text-zinc-400">
                saved · {savedLabel}
              </span>
            ) : undefined
          }
          footer={
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Suggestions
              </p>
              <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 p-3 text-sm leading-relaxed text-amber-100">
                {judgment.suggestions}
              </p>
            </div>
          }
        />
      )}
    </div>
  );
}
