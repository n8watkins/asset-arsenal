"use client";

// Fable Bench — the conversation feed (single centered column).
//
// THE MERGE: the project keeps two parallel histories — `events` (chat / steps /
// decisions, each stamped `at`) and `artifacts` (improved sources, sheets,
// finals, each stamped `createdAt`). To render one ChatGPT-style stream we fold
// both into a single timestamp-ordered list of feed items:
//
//   - Every event → one item (user/assistant bubbles always; decision/step
//     items only in dev mode).
//   - Artifact CARDS are inserted as items too, but they render from CURRENT
//     project state — only their POSITION is pinned by a stable timestamp:
//       · source / blueprint / finals  → single cards, anchored at the moment
//         that artifact first appeared (so they don't jump as they update live).
//       · each preview sheet           → its own card at the sheet's createdAt
//         (superseded sheets render dimmed in place).
//       · completion                   → at the time the project was saved.
//
// Because cards read live state, streaming finals / new versions update in place
// without us re-threading the feed. Items sort by (timestamp, tiebreak) so a card
// reliably lands right after the assistant turn that produced it.

import { useEffect, useMemo, useRef, useState } from "react";
import type { FableProject, FableStyle, IconCandidate } from "@/lib/fable/types";
import type { FableBusy, PendingDecision, UseFable } from "@/lib/fable/use-fable";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import { Lightbox } from "./ui";
import SourceCard from "./cards/SourceCard";
import BlueprintCard from "./cards/BlueprintCard";
import SheetCard from "./cards/SheetCard";
import FinalsCard from "./cards/FinalsCard";
import CompletionCard from "./cards/CompletionCard";
import DecisionCard from "./cards/DecisionCard";

type FeedItem = {
  key: string;
  at: string;
  // tiebreak so a card sorts AFTER the event at the same instant (e.g. the
  // assistant turn and the artifact it produced share a millisecond).
  order: number;
  node: React.ReactNode;
};

export default function ChatFeed({
  fable,
  busy,
  pendingDecision,
}: {
  fable: UseFable;
  busy: FableBusy;
  pendingDecision: PendingDecision | null;
}) {
  const { project, devMode } = fable;
  const scrollRef = useRef<HTMLDivElement>(null);

  // The hook's callbacks are stable across renders; reading them through a ref
  // keeps them out of the items memo's dependency list (the `fable` object
  // itself is a fresh literal every render and would defeat the memo).
  const fableRef = useRef(fable);
  fableRef.current = fable;

  // Auto-scroll to the bottom as new content streams in.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [project.events.length, project.finals, project.sheets.length, busy.detail]);

  const items = useMemo<FeedItem[]>(() => {
    const out: FeedItem[] = [];

    // 1) Events → bubbles / dev cards.
    for (const ev of project.events) {
      if (ev.kind === "user_message") {
        out.push({
          key: ev.id,
          at: ev.at,
          order: 0,
          node: (
            <UserBubble
              text={ev.text}
              imageAttached={ev.imageAttached}
              imageUrl={ev.imageUrl}
            />
          ),
        });
      } else if (ev.kind === "assistant") {
        out.push({
          key: ev.id,
          at: ev.at,
          order: 0,
          node: <AssistantBubble text={ev.text} />,
        });
      } else if (ev.kind === "decision" && devMode) {
        out.push({
          key: ev.id,
          at: ev.at,
          order: 1,
          node: <DecisionCard decision={ev.decision} />,
        });
      } else if (ev.kind === "step" && devMode) {
        out.push({ key: ev.id, at: ev.at, order: 1, node: <StepRow ev={ev} /> });
      } else if (ev.kind === "step" && !devMode && ev.ok && ev.prompt) {
        // W3: LIVE mode — a subtle expandable "model — view prompt" row for
        // completed generation steps. Older events without prompt/model keep
        // rendering as before (i.e. not at all outside dev mode).
        out.push({ key: ev.id, at: ev.at, order: 1, node: <GenStepRow ev={ev} /> });
      }
    }

    // 2) Artifact cards (single instances pinned to first-appearance time).
    if (project.improved.length > 0) {
      out.push({
        key: "card:source",
        at: project.improved[0].createdAt,
        order: 5,
        node: (
          <SourceCard
            project={project}
            busy={!!busy.step}
            onApprove={() => fableRef.current.approveSource()}
            onRegenerate={(instruction) => fableRef.current.regenerateSource(instruction)}
          />
        ),
      });
    }

    if (project.style) {
      // Anchor the blueprint at the analyze step (fallback: a sheet/final time,
      // else the latest source so it lands after source approval).
      const analyzeStep = project.events.find(
        (e) => e.kind === "step" && e.step === "analyze",
      );
      const anchor =
        analyzeStep?.at ??
        project.improved[project.improved.length - 1]?.createdAt ??
        project.original?.createdAt ??
        project.updatedAt;
      out.push({
        key: "card:blueprint",
        at: anchor,
        order: 5,
        node: (
          <BlueprintCard
            project={project}
            busy={!!busy.step}
            onGeneratePreviews={() => fableRef.current.runPreviews()}
            onRemoveCandidate={(id: string) => fableRef.current.removeCandidate(id)}
            onUpdateCandidate={(id: string, patch: Partial<IconCandidate>) =>
              fableRef.current.updateCandidate(id, patch)
            }
            // B10: explicit ✎ Edit → Save applies a local style patch.
            onUpdateStyle={(patch: Partial<FableStyle>) => fableRef.current.updateStyle(patch)}
            // B15: manual "Find on source" (one Gemini call + client crops).
            onLocateCrops={() => void fableRef.current.locateSourceCrops()}
          />
        ),
      });
    }

    for (const sheet of project.sheets) {
      out.push({
        key: `card:sheet:${sheet.id}`,
        at: sheet.createdAt,
        order: 5,
        node: (
          <SheetCard
            sheet={sheet}
            project={project}
            busy={!!busy.step}
            dimmed={sheet.status === "superseded"}
            onGenerateFinals={() => fableRef.current.approveSheetAndGenerateFinals(sheet.id)}
            onRegenerateSheet={(id, instruction) =>
              fableRef.current.regenerateSheet(id, instruction)
            }
            // Mechanical actions — structured executors, no agent round-trip.
            onTryAnotherSheet={(instruction) =>
              fableRef.current.tryAnotherSheet(sheet.id, instruction)
            }
            onIconOp={(ops, description) => fableRef.current.reviseIconsDirect(ops, description)}
            // B14: display-only backdrop, persisted on the project.
            onSetViewBackground={(bg) => fableRef.current.setViewBackground(bg)}
          />
        ),
      });
    }

    if (project.finals.length > 0) {
      const firstFinalAt = project.finals.reduce(
        (min, f) => (f.createdAt < min ? f.createdAt : min),
        project.finals[0].createdAt,
      );
      out.push({
        key: "card:finals",
        at: firstFinalAt,
        order: 5,
        node: (
          <FinalsCard
            project={project}
            busy={!!busy.step}
            onRetry={(iconId) => fableRef.current.retryFinal(iconId)}
            // Mechanical regen — direct retryFinal path with a feed note.
            onRegenerate={(iconId) => fableRef.current.regenerateFinal(iconId)}
            // B12: refine popover → structured regenerate_icon op, no agent.
            onIconOp={(ops, description) => fableRef.current.reviseIconsDirect(ops, description)}
            onSaveFinish={() => fableRef.current.sendMessage("Save and finish the project.", null)}
            // B14: display-only backdrop, persisted on the project.
            onSetViewBackground={(bg) => fableRef.current.setViewBackground(bg)}
          />
        ),
      });
    }

    if (project.stage === "complete") {
      out.push({
        key: "card:complete",
        at: project.updatedAt,
        order: 9,
        node: <CompletionCard project={project} />,
      });
    }

    out.sort((a, b) => {
      const t = a.at.localeCompare(b.at);
      return t !== 0 ? t : a.order - b.order;
    });
    return out;
    // fableRef carries the (stable) callbacks — only real inputs are deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, devMode, busy.step]);

  const working = !!busy.step;

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
        {items.map((it) => (
          <div key={it.key}>{it.node}</div>
        ))}

        {/* Pending low-confidence decision → assistant bubble with confirm. */}
        {pendingDecision && (
          <div className="fable-card-in flex justify-start">
            <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-amber-700/40 bg-amber-950/30 px-4 py-3 text-sm">
              <p className="text-amber-100">
                I think you want{" "}
                <span className="font-semibold">{pendingDecision.decision.intent}</span> —{" "}
                <span className="text-amber-200/80">{pendingDecision.decision.reason}</span>
              </p>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={fable.confirmPending}
                  className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs font-medium text-amber-100 ring-1 ring-amber-600/40 hover:bg-amber-500/30"
                >
                  Confirm
                </button>
                <button
                  onClick={fable.dismissPending}
                  className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Working bubble with animated dots. */}
        {working && <WorkingBubble detail={busy.detail} />}
      </div>
    </div>
  );
}

function UserBubble({
  text,
  imageAttached,
  imageUrl,
}: {
  text: string;
  imageAttached: boolean;
  imageUrl?: string;
}) {
  const [enlarged, setEnlarged] = useState(false);
  const displaySrc = useObjectUrl(imageUrl);
  return (
    <div className="fable-card-in flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-cyan-500/15 px-4 py-2.5 text-sm text-cyan-50 ring-1 ring-cyan-500/25">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displaySrc}
            alt="attached"
            className="mb-2 max-h-56 cursor-zoom-in rounded-xl ring-1 ring-cyan-500/20"
            onClick={() => setEnlarged(true)}
          />
        ) : (
          imageAttached && (
            <span className="mb-1 inline-flex items-center gap-1 rounded bg-zinc-950/50 px-1.5 py-0.5 text-[10px] text-cyan-200">
              🖼 image attached
            </span>
          )
        )}
        {text ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          !imageUrl && <p className="opacity-60">(image)</p>
        )}
      </div>
      {enlarged && imageUrl && (
        <Lightbox
          src={imageUrl}
          caption="Attached image"
          downloadName="attachment"
          onClose={() => setEnlarged(false)}
        />
      )}
    </div>
  );
}

function AssistantBubble({ text }: { text: string }) {
  const isError = text.startsWith("⚠️");
  return (
    <div className="fable-card-in flex justify-start">
      <div
        className={`max-w-[88%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm ring-1 ${
          isError
            ? "bg-red-950/30 text-red-200 ring-red-800/40"
            : "bg-zinc-800/60 text-zinc-200 ring-zinc-700/40"
        }`}
      >
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
}

function WorkingBubble({ detail }: { detail: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-800/60 px-4 py-3 text-sm text-zinc-300 ring-1 ring-zinc-700/40">
        <span className="flex gap-1">
          <span className="fable-dot h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span className="fable-dot h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span className="fable-dot h-1.5 w-1.5 rounded-full bg-cyan-400" />
        </span>
        <span className="text-zinc-400">{detail || "Working…"}</span>
      </div>
    </div>
  );
}

function StepRow({
  ev,
}: {
  ev: Extract<FableProject["events"][number], { kind: "step" }>;
}) {
  return (
    <div className="flex items-center gap-2 px-1 text-[11px] text-zinc-500">
      <span className={ev.ok ? "text-emerald-400" : "text-red-400"}>{ev.ok ? "✓" : "✕"}</span>
      <span className="font-mono text-zinc-600">{ev.step}</span>
      <span>{ev.detail}</span>
    </div>
  );
}

/** W3 (LIVE mode): subtle expandable row for a completed generation step —
 *  "gpt-image-1-mini · medium — view prompt" → the full prompt in a <pre>. */
function GenStepRow({
  ev,
}: {
  ev: Extract<FableProject["events"][number], { kind: "step" }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-1 text-[11px] text-zinc-600">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 transition-colors hover:text-zinc-400"
        aria-expanded={open}
      >
        <span className="font-mono">{ev.model ?? ev.step}</span>
        <span>— {open ? "hide" : "view"} prompt</span>
        <span className="text-[9px]">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <pre className="mt-1 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/70 p-2.5 font-mono text-[10px] leading-relaxed text-zinc-400">
          {ev.prompt}
        </pre>
      )}
    </div>
  );
}
