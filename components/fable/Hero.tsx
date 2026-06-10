"use client";

// Fable Bench — the empty-state hero (ChatGPT-style).
// Centered product mark + headline, the large composer, and example-prompt chips
// that send immediately. The composer ref is owned by the page so a drop anywhere
// on the page lands its image here.

import { forwardRef } from "react";
import Composer, { type ComposerHandle } from "./Composer";

const EXAMPLES = [
  "Make this dashboard look premium",
  "Make a matching icon pack from this style",
  "Use my screenshot as-is and pull the icon set",
  "Upgrade this into a dark-mode SaaS look",
];

type HeroProps = {
  busy: boolean;
  dragging: boolean;
  onSend: (text: string, image?: File | null) => void;
};

function Hero({ busy, dragging, onSend }: HeroProps, ref: React.Ref<ComposerHandle>) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-2xl text-cyan-300 ring-1 ring-cyan-500/30">
            ◆
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            Drop a screenshot. Get a matching icon pack.
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Fable studies your UI, proposes an icon set, and renders them to match — all in one
            conversation.
          </p>
        </div>

        <Composer ref={ref} variant="hero" busy={busy} dragging={dragging} onSend={onSend} />

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              disabled={busy}
              onClick={() => onSend(ex, null)}
              className="rounded-full border border-zinc-800 bg-zinc-900/50 px-3.5 py-1.5 text-xs text-zinc-400 transition-colors hover:border-cyan-500/40 hover:text-cyan-200 disabled:opacity-40"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default forwardRef(Hero);
