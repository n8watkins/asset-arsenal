"use client";

import Link from "next/link";
import type { PipelineStep } from "@/types/icon-pipeline";
import { MODEL_ROLES } from "@/lib/icon/models";

// ---------------------------------------------------------------------------
// Step badge helpers
// ---------------------------------------------------------------------------

const STEP_LABELS: Record<PipelineStep, string> = {
  idle: "idle",
  image_uploaded: "image uploaded",
  analyzing_icons: "analyzing…",
  manifest_ready: "manifest ready",
  generating_prompts: "generating prompts…",
  prompts_ready: "prompts ready",
  generating_icons: "generating icons…",
  icons_ready: "done",
  error: "error",
};

const STEP_COLORS: Record<PipelineStep, string> = {
  idle: "bg-zinc-700 text-zinc-400",
  image_uploaded: "bg-cyan-900/50 text-cyan-300",
  analyzing_icons: "bg-violet-900/50 text-violet-300 animate-pulse",
  manifest_ready: "bg-cyan-900/50 text-cyan-300",
  generating_prompts: "bg-violet-900/50 text-violet-300 animate-pulse",
  prompts_ready: "bg-cyan-900/50 text-cyan-300",
  generating_icons: "bg-violet-900/50 text-violet-300 animate-pulse",
  icons_ready: "bg-emerald-900/50 text-emerald-300",
  error: "bg-red-900/50 text-red-300",
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type HeaderProps = {
  currentStep: PipelineStep;
  onReset: () => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Header({ currentStep, onReset }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/90 px-5 py-3 backdrop-blur-sm">
      {/* Left: app name + step badge */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="select-none font-mono text-lg font-semibold tracking-tight text-zinc-100">
          <span className="text-cyan-400 mr-1">◆</span>Asset Arsenal
        </span>

        {/* Step badge */}
        <span
          className={`rounded px-2 py-0.5 font-mono text-xs font-medium ${STEP_COLORS[currentStep]}`}
        >
          {STEP_LABELS[currentStep]}
        </span>
      </div>

      {/* Center: model roles summary */}
      <div className="hidden md:flex items-center gap-3 text-xs text-zinc-500 font-mono min-w-0">
        <span className="flex items-center gap-1">
          <span className="text-zinc-600">vision</span>
          <span className="text-cyan-500/70">{MODEL_ROLES.visionAnalyzerModel}</span>
        </span>
        <span className="text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <span className="text-zinc-600">prompts</span>
          <span className="text-cyan-500/70">{MODEL_ROLES.promptWriterModel}</span>
        </span>
        <span className="text-zinc-700">·</span>
        <span className="flex items-center gap-1">
          <span className="text-zinc-600">gen</span>
          <span className="text-cyan-500/70">{MODEL_ROLES.imageGeneratorModel}</span>
        </span>
      </div>

      {/* Right: bench link + reset button */}
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/gallery"
          className="rounded px-3 py-1.5 font-mono text-xs font-medium text-cyan-400/80 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-800 hover:text-cyan-300 hover:ring-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          gallery
        </Link>
        <Link
          href="/bench"
          className="rounded px-3 py-1.5 font-mono text-xs font-medium text-cyan-400/80 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-800 hover:text-cyan-300 hover:ring-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          bench ↗
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="rounded px-3 py-1.5 font-mono text-xs font-medium text-zinc-400 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-800 hover:text-zinc-100 hover:ring-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          reset
        </button>
      </div>
    </header>
  );
}
