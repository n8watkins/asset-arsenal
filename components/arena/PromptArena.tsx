"use client";

import { useState } from "react";
import { judgePrompts } from "@/lib/gemini/arena-client";
import { saveExperiment } from "@/lib/gemini/arena-store";
import { JUDGE_MODELS, DEFAULT_JUDGE_MODEL } from "@/lib/gemini/models";
import type { PromptJudgment } from "@/lib/gemini/schemas/prompt-judgment.schema";

// The core prompt-comparison UI, shared by the pop-out drawer and the full
// /arena page. Text-only: two candidate icon-generation prompts in, a Gemini
// verdict + distilled prompt out. Image judging is a later slice.

function WinnerBadge({ winner }: { winner: PromptJudgment["winner"] }) {
  const map = {
    A: { text: "Prompt A wins", cls: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/40" },
    B: { text: "Prompt B wins", cls: "bg-violet-500/15 text-violet-300 ring-violet-500/40" },
    tie: { text: "Tie", cls: "bg-zinc-700/40 text-zinc-300 ring-zinc-600/50" },
  } as const;
  const { text, cls } = map[winner];
  return (
    <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ring-1 ${cls}`}>
      {text}
    </span>
  );
}

function ScoreBar({ score, tone }: { score: number; tone: "a" | "b" }) {
  const pct = Math.round((score / 10) * 100);
  const color = tone === "a" ? "bg-cyan-500" : "bg-violet-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right font-mono text-xs text-zinc-400">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export interface PromptArenaProps {
  // Seed values, e.g. when launched from a pipeline step.
  initialA?: string;
  initialB?: string;
  initialIntent?: string;
  // Fired after an experiment is persisted, so a ledger can refresh.
  onSaved?: () => void;
}

export default function PromptArena({
  initialA = "",
  initialB = "",
  initialIntent = "",
  onSaved,
}: PromptArenaProps) {
  const [promptA, setPromptA] = useState(initialA);
  const [promptB, setPromptB] = useState(initialB);
  const [intent, setIntent] = useState(initialIntent);
  const [tag, setTag] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_JUDGE_MODEL);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [judgment, setJudgment] = useState<PromptJudgment | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canCompare = promptA.trim().length > 0 && promptB.trim().length > 0 && !loading;

  async function onCompare() {
    setLoading(true);
    setError(null);
    setJudgment(null);
    setSavedLabel(null);
    try {
      const { judgment, raw, usage } = await judgePrompts({ promptA, promptB, intent, model });
      setJudgment(judgment);
      // Persist the full flow to the ledger: inputs, parsed verdict, raw JSON,
      // and token usage. Deterministic label assigned in the store — no API call.
      const exp = await saveExperiment({
        kind: "prompt-comparison",
        model,
        inputs: { promptA, promptB, intent: intent.trim() || undefined },
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

  async function copyDistilled() {
    if (!judgment) return;
    await navigator.clipboard.writeText(judgment.distilledPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Optional intent / brief */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Intent / brief <span className="text-zinc-600">(optional)</span>
        </label>
        <input
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          placeholder="What should the icon be? e.g. a flat-line calendar icon, transparent bg"
          className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
        />
      </div>

      {/* The two candidates */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          { label: "Prompt A", value: promptA, set: setPromptA, ring: "focus:ring-cyan-500/40 focus:border-cyan-500/50" },
          { label: "Prompt B", value: promptB, set: setPromptB, ring: "focus:ring-violet-500/40 focus:border-violet-500/50" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col gap-1.5">
            <label className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {f.label}
            </label>
            <textarea
              value={f.value}
              onChange={(e) => f.set(e.target.value)}
              rows={6}
              placeholder={`Candidate ${f.label.slice(-1)} prompt…`}
              className={`resize-y rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 ${f.ring}`}
            />
          </div>
        ))}
      </div>

      {/* Controls */}
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
          {loading ? "Judging…" : "Compare prompts"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700/40 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Verdict */}
      {judgment && (
        <div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <WinnerBadge winner={judgment.winner} />
            <span className="text-xs text-zinc-500">
              confidence{" "}
              <span className="font-mono text-zinc-300">
                {Math.round(judgment.confidence * 100)}%
              </span>
            </span>
            {savedLabel && (
              <span className="ml-auto rounded-md bg-zinc-800/60 px-2 py-0.5 font-mono text-xs text-zinc-400">
                saved · {savedLabel}
              </span>
            )}
          </div>

          {/* Per-criterion scores */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 text-xs uppercase tracking-wide text-zinc-600">
              <span>Criterion</span>
              <span className="text-cyan-400">A</span>
              <span className="text-violet-400">B</span>
            </div>
            {judgment.criteria.map((c) => (
              <div key={c.name} className="flex flex-col gap-1.5">
                <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-x-4">
                  <span className="text-sm text-zinc-200">{c.name}</span>
                  <ScoreBar score={c.scoreA} tone="a" />
                  <ScoreBar score={c.scoreB} tone="b" />
                </div>
                {c.note && <p className="text-xs text-zinc-500">{c.note}</p>}
              </div>
            ))}
          </div>

          {/* Rationale */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Rationale
            </p>
            <p className="text-sm leading-relaxed text-zinc-300">{judgment.rationale}</p>
          </div>

          {/* Distilled prompt */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Distilled prompt
              </p>
              <button
                onClick={copyDistilled}
                className="rounded-md px-2 py-1 text-xs text-cyan-400/80 transition-colors hover:text-cyan-300 focus:outline-none"
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
            <pre className="whitespace-pre-wrap break-words rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3 text-sm text-emerald-100">
              {judgment.distilledPrompt}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
