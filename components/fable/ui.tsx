"use client";

// Fable Bench — small shared UI primitives (dark zinc / cyan language).

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
