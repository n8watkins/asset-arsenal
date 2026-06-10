"use client";

// Fable Bench — agent-decision card (DEV MODE only).
// Renders inline in the stream between the user message and what follows:
// intent badge, confidence bar, reason, and the ops list.

import type { FableDecision } from "@/lib/fable/types";
import { Pill } from "../ui";

function intentTone(intent: string): "cyan" | "violet" | "amber" | "emerald" {
  if (intent === "clarify") return "amber";
  if (intent.startsWith("generate")) return "violet";
  if (intent.includes("approve") || intent === "save_project") return "emerald";
  return "cyan";
}

export default function DecisionCard({ decision }: { decision: FableDecision }) {
  return (
    <div className="fable-card-in rounded-xl border border-violet-900/40 bg-violet-950/10 p-3 text-xs">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Pill tone={intentTone(decision.intent)}>{decision.intent}</Pill>
        <span className="text-zinc-500">confidence</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-cyan-500/70"
            style={{ width: `${Math.round(decision.confidence * 100)}%` }}
          />
        </div>
        <span className="font-mono text-zinc-400">{Math.round(decision.confidence * 100)}%</span>
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
