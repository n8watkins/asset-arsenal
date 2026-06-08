"use client";

import { useState } from "react";
import { ARTIFACTS, type ArtifactKey } from "@/lib/icon/pipeline-guide";
import { STEPS } from "@/lib/icon/model-reference";

export default function PipelineOutline({
  present,
}: {
  present?: Partial<Record<ArtifactKey, boolean>>;
}) {
  const [selected, setSelected] = useState<ArtifactKey | null>(null);

  const openArtifact = selected
    ? ARTIFACTS.find((a) => a.key === selected) ?? null
    : null;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
      {/* 1. Intro */}
      <h2 className="text-lg font-semibold text-zinc-100">The icon pipeline</h2>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-zinc-300">
        The icon pipeline turns one screenshot into a set of standalone icons in
        six steps. Each step here is an independent, rerunnable breakpoint — edit
        any input, see the exact prompt before you run, and feed each step&rsquo;s
        output into the next.
      </p>

      {/* 2. The artifact chain — clickable */}
      <div className="mt-6">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          The artifact chain — click any piece to learn what it is
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
          {ARTIFACTS.map((artifact, i) => {
            const isPresent = present?.[artifact.key] ?? false;
            const isSelected = selected === artifact.key;
            return (
              <div
                key={artifact.key}
                className="flex items-center gap-x-2"
              >
                <button
                  type="button"
                  aria-expanded={isSelected}
                  onClick={() =>
                    setSelected((cur) =>
                      cur === artifact.key ? null : artifact.key,
                    )
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
                      isPresent
                        ? "bg-cyan-500/20 text-cyan-300"
                        : "bg-zinc-700/60 text-transparent",
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
                  <span aria-hidden className="text-zinc-600">
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Inline detail panel */}
        {openArtifact && (
          <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-base font-semibold text-cyan-200">
                {openArtifact.label}
              </h3>
              <span className="shrink-0 rounded-full border border-violet-400/40 bg-violet-500/10 px-2.5 py-0.5 text-xs font-medium text-violet-200">
                {openArtifact.producedByStep === null
                  ? "Uploaded — no AI"
                  : `Produced by: Step ${openArtifact.producedByStep}`}
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              {openArtifact.description}
            </p>
          </div>
        )}
      </div>

      {/* 3. Compact step list */}
      <div className="mt-6 border-t border-zinc-800/80 pt-5">
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
          The five steps
        </div>
        <ol className="space-y-2">
          {STEPS.map((step) => (
            <li key={step.num} className="flex gap-3 text-sm text-zinc-400">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-xs font-semibold text-zinc-300">
                {step.num}
              </span>
              <span className="leading-relaxed">
                <span className="font-medium text-zinc-200">{step.name}</span>
                <span className="text-zinc-500"> — {step.description}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
