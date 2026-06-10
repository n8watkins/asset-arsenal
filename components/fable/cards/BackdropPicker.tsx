"use client";

// Fable Bench — B14 display-only backdrop picker for transparent images.
//
// Shared by SheetCard + FinalsCard: a row of small swatches (checkerboard
// default + a few presets) plus a free hex input. Changes ONLY the CSS behind
// transparent images — never triggers regeneration. The chosen value persists
// on the project (FableProject.viewBackground; "" = checkerboard).

import { useState } from "react";

/** Checkerboard backdrop (the "no background" default for transparent PNGs). */
export const CHECKER =
  "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 16px 16px";

const PRESETS = ["#ffffff", "#000000", "#18181b", "#1e3a5f", "#f4f4f5"];

/** CSS background value for the current pick ("" → checkerboard). */
export function backdropCss(viewBackground?: string): string {
  return viewBackground?.trim() ? viewBackground : CHECKER;
}

export default function BackdropPicker({
  value,
  onChange,
}: {
  /** Current backdrop ("" / undefined = checkerboard). */
  value?: string;
  onChange: (v: string) => void;
}) {
  const [hex, setHex] = useState("");
  const current = value ?? "";

  const applyHex = () => {
    const v = hex.trim();
    if (!v) return;
    const normalized = v.startsWith("#") ? v : `#${v}`;
    if (/^#[0-9a-fA-F]{3,8}$/.test(normalized)) {
      onChange(normalized);
      setHex("");
    }
  };

  const swatch = (bg: string, key: string, title: string, selected: boolean) => (
    <button
      key={key}
      onClick={() => onChange(bg)}
      title={title}
      aria-label={title}
      className={`h-5 w-5 rounded ring-1 ${
        selected ? "ring-2 ring-cyan-400" : "ring-zinc-700"
      }`}
      style={{ background: bg === "" ? CHECKER : bg }}
    />
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-zinc-600">backdrop</span>
      {swatch("", "checker", "Checkerboard (transparent)", current === "")}
      {PRESETS.map((p) => swatch(p, p, p, current.toLowerCase() === p))}
      <input
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") applyHex();
        }}
        onBlur={applyHex}
        placeholder="#hex"
        className="w-16 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10px] text-zinc-300 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
      />
    </div>
  );
}
