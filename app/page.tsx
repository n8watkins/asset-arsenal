"use client";

import { useCallback, useState } from "react";
import Nav from "@/components/Nav";
import UploadCard from "@/components/icon-pipeline/UploadCard";
import IconGrid from "@/components/icon-pipeline/IconGrid";
import DebugDrawer from "@/components/icon-pipeline/DebugDrawer";
import GalleryPicker from "@/components/gallery/GalleryPicker";
import PromptDisclosure from "@/components/icon-pipeline/PromptDisclosure";
import { useIconPipeline } from "@/lib/icon/use-icon-pipeline";
import {
  analyzeImage,
  composeCollectionPrompt,
  generateCollectionImage,
  composeIndividualPrompts,
  generateIconsBatch,
} from "@/lib/icon/client-api";
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

  // ---- Step 0: upload ----
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

  const handleUseSource = useCallback(
    async (sourceId: string) => {
      setIsUploading(true);
      try {
        const dataUrl = await getSourceAsDataUrl(sourceId);
        if (!dataUrl) throw new Error("That source is no longer in the library.");
        p.uploadImage({
          id: sourceId,
          imageUrl: dataUrl,
          uploadedAt: new Date().toISOString(),
        });
      } catch (e) {
        p.setError("upload", e instanceof Error ? e.message : "Could not load source.");
      } finally {
        setIsUploading(false);
      }
    },
    [p],
  );

  const handleUseDataUrl = useCallback(
    (img: { id: string; dataUrl: string; fileName: string; kind: "source" | "icon" }) => {
      p.uploadImage({
        id: img.kind === "source" ? img.id : crypto.randomUUID(),
        imageUrl: img.dataUrl,
        fileName: img.fileName,
        uploadedAt: new Date().toISOString(),
      });
    },
    [p],
  );

  // ---- Step 1: analyze ----
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

  // ---- Step 2: compose collection prompt ----
  const handleComposeCollectionPrompt = useCallback(async () => {
    if (!run.manifest) return;
    p.startCollectionPrompt();
    try {
      const { collectionPrompt } = await composeCollectionPrompt(run.manifest);
      p.setCollectionPrompt(collectionPrompt);
    } catch (e) {
      p.setError(
        "collection_prompt",
        e instanceof Error ? e.message : "Collection prompt composition failed.",
      );
    }
  }, [p, run.manifest]);

  // ---- Step 3: generate contact sheet ----
  const handleGenerateCollectionImage = useCallback(async () => {
    if (!run.manifest || !run.collectionPrompt || !run.sourceImage?.imageUrl) return;
    p.startCollectionImage();
    try {
      const { collectionImage } = await generateCollectionImage({
        sourceImageBase64: run.sourceImage.imageUrl,
        manifest: run.manifest,
        collectionPrompt: run.collectionPrompt,
      });
      p.setCollectionImage(collectionImage);
    } catch (e) {
      p.setError(
        "collection_image",
        e instanceof Error ? e.message : "Contact sheet generation failed.",
      );
    }
  }, [p, run.manifest, run.collectionPrompt, run.sourceImage]);

  // ---- Step 4: compose individual prompts ----
  const handleComposeIndividualPrompts = useCallback(async () => {
    if (!run.manifest || !run.collectionImage?.imageUrl) return;
    p.startIndividualPrompts();
    try {
      const { individualPrompts } = await composeIndividualPrompts({
        collectionImageBase64: run.collectionImage.imageUrl,
        manifest: run.manifest,
      });
      p.setIndividualPrompts(individualPrompts);
    } catch (e) {
      p.setError(
        "individual_prompts",
        e instanceof Error ? e.message : "Icon prompt composition failed.",
      );
    }
  }, [p, run.manifest, run.collectionImage]);

  // ---- Step 5: generate icons (batch) ----
  const handleGenerateIcons = useCallback(async () => {
    if (!run.individualPrompts || !run.collectionImage?.imageUrl) return;
    p.startGeneration();
    persist("saveRun", () =>
      saveRun({
        id: run.id,
        sourceId: run.sourceImage.id,
        createdAt: run.createdAt,
        manifest: run.manifest,
        collectionPrompt: run.collectionPrompt,
        individualPrompts: run.individualPrompts,
        iconCount: run.individualPrompts!.iconPrompts.length,
      }),
    );
    try {
      const { generatedIcons } = await generateIconsBatch({
        collectionImageBase64: run.collectionImage.imageUrl,
        individualPrompts: run.individualPrompts,
      });
      p.initGeneratedIcons(generatedIcons);
      p.finishGeneration();
      generatedIcons
        .filter((g) => g.status === "success" && g.imageUrl)
        .forEach((g) => persist("saveIcon", () => saveIcon(g, run.id)));
    } catch (e) {
      p.setError(
        "icon_generation",
        e instanceof Error ? e.message : "Icon generation failed.",
      );
    }
  }, [p, run]);

  const handleRegenerate = useCallback(async () => {
    // Single-icon regeneration is a bench affordance; the main page regenerates
    // the whole set for simplicity.
    await handleGenerateIcons();
  }, [handleGenerateIcons]);

  // ---- Export ----
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
    if (run.individualPrompts) copyText(JSON.stringify(run.individualPrompts, null, 2));
  }, [run.individualPrompts]);

  const latestError = run.errors[run.errors.length - 1];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Nav />

      <main className="flex flex-1 justify-center px-4 py-10">
        <div className="flex w-full max-w-3xl flex-col gap-8">
          {currentStep !== "idle" && (
            <div className="flex items-center justify-end">
              <button
                onClick={p.reset}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                ↩ Start over
              </button>
            </div>
          )}

          <UploadCard
            sourceImage={run.sourceImage ?? null}
            isUploading={isUploading}
            onFileSelected={handleFileSelected}
            onExtract={handleExtract}
            onSourceDrop={handleUseSource}
            disabled={currentStep === "analyzing"}
          />

          <div className="-mt-2 flex items-center gap-3 text-sm text-zinc-500">
            <span>or reuse an image you&apos;ve already saved:</span>
            <GalleryPicker
              onPick={handleUseDataUrl}
              label="Choose from gallery"
              className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-cyan-400/80 transition-colors hover:border-cyan-500/60 hover:text-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {currentStep === "analyzing" && (
            <StatusLine text="Analyzing the image for icon candidates…" />
          )}

          {/* Step 1 result — manifest */}
          {run.manifest && (
            <StepCard
              title="1 · Icon manifest"
              subtitle={`${run.manifest.iconCount} icons identified`}
            >
              <PromptDisclosure
                label="View manifest JSON"
                prompt={JSON.stringify(run.manifest, null, 2)}
              />
              <NextButton
                onClick={handleComposeCollectionPrompt}
                busy={currentStep === "composing_collection_prompt"}
                disabled={!!run.collectionPrompt}
                label="Compose collection prompt →"
              />
            </StepCard>
          )}

          {currentStep === "composing_collection_prompt" && (
            <StatusLine text="Composing the icon collection prompt…" />
          )}

          {/* Step 2 result — collection prompt */}
          {run.collectionPrompt && (
            <StepCard title="2 · Collection prompt">
              <p className="whitespace-pre-wrap rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">
                {run.collectionPrompt}
              </p>
              <NextButton
                onClick={handleGenerateCollectionImage}
                busy={currentStep === "generating_collection_image"}
                disabled={!!run.collectionImage}
                label="Generate contact sheet →"
              />
            </StepCard>
          )}

          {currentStep === "generating_collection_image" && (
            <StatusLine text="Generating the icon collection image (contact sheet)…" />
          )}

          {/* Step 3 result — contact sheet */}
          {run.collectionImage?.imageUrl && (
            <StepCard title="3 · Contact sheet">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={run.collectionImage.imageUrl}
                alt="contact sheet"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 object-contain"
              />
              <NextButton
                onClick={handleComposeIndividualPrompts}
                busy={currentStep === "composing_individual_prompts"}
                disabled={!!run.individualPrompts}
                label="Compose icon prompts →"
              />
            </StepCard>
          )}

          {currentStep === "composing_individual_prompts" && (
            <StatusLine text="Composing one prompt per icon from the contact sheet…" />
          )}

          {/* Step 4 result — individual prompts */}
          {run.individualPrompts && (
            <StepCard
              title="4 · Icon prompts"
              subtitle={`${run.individualPrompts.iconPrompts.length} prompts`}
            >
              <PromptDisclosure
                label="View individual prompts JSON"
                prompt={JSON.stringify(run.individualPrompts, null, 2)}
              />
              <NextButton
                onClick={handleGenerateIcons}
                busy={currentStep === "generating_icons"}
                disabled={run.generatedIcons.length > 0}
                label="Generate icons →"
              />
            </StepCard>
          )}

          {currentStep === "generating_icons" && (
            <StatusLine text="Generating each icon from the contact sheet…" />
          )}

          {/* Step 5 result — generated icons */}
          {run.generatedIcons.length > 0 && (
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
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-800 bg-red-950/30 px-5 py-4 text-base text-red-300">
              <span>
                <span className="font-mono text-sm uppercase tracking-widest text-red-500">
                  {latestError.step}
                </span>{" "}
                — {latestError.message}
              </span>
              <button
                onClick={p.clearError}
                className="shrink-0 rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-200 hover:bg-red-900/40"
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

function StepCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">{title}</h2>
        {subtitle && <p className="mt-1 text-base text-zinc-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function NextButton({
  onClick,
  busy,
  disabled,
  label,
}: {
  onClick: () => void;
  busy: boolean;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || disabled}
      className="self-start rounded-xl bg-violet-600 px-6 py-2.5 text-base font-semibold text-white transition-colors hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:pointer-events-none disabled:opacity-40"
    >
      {busy ? "Working…" : label}
    </button>
  );
}

function StatusLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-cyan-900/60 bg-zinc-900 px-5 py-4 font-mono text-base text-cyan-300">
      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400" />
      {text}
    </div>
  );
}
