"use client";

import { useCallback, useState } from "react";
import Header from "@/components/icon-pipeline/Header";
import UploadCard from "@/components/icon-pipeline/UploadCard";
import ManifestReviewCard from "@/components/icon-pipeline/ManifestReviewCard";
import PromptReviewCard from "@/components/icon-pipeline/PromptReviewCard";
import IconGrid from "@/components/icon-pipeline/IconGrid";
import DebugDrawer from "@/components/icon-pipeline/DebugDrawer";
import GalleryPanel from "@/components/gallery/GalleryPanel";
import PromptDisclosure from "@/components/icon-pipeline/PromptDisclosure";
import { useIconPipeline } from "@/lib/icon/use-icon-pipeline";
import { analyzeImage, fetchPrompts, generateOneIcon } from "@/lib/icon/client-api";
import { ICON_ANALYSIS_PROMPT } from "@/lib/icon/prompts";
import {
  readImageFile,
  downloadDataUrl,
  copyText,
  slugify,
} from "@/lib/icon/download";
import {
  saveSource,
  saveRun,
  saveIcon,
  getSourceAsDataUrl,
} from "@/lib/storage/repo";
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

// Persistence is best-effort: a storage failure (private mode, quota) must
// never break the generation flow.
async function persist(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.warn(`[persist] ${label} failed:`, e);
  }
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
        persist("saveSource", () => saveSource(source));
      } catch (e) {
        p.setError("upload", e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setIsUploading(false);
      }
    },
    [p],
  );

  // Re-run an existing library source (dropped onto upload, or "Use" button).
  const handleUseSource = useCallback(
    async (sourceId: string) => {
      setIsUploading(true);
      try {
        const dataUrl = await getSourceAsDataUrl(sourceId);
        if (!dataUrl) throw new Error("That source is no longer in the library.");
        const source: SourceImage = {
          id: sourceId, // reuse stored id so we don't duplicate the blob
          imageUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
        };
        p.uploadImage(source);
      } catch (e) {
        p.setError("upload", e instanceof Error ? e.message : "Could not load source.");
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
          const settled: GeneratedIcon = {
            ...slot,
            status: generatedIcon.status,
            imageUrl: generatedIcon.imageUrl,
            error: generatedIcon.error,
            modelUsed: generatedIcon.modelUsed,
          };
          p.updateGeneratedIcon(slot.id, {
            status: settled.status,
            imageUrl: settled.imageUrl,
            error: settled.error,
            modelUsed: settled.modelUsed,
          });
          if (settled.status === "success" && settled.imageUrl) {
            persist("saveIcon", () => saveIcon(settled, run.id));
          }
        } catch (e) {
          p.updateGeneratedIcon(slot.id, {
            status: "failed",
            error: e instanceof Error ? e.message : "Generation failed.",
          });
        }
      });
    },
    [p, run.manifest, run.promptPack, run.id],
  );

  const handleGenerate = useCallback(async () => {
    if (!run.promptPack || !run.manifest || !run.sourceImage) return;
    p.approvePrompts(); // → generating_icons
    // Persist the run shell so icons have a parent in the library.
    persist("saveRun", () =>
      saveRun({
        id: run.id,
        sourceId: run.sourceImage.id,
        createdAt: run.createdAt,
        manifest: run.manifest,
        promptPack: run.promptPack,
        iconCount: run.manifest!.iconCount,
      }),
    );
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
  }, [p, run.promptPack, run.manifest, run.sourceImage, run.id, run.createdAt, generateIconsFor]);

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
  const hasSource = !!run.sourceImage?.imageUrl;
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
            onSourceDrop={handleUseSource}
            disabled={currentStep === "analyzing_icons"}
          />

          {hasSource && !showManifest && (
            <PromptDisclosure
              label="View analysis prompt that will be sent"
              prompt={`${ICON_ANALYSIS_PROMPT}\n\n[+ the uploaded image is sent as image input]`}
            />
          )}

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
              iconFamilyStyle={run.manifest?.iconFamilyStyle}
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

      <GalleryPanel onUseSource={handleUseSource} />
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
