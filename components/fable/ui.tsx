"use client";

// Fable Bench — small shared UI primitives (dark zinc / cyan language).

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { downloadDataUrl, slugify } from "@/lib/icon/download";
import { resolveToDataUrl } from "@/lib/fable/images";
import { useObjectUrl } from "@/lib/fable/use-object-url";
import type { FableStage } from "@/lib/fable/types";

export function fmtUsd(n: number): string {
  if (n === 0) return "$0.000";
  return n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
}

export function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function fmtRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

export const STAGE_LABELS: Record<FableStage, string> = {
  intake: "Intake",
  source_review: "Source",
  blueprint: "Blueprint",
  preview_review: "Previews",
  finals: "Finals",
  complete: "Done",
};

/** Quick-action chips shown above the composer, contextual to the stage. */
export const STAGE_QUICK_ACTIONS: Record<FableStage, string[]> = {
  intake: ["Make me a matching icon pack", "Use my image as-is"],
  source_review: ["Looks good →", "Try again", "Make it more premium"],
  blueprint: ["Generate preview sheets", "Add a settings icon", "Make them more minimal"],
  preview_review: ["Generate final icons", "Try another sheet", "Make them bolder"],
  finals: ["Save & finish", "Regenerate the weak ones"],
  complete: ["Start a new pack"],
};

export function Pill({
  children,
  tone = "zinc",
}: {
  children: React.ReactNode;
  tone?: "zinc" | "cyan" | "violet" | "amber" | "emerald" | "red";
}) {
  const tones: Record<string, string> = {
    zinc: "bg-zinc-800 text-zinc-300 ring-zinc-700/50",
    cyan: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/40",
    violet: "bg-violet-500/15 text-violet-200 ring-violet-500/40",
    amber: "bg-amber-900/30 text-amber-300 ring-amber-700/40",
    emerald: "bg-emerald-900/30 text-emerald-300 ring-emerald-700/40",
    red: "bg-red-950/40 text-red-300 ring-red-800/40",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl bg-cyan-500/15 px-4 py-2.5 text-sm font-medium text-cyan-300 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

/** Small inline action button used inside artifact cards. */
export function CardAction({
  children,
  tone = "zinc",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "cyan" | "violet" | "emerald" | "zinc" | "red";
}) {
  const tones: Record<string, string> = {
    cyan: "bg-cyan-500/15 text-cyan-200 ring-cyan-500/40 hover:bg-cyan-500/25",
    violet: "bg-violet-500/15 text-violet-200 ring-violet-500/40 hover:bg-violet-500/25",
    emerald: "bg-emerald-500/15 text-emerald-200 ring-emerald-600/40 hover:bg-emerald-500/25",
    zinc: "bg-zinc-800/80 text-zinc-200 ring-zinc-700/50 hover:bg-zinc-700/70",
    red: "bg-red-500/15 text-red-200 ring-red-700/40 hover:bg-red-500/25",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * The chrome every artifact card shares: rounded-2xl, soft border + shadow, a
 * gentle mount animation, and a dimmed/collapsed treatment for superseded ones.
 */
export function ArtifactCard({
  title,
  badge,
  dimmed = false,
  children,
}: {
  title: React.ReactNode;
  badge?: React.ReactNode;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`fable-card-in rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 shadow-lg shadow-black/20 ${
        dimmed ? "opacity-60" : ""
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-zinc-200">{title}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

/** Full-screen lightbox: Escape closes, body scroll locks while open, and the
 *  image gets Download / Open-in-new-tab actions (object URL — browsers refuse
 *  to open multi-MB data URLs directly) plus an optional caption line.
 *
 *  Rendered through a portal onto document.body: artifact cards animate in
 *  with `.fable-card-in` (fill-mode: both leaves a transform applied), and a
 *  transformed ancestor becomes the containing block for position:fixed —
 *  which would trap the lightbox inside the chat column. The portal escapes
 *  every such ancestor, for all call sites. */
export function Lightbox({
  src,
  caption,
  downloadName,
  onClose,
}: {
  src: string;
  caption?: string;
  downloadName?: string;
  onClose: () => void;
}) {
  // Image refs / data URLs are resolved to object URLs for display +
  // open-in-new-tab (undefined while a ref is still loading).
  const displaySrc = useObjectUrl(src);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/80 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt={caption ?? "enlarged"}
        className="min-h-0 max-h-full max-w-full rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="flex shrink-0 flex-wrap items-center justify-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {caption && <span className="mr-1 text-sm text-zinc-300">{caption}</span>}
        <button
          // `src` may be a stored-image ref — resolve to bytes before download.
          onClick={() => {
            void resolveToDataUrl(src)
              .then((d) => downloadDataUrl(d, `${slugify(downloadName ?? caption ?? "image")}.png`))
              .catch(() => {
                /* missing stored image — nothing to download */
              });
          }}
          className="rounded-lg bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-200 ring-1 ring-cyan-500/40 hover:bg-cyan-500/25"
        >
          ⤓ Download
        </button>
        {displaySrc && (
          <a
            href={displaySrc}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800"
          >
            ↗ Open in new tab
          </a>
        )}
      </div>
      <button
        onClick={onClose}
        className="absolute right-5 top-5 rounded-full bg-zinc-900/80 px-3 py-1 text-sm text-zinc-300 ring-1 ring-zinc-700 hover:text-zinc-100"
        aria-label="Close"
      >
        ✕
      </button>
    </div>,
    document.body,
  );
}
