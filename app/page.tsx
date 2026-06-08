"use client";

import { useCallback, useState } from "react";
import Header from "@/components/icon-pipeline/Header";
import UploadCard from "@/components/icon-pipeline/UploadCard";
import ManifestReviewCard from "@/components/icon-pipeline/ManifestReviewCard";
import PromptReviewCard from "@/components/icon-pipeline/PromptReviewCard";
import IconGrid from "@/components/icon-pipeline/IconGrid";
import DebugDrawer from "@/components/icon-pipeline/DebugDrawer";
import { useIconPipeline } from "@/lib/icon/use-icon-pipeline";
import { analyzeImage, fetchPrompts, generateOneIcon } from "@/lib/icon/client-api";
import {
  readImageFile,
  downloadDataUrl,
  copyText,
  slugify,
} from "@/lib/icon/download";
import type { GeneratedIcon, SourceImage } from "@/types/icon-pipeline";

// Run up to `limit` async tasks at a time.
async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export default function Home() {
  const p = useIconPipeline();
  const { run, currentStep } = p;
  const [isUploading, setIsUploading] = useState(false);

  // ---- Stage 1/2: upload + analysis ----
  const handleFileSelected = useCallback(
    async (file: File) => {
      setIsUploading(true);
      try {
        const { dataUrl, width, height } = await readImageFile(file);
        const source: SourceImage = {
          id: crypto.randomUUID(),
          imageUrl: dataUrl,
          fileName: file.name,
          mimeType: file.type,
          width,
          height,
          uploadedAt: new Date().toISOString(),
        };
        p.uploadImage(source);
      } catch (e) {
        p.setError("upload", e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    },
    [p],
  );

  const handleExtract = useCallback(async () => {
    if (!run.sourceImage?.imageUrl) return;
    p.startAnalysis();
    try {
      const { manifest } = await analyzeImage(
        run.sourceImage.imageUrl,
        run.sourceImage.fileName,
      );
      p.setManifest(manifest);
    } catch (e) {
      p.setError("analysis", e instanceof Error ? e.message : "Analysis failed.");
    }
  }, [p, run.sourceImage]);

  // ---- Stage 3→4: approve manifest, generate prompts ----
  const handleApproveManifest = useCallback(async () => {
    if (!run.manifest) return;
    p.approveManifest(); // → generating_prompts (loading)
    try {
      const { promptPack } = await fetchPrompts(run.manifest);
      p.setPromptPack(promptPack);
    } catch (e) {
      p.setError(
        "prompt_generation",
        e instanceof Error ? e.message : "Prompt generation failed.",
      );
    }
  }, [p, run.manifest]);

  // ---- Stage 5→6: generate icons (progressive, per-icon) ----
  const generateIconsFor = useCallback(
    async (targets: GeneratedIcon[]) => {
      const manifest = run.manifest;
      const promptPack = run.promptPack;
      if (!manifest || !promptPack) return;
      await runPool(targets, 3, async (slot) => {
        p.updateGeneratedIcon(slot.id, { status: "generating", error: undefined });
        const icon = manifest.icons.find((ic) => ic.id === slot.iconId);
        const prompt = promptPack.prompts.find((pr) => pr.iconId === slot.iconId);
        if (!icon || !prompt) {
          p.updateGeneratedIcon(slot.id, {
            status: "failed",
            error: "Missing icon or prompt for this slot.",
          });
          return;
        }
        try {
          const { generatedIcon } = await generateOneIcon({
            icon,
            prompt,
            iconFamilyStyle: manifest.iconFamilyStyle,
          });
          p.updateGeneratedIcon(slot.id, {
            status: generatedIcon.status,
            imageUrl: generatedIcon.imageUrl,
            error: generatedIcon.error,
            modelUsed: generatedIcon.modelUsed,
          });
        } catch (e) {
          p.updateGeneratedIcon(slot.id, {
            status: "failed",
            error: e instanceof Error ? e.message : "Generation failed.",
          });
        }
      });
    },
    [p, run.manifest, run.promptPack],
  );

  const handleGenerate = useCallback(async () => {
    if (!run.promptPack) return;
    p.approvePrompts(); // → generating_icons
    const slots: GeneratedIcon[] = run.promptPack.prompts.map((pr) => ({
      id: crypto.randomUUID(),
      iconId: pr.iconId,
      iconName: pr.iconName,
      prompt: pr.prompt,
      imageUrl: "",
      modelUsed: pr.recommendedModel,
      status: "pending",
      createdAt: new Date().toISOString(),
    }));
    p.initGeneratedIcons(slots);
    await generateIconsFor(slots);
    p.finishGeneration();
  }, [p, run.promptPack, generateIconsFor]);

  const handleRegenerate = useCallback(
    async (generatedIconId: string) => {
      const slot = run.generatedIcons.find((g) => g.id === generatedIconId);
      if (slot) await generateIconsFor([slot]);
    },
    [run.generatedIcons, generateIconsFor],
  );

  // ---- Export (PRD §20) ----
  const handleDownload = useCallback((icon: GeneratedIcon) => {
    downloadDataUrl(icon.imageUrl, `${slugify(icon.iconName)}.png`);
  }, []);

  const handleDownloadAll = useCallback(() => {
    run.generatedIcons
      .filter((g) => g.status === "success" && g.imageUrl)
      .forEach((g, i) =>
        setTimeout(() => downloadDataUrl(g.imageUrl, `${slugify(g.iconName)}.png`), i * 120),
      );
  }, [run.generatedIcons]);

  const handleCopyManifest = useCallback(() => {
    if (run.manifest) copyText(JSON.stringify(run.manifest, null, 2));
  }, [run.manifest]);

  const handleCopyPrompts = useCallback(() => {
    if (run.promptPack) copyText(JSON.stringify(run.promptPack, null, 2));
  }, [run.promptPack]);

  // ---- Render: accumulating chat-style flow ----
  const latestError = run.errors[run.errors.length - 1];
  const showManifest = !!run.manifest;
  const showPrompts = !!run.promptPack;
  const showGrid = run.generatedIcons.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Header currentStep={currentStep} onReset={p.reset} />

      <main className="flex flex-1 justify-center px-4 py-8">
        <div className="flex w-full max-w-3xl flex-col gap-6">
          <UploadCard
            sourceImage={run.sourceImage ?? null}
            isUploading={isUploading}
            onFileSelected={handleFileSelected}
            onExtract={handleExtract}
            disabled={currentStep === "analyzing_icons"}
          />

          {currentStep === "analyzing_icons" && (
            <StatusLine text="Analyzing the image for icon candidates…" />
          )}

          {showManifest && (
            <ManifestReviewCard
              manifest={run.manifest!}
              onEditIcon={p.editIcon}
              onRemoveIcon={p.removeIcon}
              onApprove={handleApproveManifest}
              onRerun={handleExtract}
              busy={currentStep === "generating_prompts"}
            />
          )}

          {currentStep === "generating_prompts" && (
            <StatusLine text="Writing generation prompts for each icon…" />
          )}

          {showPrompts && (
            <PromptReviewCard
              promptPack={run.promptPack!}
              onEditPrompt={p.editPrompt}
              onApprove={() => {}}
              onGenerate={handleGenerate}
              busy={currentStep === "generating_icons"}
            />
          )}

          {showGrid && (
            <IconGrid
              icons={run.generatedIcons}
              onRegenerate={handleRegenerate}
              onDownload={handleDownload}
              onDownloadAll={handleDownloadAll}
              onCopyManifest={handleCopyManifest}
              onCopyPrompts={handleCopyPrompts}
            />
          )}

          {currentStep === "error" && latestError && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              <span>
                <span className="font-mono text-xs uppercase tracking-widest text-red-500">
                  {latestError.step}
                </span>{" "}
                — {latestError.message}
              </span>
              <button
                onClick={p.clearError}
                className="shrink-0 rounded-lg border border-red-800 px-3 py-1 text-xs text-red-200 hover:bg-red-900/40"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </main>

      <DebugDrawer run={run} />
    </div>
  );
}

function StatusLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-cyan-900/60 bg-zinc-900 px-4 py-3 font-mono text-sm text-cyan-300">
      <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
      {text}
    </div>
  );
}
