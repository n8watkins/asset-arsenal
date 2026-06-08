"use client";

import { useState } from "react";
import { ARTIFACTS, getArtifact, type ArtifactKey } from "@/lib/icon/pipeline-guide";

function inputLabels(keys: ArtifactKey[]): string {
  if (keys.length === 0) return "your screenshot";
  return keys.map((k) => getArtifact(k).label).join(" + ");
}

export default function PipelineOutline({
  present,
}: {
  present?: Partial<Record<ArtifactKey, boolean>>;
}) {
  const [selected, setSelected] = useState<ArtifactKey | null>(null);
  const open = selected ? getArtifact(selected) : null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
      {/* Intro */}
      <h2 className="text-lg font-semibold text-zinc-100">The icon pipeline</h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-zinc-300">
        Six steps turn one screenshot into a set of standalone icons. Step 0 is
        the upload (no AI); steps 1–5 each call a model, and every step&rsquo;s
        output becomes the next step&rsquo;s input. Here each step is an
        independent, rerunnable breakpoint — edit any input, see the exact
        prompt before you run, then feed the result forward.
      </p>

      {/* Artifact chain — clickable */}
      <div className="mt-6">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          The artifact chain — click any piece to learn what it is
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {ARTIFACTS.map((artifact, i) => {
            const isPresent = present?.[artifact.key] ?? false;
            const isSelected = selected === artifact.key;
            return (
              <div key={artifact.key} className="flex items-center gap-2">
                <button
                  type="button"
                  aria-expanded={isSelected}
                  onClick={() =>
                    setSelected((cur) => (cur === artifact.key ? null : artifact.key))
                  }
                  className={[
                    "group inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5",
                    "text-sm font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                    isSelected
                      ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/60"
                      : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800",
                  ].join(" ")}
                >
                  <span
                    aria-hidden
                    className={[
                      "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none",
                      isPresent ? "bg-cyan-500/20 text-cyan-300" : "bg-zinc-700/60 text-transparent",
                    ].join(" ")}
                  >
                    {isPresent ? "✓" : "•"}
                  </span>
                  <span>{artifact.label}</span>
                  <span className="sr-only">
                    {isPresent ? " — present this session" : " — not yet produced"}
                  </span>
                </button>
                {i < ARTIFACTS.length - 1 && (
                  <span aria-hidden className="text-zinc-600">→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Inline detail panel */}
        {open && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-cyan-200">{open.label}</h3>
              <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-200">
                Step {open.stepNum} — {open.stepTitle}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-zinc-500">
              in: {inputLabels(open.inputs)} → out: {open.label}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">{open.description}</p>
          </div>
        )}
      </div>

      {/* The six steps — derived from the same chain, with explicit inputs */}
      <div className="mt-6 border-t border-zinc-800/80 pt-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          The six steps
        </div>
        <ol className="space-y-3">
          {ARTIFACTS.map((a) => (
            <li key={a.key} className="flex gap-3">
              <span
                className={[
                  "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  a.isUpload
                    ? "border border-zinc-700 bg-zinc-900 text-zinc-500"
                    : "border border-cyan-700/50 bg-cyan-500/10 text-cyan-300",
                ].join(" ")}
              >
                {a.stepNum}
              </span>
              <div className="flex flex-col gap-0.5 text-sm">
                <span className="font-medium text-zinc-100">
                  {a.stepTitle}
                  {a.isUpload && <span className="ml-2 text-xs font-normal text-zinc-500">(no AI)</span>}
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  in: <span className="text-zinc-400">{inputLabels(a.inputs)}</span>{" "}
                  → out: <span className="text-cyan-400/80">{a.label}</span>
                </span>
                <span className="leading-relaxed text-zinc-400">{a.oneLiner}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
