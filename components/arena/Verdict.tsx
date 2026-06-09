"use client";

import type { ReactNode } from "react";
import type { ArenaJudgment } from "@/lib/gemini/arena-store";

// Shared verdict view for both prompt- and image-comparison. Renders the parts
// every verdict has (winner, confidence, per-criterion scores, rationale); the
// kind-specific tail (distilled prompt / suggestions) is passed as `footer`.

export function WinnerBadge({ winner }: { winner: ArenaJudgment["winner"] }) {
  const map = {
    A: { text: "A wins", cls: "bg-cyan-500/15 text-cyan-300 ring-cyan-500/40" },
    B: { text: "B wins", cls: "bg-violet-500/15 text-violet-300 ring-violet-500/40" },
    tie: { text: "Tie", cls: "bg-zinc-700/40 text-zinc-300 ring-zinc-600/50" },
  } as const;
  const { text, cls } = map[winner];
  return (
    <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ring-1 ${cls}`}>
      {text}
    </span>
  );
}

export function ScoreBar({ score, tone }: { score: number; tone: "a" | "b" }) {
  const pct = Math.round((score / 10) * 100);
  const color = tone === "a" ? "bg-cyan-500" : "bg-violet-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right font-mono text-xs text-zinc-400">
        {score.toFixed(1)}
      </span>
    </div>
  );
}

export default function Verdict({
  judgment,
  badge,
  footer,
}: {
  judgment: ArenaJudgment;
  badge?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <WinnerBadge winner={judgment.winner} />
        <span className="text-xs text-zinc-500">
          confidence{" "}
          <span className="font-mono text-zinc-300">
            {Math.round(judgment.confidence * 100)}%
          </span>
        </span>
        {badge && <span className="ml-auto">{badge}</span>}
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-x-4 text-xs uppercase tracking-wide text-zinc-600">
          <span>Criterion</span>
          <span className="text-cyan-400">A</span>
          <span className="text-violet-400">B</span>
        </div>
        {judgment.criteria.map((c) => (
          <div key={c.name} className="flex flex-col gap-1.5">
            <div className="grid grid-cols-[1fr_5rem_5rem] items-center gap-x-4">
              <span className="text-sm text-zinc-200">{c.name}</span>
              <ScoreBar score={c.scoreA} tone="a" />
              <ScoreBar score={c.scoreB} tone="b" />
            </div>
            {c.note && <p className="text-xs text-zinc-500">{c.note}</p>}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Rationale
        </p>
        <p className="text-sm leading-relaxed text-zinc-300">{judgment.rationale}</p>
      </div>

      {footer}
    </div>
  );
}
