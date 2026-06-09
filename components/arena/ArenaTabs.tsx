"use client";

import { useState } from "react";
import PromptArena from "./PromptArena";
import ImageArena from "./ImageArena";

// Tab switch between the two judging modes, shared by the drawer and /arena.
// Both modes write to the same experiment ledger via onSaved.

type Mode = "prompts" | "images";

export default function ArenaTabs({ onSaved }: { onSaved?: () => void }) {
  const [mode, setMode] = useState<Mode>("prompts");

  const tabs: { id: Mode; label: string }[] = [
    { id: "prompts", label: "Prompt comparison" },
    { id: "images", label: "Image comparison" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-1 self-start rounded-xl border border-zinc-800 bg-zinc-900/60 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            aria-current={mode === t.id ? "true" : undefined}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
              mode === t.id
                ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "prompts" ? (
        <PromptArena onSaved={onSaved} />
      ) : (
        <ImageArena onSaved={onSaved} />
      )}
    </div>
  );
}
