"use client";

// Fable Bench — a CHAT-FIRST image→icon-pack studio.
//
// The entire page IS the chat (ChatGPT/Claude.ai shape), not a workbench with a
// chat strapped to the side:
//   - empty project  → centered hero with a large composer + example chips
//   - once anything is sent → a single centered conversation column scrolling
//     under a slim header, with a docked composer pinned at the bottom.
//
// Artifact cards (source / blueprint / sheets / finals / completion) render
// INLINE in the feed, merged chronologically with the chat events (see
// ChatFeed.tsx for the merge). A collapsible left sidebar holds project history.
//
// In-memory + IndexedDB state only (no URL state → no Suspense needed).

import { useCallback, useRef, useState } from "react";
import Nav from "@/components/Nav";
import { totalCostUSD } from "@/lib/fable/pricing";
import { useFable } from "@/lib/fable/use-fable";
import ChatFeed from "@/components/fable/ChatFeed";
import type { ComposerHandle } from "@/components/fable/Composer";
import Composer from "@/components/fable/Composer";
import DevDrawer from "@/components/fable/DevDrawer";
import Hero from "@/components/fable/Hero";
import Sidebar from "@/components/fable/Sidebar";
import { fmtUsd, STAGE_LABELS, STAGE_QUICK_ACTIONS } from "@/components/fable/ui";

export default function FablePage() {
  const fable = useFable();
  const { project, busy } = fable;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [dragging, setDragging] = useState(false);

  // The active composer (hero OR docked) — a page-level drop routes its file here.
  const composerRef = useRef<ComposerHandle>(null);
  const dragDepth = useRef(0);

  const openaiCost = totalCostUSD(project.usage, "openai");
  const geminiCalls = project.usage.filter((u) => u.provider === "gemini").length;
  const working = !!busy.step;

  // Conversation begins as soon as the user sends anything (or attaches an image).
  const inConversation = project.events.length > 0 || !!project.original;

  const onPageDragEnter = useCallback((e: React.DragEvent) => {
    if (!Array.from(e.dataTransfer.types).includes("Files")) return;
    dragDepth.current += 1;
    setDragging(true);
  }, []);
  const onPageDragLeave = useCallback(() => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }, []);
  const onPageDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) composerRef.current?.attach(file);
  }, []);

  const quick = STAGE_QUICK_ACTIONS[project.stage] ?? [];

  return (
    <div
      className="flex h-screen flex-col bg-zinc-950 text-zinc-100"
      onDragEnter={onPageDragEnter}
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes("Files")) e.preventDefault();
      }}
      onDragLeave={onPageDragLeave}
      onDrop={onPageDrop}
    >
      <style>{FABLE_ANIM_CSS}</style>
      <Nav />

      <div className="flex min-h-0 flex-1">
        <Sidebar
          open={sidebarOpen}
          currentId={project.id}
          refreshKey={project.events.length}
          onClose={() => setSidebarOpen(false)}
          onNew={() => {
            fable.newProject();
            setSidebarOpen(false);
          }}
          onOpen={(p) => {
            fable.openProject(p);
            setSidebarOpen(false);
          }}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Slim header */}
          <header className="flex items-center gap-3 border-b border-zinc-800 px-3 py-2">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                ☰
              </button>
            )}

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
                className="truncate text-sm font-medium text-zinc-200 hover:text-zinc-100"
                title="Click to rename"
              >
                {project.name}
              </button>
            )}

            <div className="ml-auto flex items-center gap-2.5">
              <span className="hidden rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] text-zinc-400 ring-1 ring-zinc-800 sm:inline">
                {STAGE_LABELS[project.stage]}
              </span>
              <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-2.5 py-1 text-[11px]">
                <span className="text-emerald-300">{fmtUsd(openaiCost)}</span>
                <span className="text-zinc-600">·</span>
                <span className="text-violet-300">{geminiCalls} gemini</span>
              </div>
              <div className="flex items-center rounded-full border border-zinc-800 bg-zinc-900/50 p-0.5 text-[11px]">
                <button
                  onClick={() => fable.setDevMode(false)}
                  className={`rounded-full px-2.5 py-1 ${
                    !fable.devMode ? "bg-cyan-500/20 text-cyan-200" : "text-zinc-500"
                  }`}
                >
                  Live
                </button>
                <button
                  onClick={() => fable.setDevMode(true)}
                  className={`rounded-full px-2.5 py-1 ${
                    fable.devMode ? "bg-violet-500/20 text-violet-200" : "text-zinc-500"
                  }`}
                >
                  Dev
                </button>
              </div>
            </div>
          </header>

          {/* Surface: hero OR conversation */}
          {!inConversation ? (
            <Hero
              ref={composerRef}
              busy={working}
              dragging={dragging}
              onSend={fable.sendMessage}
            />
          ) : (
            <>
              <ChatFeed fable={fable} busy={busy} pendingDecision={fable.pendingDecision} />

              {/* Docked composer + contextual quick-actions */}
              <div className="border-t border-zinc-800 bg-zinc-950/80 backdrop-blur">
                <div className="mx-auto w-full max-w-3xl px-4 py-3">
                  {quick.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {quick.map((q) => (
                        <button
                          key={q}
                          disabled={working}
                          onClick={() => fable.sendMessage(q, null)}
                          className="rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                  <Composer
                    ref={composerRef}
                    variant="docked"
                    busy={working}
                    busyDetail={busy.detail}
                    dragging={dragging}
                    onSend={fable.sendMessage}
                  />
                  <p className="mt-1.5 px-1 text-[10px] text-zinc-600">
                    Enter to send · Shift+Enter for a new line
                  </p>
                </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Mount animations + typing dots. Kept inline (globals.css is out of scope).
const FABLE_ANIM_CSS = `
@keyframes fableCardIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fable-card-in { animation: fableCardIn 0.25s ease-out both; }
@keyframes fableDot {
  0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
  40%           { opacity: 1; transform: translateY(-2px); }
}
.fable-dot { animation: fableDot 1.2s infinite ease-in-out; }
.fable-dot:nth-child(2) { animation-delay: 0.15s; }
.fable-dot:nth-child(3) { animation-delay: 0.3s; }
`;
