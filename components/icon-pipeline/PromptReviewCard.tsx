"use client";

import { useState } from "react";
import type { IconPromptPack } from "@/types/icon-pipeline";

export interface PromptReviewCardProps {
  promptPack: IconPromptPack;
  onEditPrompt: (iconId: string, text: string) => void;
  onApprove: () => void;
  onGenerate: () => void;
  busy?: boolean;
}

export default function PromptReviewCard({
  promptPack,
  onEditPrompt,
  onApprove,
  onGenerate,
  busy = false,
}: PromptReviewCardProps) {
  const [showJson, setShowJson] = useState(false);
  // Track local draft text per iconId; undefined = use promptPack value
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const getDraftText = (iconId: string, original: string) =>
    drafts[iconId] !== undefined ? drafts[iconId] : original;

  const handleChange = (iconId: string, text: string) => {
    setDrafts((d) => ({ ...d, [iconId]: text }));
  };

  const handleBlur = (iconId: string, original: string) => {
    const text = getDraftText(iconId, original);
    if (text !== original) {
      onEditPrompt(iconId, text);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-zinc-100 text-lg font-semibold">
            Prompt Review
          </h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            {promptPack.prompts.length} prompt
            {promptPack.prompts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowJson((v) => !v)}
          className="text-xs text-cyan-400 border border-zinc-700 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          {showJson ? "Hide JSON" : "Show JSON"}
        </button>
      </div>

      {/* Shared style summary */}
      <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl px-4 py-3">
        <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-1">
          Shared Style Summary
        </p>
        <p className="text-zinc-300 text-sm">{promptPack.sharedStyleSummary}</p>
      </div>

      {/* JSON viewer */}
      {showJson && (
        <pre className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-72 font-mono">
          {JSON.stringify(promptPack, null, 2)}
        </pre>
      )}

      {/* Prompt textareas */}
      <div className="flex flex-col gap-4">
        {promptPack.prompts.map((p) => {
          const currentText = getDraftText(p.iconId, p.prompt);
          return (
            <div key={p.iconId} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-zinc-200 text-sm font-medium">
                  {p.iconName}
                </label>
                {p.notes && (
                  <span className="text-zinc-500 text-xs italic">
                    {p.notes}
                  </span>
                )}
              </div>
              <textarea
                value={currentText}
                onChange={(e) => handleChange(p.iconId, e.target.value)}
                onBlur={() => handleBlur(p.iconId, p.prompt)}
                disabled={busy}
                rows={4}
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-200 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed w-full"
              />
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onApprove}
          disabled={busy || promptPack.prompts.length === 0}
          className="border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:pointer-events-none text-zinc-300 font-semibold py-2.5 px-5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          Approve prompts
        </button>
        <button
          onClick={onGenerate}
          disabled={busy || promptPack.prompts.length === 0}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold py-2.5 px-5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 flex items-center gap-2"
        >
          {busy ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
              Working…
            </>
          ) : (
            "Generate Icons"
          )}
        </button>
      </div>
    </div>
  );
}
