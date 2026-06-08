"use client";

import Header from "@/components/icon-pipeline/Header";
import { useIconPipeline } from "@/lib/icon/use-icon-pipeline";
import type { PipelineStep } from "@/types/icon-pipeline";

// ---------------------------------------------------------------------------
// §10 copy: one short descriptive line per step shown in the timeline
// ---------------------------------------------------------------------------

const STEP_COPY: Partial<Record<PipelineStep, (n?: number) => string>> = {
  idle: () => "Upload an image that contains icons.",
  image_uploaded: () => "Image received. Ready to analyze.",
  analyzing_icons: () => "Analyzing the image for icon candidates…",
  manifest_ready: (n) =>
    `I found ${n ?? 0} icon candidate${n === 1 ? "" : "s"}. Review and approve the manifest.`,
  generating_prompts: () => "Writing generation prompts for each icon…",
  prompts_ready: () => "Prompts are ready. Review and approve before generating.",
  generating_icons: () => "Generating icons — this may take a moment.",
  icons_ready: () => "All icons generated. Download or export below.",
  error: () => "Something went wrong. Check the error and retry.",
};

// Steps in display order (we only show steps up to + including currentStep)
const PIPELINE_ORDER: PipelineStep[] = [
  "idle",
  "image_uploaded",
  "analyzing_icons",
  "manifest_ready",
  "generating_prompts",
  "prompts_ready",
  "generating_icons",
  "icons_ready",
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const { run, currentStep, reset } = useIconPipeline();

  // Determine how many steps to show in the timeline
  const stepIndex = PIPELINE_ORDER.indexOf(
    currentStep === "error" ? "idle" : currentStep
  );
  const visibleSteps =
    currentStep === "error"
      ? PIPELINE_ORDER.slice(0, 1) // on error just show idle + error note
      : PIPELINE_ORDER.slice(0, stepIndex + 1);

  const iconCount = run.manifest?.iconCount;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* ----------------------------------------------------------------- */}
      {/* App header                                                         */}
      {/* ----------------------------------------------------------------- */}
      <Header currentStep={currentStep} onReset={reset} />

      {/* ----------------------------------------------------------------- */}
      {/* Main chat-style column                                             */}
      {/* ----------------------------------------------------------------- */}
      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="flex w-full max-w-3xl flex-col gap-3">

          {/* -------------------------------------------------------------- */}
          {/* INTEGRATION POINT: stage cards (UploadCard, ManifestReviewCard, */}
          {/* PromptReviewCard, GenerationCard, DownloadCard) mount here.     */}
          {/* Replace the timeline rows below with the real card components   */}
          {/* once they are wired in WP5+.                                    */}
          {/* -------------------------------------------------------------- */}

          {/* Temporary step timeline (replaced by rich cards later) */}
          {visibleSteps.map((step) => {
            const isActive = step === currentStep && currentStep !== "error";
            const copyFn = STEP_COPY[step];
            const label = copyFn ? copyFn(iconCount) : step;

            return (
              <div
                key={step}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 font-mono text-sm transition-colors ${
                  isActive
                    ? "border-cyan-800 bg-zinc-900 text-zinc-100"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-500"
                }`}
              >
                {/* Role indicator */}
                <span
                  className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-widest ${
                    isActive ? "text-cyan-400" : "text-zinc-600"
                  }`}
                >
                  {isActive ? "▶" : "✓"}
                </span>
                <span>{label}</span>
              </div>
            );
          })}

          {/* Error banner */}
          {currentStep === "error" && run.errors.length > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-red-800 bg-red-950/30 px-4 py-3 font-mono text-sm text-red-300">
              <span className="mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-widest text-red-500">
                ✕
              </span>
              <span>{run.errors[run.errors.length - 1].message}</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
