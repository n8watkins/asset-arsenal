"use client";

import { useState } from "react";
import {
  SAMPLE_MANIFEST,
  SAMPLE_PROMPT_PACK,
  SAMPLE_GENERATED_ICONS,
} from "@/lib/icon/fixtures";
import type {
  SourceImage,
  IconManifest,
  DecomposedIcon,
  IconPromptPack,
  GeneratedIcon,
  IconExtractionRun,
} from "@/types/icon-pipeline";
import UploadCard from "@/components/icon-pipeline/UploadCard";
import ManifestReviewCard from "@/components/icon-pipeline/ManifestReviewCard";
import PromptReviewCard from "@/components/icon-pipeline/PromptReviewCard";
import IconGrid from "@/components/icon-pipeline/IconGrid";
import DebugDrawer from "@/components/icon-pipeline/DebugDrawer";

const STUB_SOURCE_IMAGE: SourceImage = {
  id: "src_preview",
  imageUrl: "",
  fileName: "dashboard_screenshot.png",
  mimeType: "image/png",
  width: 1440,
  height: 900,
  uploadedAt: new Date().toISOString(),
};

const STUB_RUN: IconExtractionRun = {
  id: "run_preview_001",
  sourceImage: STUB_SOURCE_IMAGE,
  manifest: SAMPLE_MANIFEST,
  promptPack: SAMPLE_PROMPT_PACK,
  generatedIcons: SAMPLE_GENERATED_ICONS,
  currentStep: "icons_ready",
  errors: [
    {
      step: "icon_generation",
      message: "Generation failed for icon_002: model returned empty response.",
      rawError: { code: 500, detail: "empty_response" },
      createdAt: new Date().toISOString(),
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function PreviewPage() {
  const [sourceImage, setSourceImage] = useState<SourceImage | null>(
    STUB_SOURCE_IMAGE
  );
  const [manifest, setManifest] = useState<IconManifest>(SAMPLE_MANIFEST);
  const [promptPack, setPromptPack] = useState<IconPromptPack>(
    SAMPLE_PROMPT_PACK
  );
  const [icons, setIcons] = useState<GeneratedIcon[]>(SAMPLE_GENERATED_ICONS);

  // UploadCard handlers
  const handleFileSelected = (file: File) => {
    const url = URL.createObjectURL(file);
    setSourceImage({
      id: "src_new",
      imageUrl: url,
      fileName: file.name,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
    });
  };

  // ManifestReviewCard handlers
  const handleEditIcon = (iconId: string, patch: Partial<DecomposedIcon>) => {
    setManifest((m) => ({
      ...m,
      icons: m.icons.map((ic) =>
        ic.id === iconId ? { ...ic, ...patch } : ic
      ),
    }));
  };

  const handleRemoveIcon = (iconId: string) => {
    setManifest((m) => ({
      ...m,
      icons: m.icons.filter((ic) => ic.id !== iconId),
      iconCount: m.iconCount - 1,
    }));
  };

  // PromptReviewCard handlers
  const handleEditPrompt = (iconId: string, text: string) => {
    setPromptPack((pp) => ({
      ...pp,
      prompts: pp.prompts.map((p) =>
        p.iconId === iconId ? { ...p, prompt: text } : p
      ),
    }));
  };

  // IconGrid handlers
  const handleRegenerate = (iconId: string) => {
    setIcons((prev) =>
      prev.map((ic) =>
        ic.id === iconId ? { ...ic, status: "pending", error: undefined } : ic
      )
    );
  };

  const handleDownload = (icon: GeneratedIcon) => {
    console.log("download", icon.iconName);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 pb-24">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-100">
            Component Preview
          </h1>
          <span className="text-xs text-zinc-500 font-mono border border-zinc-800 px-2 py-1 rounded-lg">
            asset-arsenal / preview
          </span>
        </div>

        {/* UploadCard */}
        <section>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-3">
            1 — UploadCard
          </p>
          <UploadCard
            sourceImage={sourceImage}
            isUploading={false}
            onFileSelected={handleFileSelected}
            onExtract={() => console.log("extract")}
          />
        </section>

        {/* ManifestReviewCard */}
        <section>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-3">
            2 — ManifestReviewCard
          </p>
          <ManifestReviewCard
            manifest={manifest}
            onEditIcon={handleEditIcon}
            onRemoveIcon={handleRemoveIcon}
            onApprove={() => console.log("approve manifest")}
            onRerun={() => console.log("rerun analysis")}
          />
        </section>

        {/* PromptReviewCard */}
        <section>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-3">
            3 — PromptReviewCard
          </p>
          <PromptReviewCard
            promptPack={promptPack}
            onEditPrompt={handleEditPrompt}
            onApprove={() => console.log("approve prompts")}
            onGenerate={() => console.log("generate icons")}
          />
        </section>

        {/* IconGrid */}
        <section>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-3">
            4 — IconGrid
          </p>
          <IconGrid
            icons={icons}
            onRegenerate={handleRegenerate}
            onDownload={handleDownload}
            onDownloadAll={() => console.log("download all")}
            onCopyManifest={() => console.log("copy manifest")}
            onCopyPrompts={() => console.log("copy prompts")}
          />
        </section>

        {/* DebugDrawer note */}
        <section>
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-3">
            5 — DebugDrawer (fixed bottom-right button)
          </p>
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
            <p className="text-zinc-400 text-sm">
              The debug drawer is accessible via the{" "}
              <span className="text-cyan-400 font-mono">Debug</span> button
              fixed to the bottom-right of the screen.
            </p>
          </div>
        </section>
      </div>

      {/* DebugDrawer — fixed to viewport */}
      <DebugDrawer run={STUB_RUN} />
    </div>
  );
}
