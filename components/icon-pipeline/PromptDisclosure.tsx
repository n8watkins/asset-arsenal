"use client";

import { useState } from "react";

export interface PromptDisclosureProps {
  label: string;
  prompt: string;
  defaultOpen?: boolean;
}

export default function PromptDisclosure({
  label,
  prompt,
  defaultOpen = false,
}: PromptDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900 hover:bg-zinc-800/60 text-left transition-colors"
      >
        <span className="text-xs font-medium text-cyan-400">{label}</span>
        <span className="text-zinc-500 text-xs ml-2 shrink-0">
          {open ? "▲ hide" : "▼ show"}
        </span>
      </button>

      {open && (
        <div className="relative bg-zinc-950 border-t border-zinc-800">
          <button
            type="button"
            onClick={handleCopy}
            className="absolute top-2 right-2 text-xs text-zinc-400 hover:text-cyan-400 border border-zinc-700 hover:border-cyan-500/50 px-2 py-1 rounded-md transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-auto max-h-64 p-4 pr-16">
            {prompt}
          </pre>
        </div>
      )}
    </div>
  );
}
