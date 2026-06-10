"use client";

// Fable Bench — ⚙ model + settings popover (header, visible in Live AND Dev).
//
// One place for everything configurable (D22 + D25):
//   1. Per-PROJECT model config (analysis / image / quality) via setModelConfig —
//      the pickers that used to live in DevDrawer's Pipeline tab, with the same
//      deprecation + no-transparency warnings.
//   2. GLOBAL settings via useFableSettings(): upload downscale cap + the
//      experimental source-crops toggle.
//   3. A collapsible "What can I do here?" outline of Live vs Dev abilities.

import { useEffect, useRef, useState } from "react";
import { CATALOG } from "@/lib/icon/model-reference";
import { useFableSettings, type FableDownscaleMaxEdge } from "@/lib/fable/settings";
import type { FableModelConfig, ImageQuality } from "@/lib/fable/types";

const selectCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 focus:border-cyan-500/60 focus:outline-none";

const labelCls = "flex flex-col gap-1 text-[10px] uppercase tracking-widest text-zinc-500";

export default function ModelSettings({
  models,
  onModelConfig,
}: {
  models: FableModelConfig;
  onModelConfig: (patch: Partial<FableModelConfig>) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside-click / Escape while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Models & settings"
        title="Models & settings"
        aria-expanded={open}
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm transition-colors ${
          open
            ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
            : "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-200"
        }`}
      >
        ⚙
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 max-h-[75vh] w-80 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-3 shadow-2xl shadow-black/50">
          <ModelsSection models={models} onModelConfig={onModelConfig} />
          <GlobalSection />
          <CapabilitiesOutline />
        </div>
      )}
    </div>
  );
}

/* ---------- 1. Per-project model config ---------- */

function ModelsSection({
  models,
  onModelConfig,
}: {
  models: FableModelConfig;
  onModelConfig: (patch: Partial<FableModelConfig>) => void;
}) {
  const analysisModels = CATALOG.filter((m) => m.kind === "text" && m.provider === "Google");
  const imageModels = CATALOG.filter((m) => m.kind === "image");
  const selectedImage = imageModels.find((m) => m.id === models.image);

  return (
    <section className="flex flex-col gap-2.5">
      <SectionHeading>Models · this project</SectionHeading>
      <label className={labelCls}>
        Analysis model
        <select
          value={models.analysis}
          onChange={(e) => onModelConfig({ analysis: e.target.value })}
          className={selectCls}
        >
          {analysisModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
              {m.freeTier ? " (free tier)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Image model
        <select
          value={models.image}
          onChange={(e) => onModelConfig({ image: e.target.value })}
          className={selectCls}
        >
          {imageModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
              {m.status === "deprecated" && m.deprecation
                ? ` (deprecated — shutdown ${m.deprecation.shutdown})`
                : ""}
              {!m.capabilities.includes("transparentBg") ? " — no transparent bg" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className={labelCls}>
        Quality
        <select
          value={models.quality}
          onChange={(e) => onModelConfig({ quality: e.target.value as ImageQuality })}
          className={selectCls}
        >
          {(["low", "medium", "high"] as const).map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      </label>
      {selectedImage?.status === "deprecated" && selectedImage.deprecation && (
        <p className="text-[10px] text-amber-400">
          ⚠ {selectedImage.id} is deprecated — shutdown {selectedImage.deprecation.shutdown}.
        </p>
      )}
      {selectedImage && !selectedImage.capabilities.includes("transparentBg") && (
        <p className="text-[10px] text-amber-400">
          ⚠ {selectedImage.id} can&apos;t render transparent backgrounds — final icons will
          come back opaque.
        </p>
      )}
    </section>
  );
}

/* ---------- 2. Global settings (all projects) ---------- */

function GlobalSection() {
  const [settings, updateSettings] = useFableSettings();

  return (
    <section className="mt-4 flex flex-col gap-2.5 border-t border-zinc-800 pt-3">
      <SectionHeading>Settings · all projects</SectionHeading>
      <label className={labelCls}>
        Downscale uploads
        <select
          value={settings.downscaleMaxEdge}
          onChange={(e) =>
            updateSettings({
              downscaleMaxEdge: Number(e.target.value) as FableDownscaleMaxEdge,
            })
          }
          className={selectCls}
        >
          <option value={0}>Off</option>
          <option value={1024}>1024 px</option>
          <option value={2048}>2048 px</option>
        </select>
        <span className="normal-case tracking-normal text-zinc-600">
          OpenAI caps inputs at 2048px server-side — this mainly saves storage + upload
          size
        </span>
      </label>

      <div className="flex flex-col gap-1.5">
        <p className="text-[10px] uppercase tracking-widest text-zinc-500">Experiments</p>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={settings.sourceCrops}
            onChange={(e) => updateSettings({ sourceCrops: e.target.checked })}
            className="mt-0.5 h-3.5 w-3.5 accent-cyan-500"
          />
          <span className="flex flex-col gap-0.5 text-xs text-zinc-300">
            Source icon crops
            <span className="text-[10px] text-zinc-600">
              One extra Gemini call after analysis locates each icon on your source image
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}

/* ---------- 3. "What can I do here?" outline ---------- */

const LIVE_ABILITIES = [
  "Chat with Fable — artifact cards render inline in the feed",
  "See the prompt used for every generation",
  "Pick models + quality per project (here, ⚙)",
  "Usage panel — cost + call counts (header pill)",
  "Every image archives to the global gallery",
];

const DEV_ABILITIES = [
  "Everything in Live, plus:",
  "Decision cards — the agent's routing choices",
  "Step rows with timing detail",
  "Raw request/response JSON (dev drawer)",
  "Manual pipeline triggers: analyze / previews / finals",
];

function CapabilitiesOutline() {
  const [open, setOpen] = useState(false);
  return (
    <section className="mt-4 border-t border-zinc-800 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left text-xs text-zinc-400 hover:text-zinc-200"
        aria-expanded={open}
      >
        <span className="font-mono text-cyan-400">{open ? "▾" : "▸"}</span>
        What can I do here?
      </button>
      {open && (
        <div className="mt-2 flex flex-col gap-2.5 text-[11px] leading-relaxed">
          <div>
            <p className="mb-1 font-medium text-cyan-300">Live mode</p>
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-zinc-400">
              {LIVE_ABILITIES.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-violet-300">Dev mode</p>
            <ul className="flex list-disc flex-col gap-0.5 pl-4 text-zinc-400">
              {DEV_ABILITIES.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">
      {children}
    </h3>
  );
}
