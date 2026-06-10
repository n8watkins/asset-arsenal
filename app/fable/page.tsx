"use client";

// Fable Bench — the productized image→icon-pack workspace.
//
// In-memory + IndexedDB state only (no URL state, so no Suspense needed). The
// page is a thin shell: a top bar (project name / stage rail / mode toggle /
// cost ticker / projects+new), the chat column, the stage-aware canvas, and —
// in Dev Mode only — the bottom drawer.

import { useState } from "react";
import Nav from "@/components/Nav";
import { totalCostUSD } from "@/lib/fable/pricing";
import { FABLE_STAGES, type FableStage } from "@/lib/fable/types";
import { useFable } from "@/lib/fable/use-fable";
import ChatPanel from "@/components/fable/ChatPanel";
import DevDrawer from "@/components/fable/DevDrawer";
import ProjectsModal from "@/components/fable/ProjectsModal";
import StageCanvas from "@/components/fable/StageCanvas";
import { fmtUsd, STAGE_LABELS } from "@/components/fable/ui";

export default function FablePage() {
  const fable = useFable();
  const { project } = fable;
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const openaiCost = totalCostUSD(project.usage, "openai");
  const geminiCalls = project.usage.filter((u) => u.provider === "gemini").length;

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <Nav />

      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-950 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">◆</span>
          <span className="text-sm font-semibold">Fable Bench</span>
        </div>

        <div className="h-5 w-px bg-zinc-800" />

        {editingName ? (
          <input
            autoFocus
            defaultValue={project.name}
            onBlur={(e) => {
              fable.renameProject(e.target.value);
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                fable.renameProject((e.target as HTMLInputElement).value);
                setEditingName(false);
              }
              if (e.key === "Escape") setEditingName(false);
            }}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm focus:border-cyan-500/60 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm text-zinc-300 hover:text-zinc-100"
            title="Click to rename"
          >
            {project.name}
          </button>
        )}

        {/* Stage rail */}
        <StageRail current={project.stage} />

        <div className="ml-auto flex items-center gap-3">
          {/* Cost ticker */}
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-xs">
            <span className="text-emerald-300">{fmtUsd(openaiCost)}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-violet-300">{geminiCalls} gemini</span>
          </div>

          {/* Mode toggle */}
          <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-900/50 p-0.5 text-xs">
            <button
              onClick={() => fable.setDevMode(false)}
              className={`rounded-md px-2.5 py-1 ${
                !fable.devMode ? "bg-cyan-500/20 text-cyan-200" : "text-zinc-500"
              }`}
            >
              Live
            </button>
            <button
              onClick={() => fable.setDevMode(true)}
              className={`rounded-md px-2.5 py-1 ${
                fable.devMode ? "bg-violet-500/20 text-violet-200" : "text-zinc-500"
              }`}
            >
              Dev
            </button>
          </div>

          <button
            onClick={() => setProjectsOpen(true)}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
          >
            Projects
          </button>
          <button
            onClick={fable.newProject}
            className="rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-300 ring-1 ring-cyan-500/40 hover:bg-cyan-500/25"
          >
            New project
          </button>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex min-h-0 flex-1">
        <div className="w-[380px] shrink-0">
          <ChatPanel
            project={project}
            busy={fable.busy}
            devMode={fable.devMode}
            pendingDecision={fable.pendingDecision}
            onSend={fable.sendMessage}
            onConfirmPending={fable.confirmPending}
            onDismissPending={fable.dismissPending}
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-auto">
            <StageCanvas fable={fable} />
          </div>
          {fable.devMode && (
            <DevDrawer
              project={project}
              open={drawerOpen}
              onToggle={() => setDrawerOpen((o) => !o)}
              onRunAnalyze={() => fable.runAnalyze()}
              onRunPreviews={fable.runPreviews}
              onGenerateFinals={fable.approveAndGenerateFinals}
            />
          )}
        </div>
      </div>

      <ProjectsModal
        open={projectsOpen}
        currentId={project.id}
        onClose={() => setProjectsOpen(false)}
        onOpen={(p) => {
          fable.openProject(p);
          setProjectsOpen(false);
        }}
      />
    </div>
  );
}

function StageRail({ current }: { current: FableStage }) {
  const idx = FABLE_STAGES.indexOf(current);
  return (
    <div className="hidden items-center gap-1.5 lg:flex">
      {FABLE_STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-1.5">
          <div
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ${
              i === idx
                ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-500/40"
                : i < idx
                  ? "text-emerald-400/80"
                  : "text-zinc-600"
            }`}
          >
            {i < idx && <span>✓</span>}
            {STAGE_LABELS[s]}
          </div>
          {i < FABLE_STAGES.length - 1 && (
            <span className={i < idx ? "text-emerald-700" : "text-zinc-800"}>—</span>
          )}
        </div>
      ))}
    </div>
  );
}
