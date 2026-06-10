"use client";

// Fable Bench — the conversation column.
// Renders the event thread (decision/step cards only in dev mode), a composer
// with drag-drop + file-picker image attach, stage-aware quick-action chips, and
// a low-confidence confirm banner.

import { useEffect, useRef, useState } from "react";
import { IMAGE_UPLOAD_LIMITS } from "@/lib/icon/models";
import type {
  FableDecision,
  FableEvent,
  FableProject,
  FableStage,
} from "@/lib/fable/types";
import type { FableBusy, PendingDecision } from "@/lib/fable/use-fable";
import { fmtTime, Pill } from "./ui";

const QUICK_ACTIONS: Record<FableStage, string[]> = {
  intake: ["Make me a matching icon pack", "Use my image as-is"],
  source_review: ["Looks good →", "Try again", "Make it more premium"],
  blueprint: ["Generate preview sheets", "Add a settings icon", "Make them more minimal"],
  preview_review: ["Generate final icons", "Try another sheet", "Make them bolder"],
  finals: ["Save & finish", "Regenerate the weak ones"],
  complete: ["Start a new pack"],
};

function intentTone(intent: string): "cyan" | "violet" | "amber" | "emerald" {
  if (intent === "clarify") return "amber";
  if (intent.startsWith("generate")) return "violet";
  if (intent.includes("approve") || intent === "save_project") return "emerald";
  return "cyan";
}

function DecisionCard({ decision }: { decision: FableDecision }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Pill tone={intentTone(decision.intent)}>{decision.intent}</Pill>
        <span className="text-zinc-500">confidence</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-cyan-500/70"
            style={{ width: `${Math.round(decision.confidence * 100)}%` }}
          />
        </div>
        <span className="font-mono text-zinc-400">
          {Math.round(decision.confidence * 100)}%
        </span>
      </div>
      <p className="text-zinc-400">{decision.reason}</p>
      {decision.ops.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {decision.ops.map((op, i) => (
            <li key={i} className="flex items-center gap-1.5 text-zinc-400">
              <span className="font-mono text-violet-300">{op.op}</span>
              {op.iconId && <span className="font-mono text-zinc-500">{op.iconId}</span>}
              {op.name && <span className="text-zinc-400">{op.name}</span>}
              {op.instruction && <span className="text-zinc-500">— {op.instruction}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EventRow({ ev, devMode }: { ev: FableEvent; devMode: boolean }) {
  if (ev.kind === "user_message") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-500/15 px-3 py-2 text-sm text-cyan-50 ring-1 ring-cyan-500/30">
          {ev.imageAttached && (
            <span className="mb-1 inline-flex items-center gap-1 rounded bg-zinc-900/50 px-1.5 py-0.5 text-[10px] text-cyan-200">
              🖼 image attached
            </span>
          )}
          <p className="whitespace-pre-wrap">{ev.text || <span className="opacity-60">(image)</span>}</p>
        </div>
      </div>
    );
  }
  if (ev.kind === "assistant") {
    const isError = ev.text.startsWith("⚠️");
    return (
      <div className="flex justify-start">
        <div
          className={`max-w-[85%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm ring-1 ${
            isError
              ? "bg-red-950/30 text-red-200 ring-red-800/40"
              : "bg-zinc-800/60 text-zinc-200 ring-zinc-700/40"
          }`}
        >
          <p className="whitespace-pre-wrap">{ev.text}</p>
        </div>
      </div>
    );
  }
  if (!devMode) return null;
  if (ev.kind === "decision") {
    return <DecisionCard decision={ev.decision} />;
  }
  // step
  return (
    <div className="flex items-center gap-2 px-1 text-[11px] text-zinc-500">
      <span className={ev.ok ? "text-emerald-400" : "text-red-400"}>
        {ev.ok ? "✓" : "✕"}
      </span>
      <span className="font-mono text-zinc-600">{ev.step}</span>
      <span>{ev.detail}</span>
      <span className="ml-auto text-zinc-700">{fmtTime(ev.at)}</span>
    </div>
  );
}

export default function ChatPanel({
  project,
  busy,
  devMode,
  pendingDecision,
  onSend,
  onConfirmPending,
  onDismissPending,
}: {
  project: FableProject;
  busy: FableBusy;
  devMode: boolean;
  pendingDecision: PendingDecision | null;
  onSend: (text: string, image?: File | null) => void;
  onConfirmPending: () => void;
  onDismissPending: () => void;
}) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const working = busy.step !== null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [project.events.length, busy.detail]);

  useEffect(() => {
    if (!image) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  function pickFile(f: File | undefined | null) {
    if (f) setImage(f);
  }

  function submit() {
    if (working) return;
    if (!text.trim() && !image) return;
    onSend(text.trim(), image);
    setText("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const quick = QUICK_ACTIONS[project.stage] ?? [];

  return (
    <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Thread */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {project.events.length === 0 && (
          <p className="px-1 pt-2 text-sm text-zinc-500">
            Say hello, describe what you want, or drop a screenshot below to begin.
          </p>
        )}
        {project.events.map((ev) => (
          <EventRow key={ev.id} ev={ev} devMode={devMode} />
        ))}
        {working && (
          <div className="flex items-center gap-2 px-1 text-xs text-cyan-300/80">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
            {busy.detail || "Working…"}
          </div>
        )}
      </div>

      {/* Pending confirmation */}
      {pendingDecision && (
        <div className="mx-4 mb-2 rounded-xl border border-amber-700/40 bg-amber-950/30 p-3 text-xs">
          <p className="text-amber-200">
            I think you want{" "}
            <span className="font-semibold">{pendingDecision.decision.intent}</span>.
            Proceed?
          </p>
          <p className="mt-1 text-amber-300/70">{pendingDecision.decision.reason}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={onConfirmPending}
              className="rounded-lg bg-amber-500/20 px-3 py-1 font-medium text-amber-200 ring-1 ring-amber-600/40 hover:bg-amber-500/30"
            >
              Yes, proceed
            </button>
            <button
              onClick={onDismissPending}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800"
            >
              No, I&apos;ll rephrase
            </button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {quick.map((q) => (
            <button
              key={q}
              disabled={working}
              onClick={() => onSend(q, null)}
              className="rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Composer */}
      <div
        className={`border-t border-zinc-800 p-3 ${dragging ? "bg-cyan-950/20" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pickFile(e.dataTransfer.files?.[0]);
        }}
      >
        {imagePreview && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="attachment" className="h-10 w-10 rounded object-cover" />
            <span className="max-w-[140px] truncate text-xs text-zinc-400">{image?.name}</span>
            <button
              onClick={() => setImage(null)}
              className="text-xs text-zinc-500 hover:text-red-300"
              aria-label="Remove attachment"
            >
              ✕
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={working}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-400 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40"
            aria-label="Attach image"
            title="Attach image"
          >
            +
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_UPLOAD_LIMITS.allowedMimeTypes.join(",")}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={working ? busy.detail || "Working…" : "Message Fable…"}
            disabled={working}
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={working || (!text.trim() && !image)}
            className="flex h-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 px-4 text-sm font-medium text-cyan-200 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </div>
        {working && (
          <p className="mt-1.5 px-1 text-[11px] text-cyan-300/70">{busy.detail || "Working…"}</p>
        )}
      </div>
    </div>
  );
}
