"use client";

import { useEffect, useRef, useState } from "react";

const SKINS = [
  { id: "plain", label: "Plain" },
  { id: "brand", label: "Your brand" },
  { id: "fantasy", label: "High fantasy" },
  { id: "scifi", label: "Sci-fi" },
  { id: "paper", label: "Paper craft" },
] as const;

type SkinId = (typeof SKINS)[number]["id"];

/**
 * One mock page (a suggestion box) in five skins. Pure CSS: the point is to show
 * what changes between skins, not to fake generated art. Cycles on its own until
 * someone picks a skin, and never moves for people who prefer reduced motion.
 */
export function SkinDemo() {
  const [skin, setSkin] = useState<SkinId>("plain");
  const [auto, setAuto] = useState(true);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      setSkin((current) => SKINS[(SKINS.findIndex((s) => s.id === current) + 1) % SKINS.length].id);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [auto]);

  const pick = (id: SkinId) => {
    setAuto(false);
    setSkin(id);
  };

  const onKey = (event: React.KeyboardEvent, index: number) => {
    const last = SKINS.length - 1;
    const next =
      event.key === "ArrowRight" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    pick(SKINS[next].id);
    tabs.current[next]?.focus();
  };

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-2xl shadow-black/40 sm:p-4">
      <div role="tablist" aria-label="Skins" className="flex gap-1 overflow-x-auto pb-3">
        {SKINS.map((s, i) => (
          <button
            key={s.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            id={`skin-tab-${s.id}`}
            aria-selected={skin === s.id}
            aria-controls="skin-panel"
            tabIndex={skin === s.id ? 0 : -1}
            onClick={() => pick(s.id)}
            onKeyDown={(e) => onKey(e, i)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              skin === s.id ? "bg-accent text-accent-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        id="skin-panel"
        role="tabpanel"
        aria-labelledby={`skin-tab-${skin}`}
        data-skin={skin}
        className="skin overflow-hidden rounded-xl p-4 sm:p-6"
      >
        <div className="skin-head flex items-center justify-between text-sm">
          <span className="skin-title skin-ornament font-bold">Lanternworks</span>
          <span className="skin-muted hidden sm:inline">Roadmap · Changelog · Sign in</span>
        </div>

        <div className="skin-card mt-5 p-4 sm:p-5">
          <p className="skin-title text-lg font-bold sm:text-xl">Suggestion box</p>
          <p className="skin-muted mt-1 text-sm">Tell us what to build next. We read every one.</p>
          <div className="skin-input mt-4 h-16 sm:h-20" aria-hidden="true" />
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="skin-muted text-xs">128 ideas this month</span>
            <span className="skin-btn px-4 py-2 text-sm font-semibold">Send idea</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {["Dark mode", "Export to CSV", "Team spaces"].map((idea, i) => (
            <div key={idea} className="skin-card p-3">
              <p className="text-xs font-semibold leading-snug sm:text-sm">{idea}</p>
              <p className="skin-muted mt-1 text-xs">{[42, 31, 18][i]} votes</p>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 px-1 text-xs text-muted">
        A sketch of the idea in plain CSS. The real thing generates the art: textures, frames, ornaments and icons.
      </p>
    </div>
  );
}
