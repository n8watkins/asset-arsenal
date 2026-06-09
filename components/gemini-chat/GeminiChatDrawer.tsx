"use client";

import { useState } from "react";
import Link from "next/link";
import GeminiChat from "./GeminiChat";

// Global pop-out Gemini analysis chat, mounted in the root layout so it's
// available on every page. Launcher sits bottom-left (clear of the bench
// DebugDrawer, bottom-right). Standalone — not wired to the experiment Runner.

export default function GeminiChatDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2 rounded-xl border border-cyan-700/50 bg-cyan-950/60 px-3 py-2 text-xs font-medium text-cyan-300 shadow-lg backdrop-blur-sm transition-colors hover:bg-cyan-900/60 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        aria-label="Toggle Gemini analysis chat"
      >
        <span aria-hidden>✦</span>
        {open ? "Close Gemini" : "Gemini"}
      </button>

      {open && (
        <div className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col overflow-hidden border-l border-zinc-800 bg-zinc-950 shadow-2xl">
          <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Gemini Analysis</h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Paste prompts or images and ask — compare, critique, distill.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/gemini"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xs text-cyan-400/80 transition-colors hover:text-cyan-300 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                Full view ↗
              </Link>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-zinc-400 transition-colors hover:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 px-5 py-4">
            <GeminiChat />
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-30 bg-black/40" onClick={() => setOpen(false)} />
      )}
    </>
  );
}
