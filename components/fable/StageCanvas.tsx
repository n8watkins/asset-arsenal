"use client";

// Fable Bench — the stage-aware main canvas. Routes the current stage to the
// matching panel; intake hosts an inviting dropzone that feeds the chat path.

import { useRef, useState } from "react";
import { IMAGE_UPLOAD_LIMITS } from "@/lib/icon/models";
import { totalCostUSD } from "@/lib/fable/pricing";
import type { FableProject, IconCandidate } from "@/lib/fable/types";
import type { UseFable } from "@/lib/fable/use-fable";
import BlueprintPanel from "./BlueprintPanel";
import FinalsGrid from "./FinalsGrid";
import SheetViewer from "./SheetViewer";
import SourceReview from "./SourceReview";
import { fmtUsd } from "./ui";

const EXAMPLES = [
  "Make me a matching icon pack for this dashboard",
  "Use this as-is and pull out the icon set",
  "Upgrade this into a premium dark-mode look first",
];

export default function StageCanvas({ fable }: { fable: UseFable }) {
  const { project, busy } = fable;
  const working = busy.step !== null;

  switch (project.stage) {
    case "intake":
      return <Intake fable={fable} working={working} />;
    case "source_review":
      return (
        <SourceReview
          project={project}
          busy={working}
          devMode={fable.devMode}
          onApprove={fable.approveSource}
          onRegenerate={fable.regenerateSource}
        />
      );
    case "blueprint":
      return (
        <BlueprintPanel
          project={project}
          busy={working}
          devMode={fable.devMode}
          onGeneratePreviews={fable.runPreviews}
          onRemoveCandidate={fable.removeCandidate}
          onUpdateCandidate={(id: string, patch: Partial<IconCandidate>) =>
            fable.updateCandidate(id, patch)
          }
        />
      );
    case "preview_review":
      return (
        <SheetViewer
          project={project}
          busy={working}
          devMode={fable.devMode}
          onGenerateFinals={fable.approveAndGenerateFinals}
          onRegenerateSheet={fable.regenerateSheet}
          onIconOp={(text) => fable.sendMessage(text, null)}
          onTryAnotherSheet={(instruction) =>
            fable.sendMessage(`Try another sheet: ${instruction}`, null)
          }
        />
      );
    case "finals":
      return (
        <FinalsGrid
          project={project}
          busy={working}
          devMode={fable.devMode}
          onRetry={fable.retryFinal}
          onRegenerate={(iconId) =>
            fable.sendMessage(`Regenerate the ${iconId} icon.`, null)
          }
          onSaveFinish={() => fable.sendMessage("Save and finish the project.", null)}
        />
      );
    case "complete":
      return <Complete project={project} />;
    default:
      return null;
  }
}

function Intake({ fable, working }: { fable: UseFable; working: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onFile(f: File | undefined | null) {
    if (f) fable.sendMessage("", f);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg text-center">
        <h2 className="text-2xl font-bold text-zinc-100">
          Drop a screenshot. Get a matching icon pack.
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Fable studies your UI, proposes an icon set, and renders them to match —
          all in one guided flow.
        </p>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFile(e.dataTransfer.files?.[0]);
          }}
          className={`mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-14 transition-colors ${
            dragging
              ? "border-cyan-500/70 bg-cyan-950/20"
              : "border-zinc-700 bg-zinc-900/30 hover:border-cyan-500/50"
          } ${working ? "pointer-events-none opacity-50" : ""}`}
        >
          <span className="text-3xl text-cyan-400/70">⬆</span>
          <span className="text-sm text-zinc-300">Drop an image or click to browse</span>
          <span className="text-xs text-zinc-600">
            PNG, JPEG, or WebP · max {IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB
          </span>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_UPLOAD_LIMITS.allowedMimeTypes.join(",")}
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />

        <div className="mt-6">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600">Try asking</p>
          <div className="mt-2 flex flex-col gap-1.5">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                disabled={working}
                onClick={() => fable.sendMessage(ex, null)}
                className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-left text-xs text-zinc-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-200 disabled:opacity-40"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Complete({ project }: { project: FableProject }) {
  const approved =
    project.improved[project.improved.length - 1] ?? project.original;
  const finals = project.finals.filter((f) => f.status === "success");
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{project.name} — complete</h2>
        <p className="text-sm text-zinc-500">
          {finals.length} icons in the {project.style?.styleName ?? "extracted"} style ·{" "}
          total {fmtUsd(totalCostUSD(project.usage))}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Summary label="Source">
          {approved && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={approved.imageUrl} alt="source" className="w-full rounded-lg object-contain" />
          )}
        </Summary>
        <Summary label="Style">
          <p className="text-sm text-zinc-200">{project.style?.styleName}</p>
          <p className="mt-1 text-xs text-zinc-500">{project.style?.summary}</p>
        </Summary>
        <Summary label="Counts">
          <ul className="text-xs text-zinc-400">
            <li>{project.candidates.filter((c) => c.status === "active").length} candidates</li>
            <li>{project.sheets.filter((s) => s.status !== "superseded").length} sheets</li>
            <li>{finals.length} final icons</li>
          </ul>
        </Summary>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {finals.map((f) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={f.id}
            src={f.imageUrl}
            alt={f.name}
            className="aspect-square w-full rounded-lg bg-zinc-900 object-contain ring-1 ring-zinc-800"
          />
        ))}
      </div>
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-3">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      {children}
    </div>
  );
}
