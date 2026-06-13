"use client";

// SVG Icon Bench — the deterministic lane (docs/SVG-ICON-BENCH.md).
//
// Fetch real vectors from bundled Iconify sets → restyle them live as CSS/SVG
// (color, gradient, stroke, glow, badge, background) → preview the whole pack
// under one style. No model calls, ~$0 per icon. Export (PNG/zip/recipe) is the
// next step; this is the "does live restyle feel like magic?" proof slice.

import { useCallback, useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import RestyleControls from "@/components/svg-bench/RestyleControls";
import PackPreview from "@/components/svg-bench/PackPreview";
import SearchPanel from "@/components/svg-bench/SearchPanel";
import { SEED_PACK } from "@/lib/svg/seed";
import { resolveAndCache, cachedCount } from "@/lib/svg/cache";
import { DEFAULT_STYLE } from "@/lib/svg/types";
import type { SvgIconRecord, SvgStyle } from "@/lib/svg/types";

interface Preset {
  label: string;
  style: SvgStyle;
}

// A few one-click style recipes — the "oh, the whole pack matches" demo.
const PRESETS: Preset[] = [
  {
    label: "Space HUD",
    style: {
      color: {
        type: "gradient",
        kind: "linear",
        angle: 45,
        stops: [
          { offset: 0, color: "#67e8f9" },
          { offset: 1, color: "#a78bfa" },
        ],
      },
      strokeWidth: 2,
      glow: { color: "#22d3ee", blur: 1.25 },
      badge: { shape: "hex", bg: "#0b1220", padding: 0.2 },
      background: "#0b1220",
    },
  },
  {
    label: "Luxury Gold",
    style: {
      color: {
        type: "gradient",
        kind: "linear",
        angle: 90,
        stops: [
          { offset: 0, color: "#fde68a" },
          { offset: 1, color: "#d97706" },
        ],
      },
      strokeWidth: 1.75,
      glow: { color: "#f59e0b", blur: 0.75 },
      badge: { shape: "circle", bg: "#1c1917", padding: 0.22 },
      background: "#1c1917",
    },
  },
  {
    label: "Cyber Green",
    style: {
      color: { type: "solid", value: "#4ade80" },
      strokeWidth: 2.25,
      glow: { color: "#22c55e", blur: 1.5 },
      badge: { shape: "rounded", bg: "#0a0f0a", padding: 0.2 },
      background: "#0a0f0a",
    },
  },
  {
    label: "Flat Mono",
    style: { ...DEFAULT_STYLE, color: { type: "solid", value: "#e4e4e7" } },
  },
];

export default function SvgBenchPage() {
  const [records, setRecords] = useState<SvgIconRecord[]>([]);
  const [style, setStyle] = useState<SvgStyle>(PRESETS[0].style);
  const [cacheN, setCacheN] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshCacheCount = useCallback(() => {
    cachedCount().then(setCacheN).catch(() => {});
  }, []);

  // Load the seed pack from bundled sets on mount.
  useEffect(() => {
    let alive = true;
    (async () => {
      const resolved = await Promise.all(
        SEED_PACK.map((ref) => resolveAndCache(ref.prefix, ref.name))
      );
      if (!alive) return;
      setRecords(
        resolved
          .map((r) => r.record)
          .filter((r): r is SvgIconRecord => r !== null)
      );
      setLoading(false);
      refreshCacheCount();
    })();
    return () => {
      alive = false;
    };
  }, [refreshCacheCount]);

  const inPack = useMemo(() => new Set(records.map((r) => r.id)), [records]);

  const addIcon = useCallback(
    (record: SvgIconRecord) => {
      setRecords((prev) =>
        prev.some((r) => r.id === record.id) ? prev : [...prev, record]
      );
      refreshCacheCount();
    },
    [refreshCacheCount]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            SVG Icon Bench
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            The deterministic lane — fetch a real vector and restyle it as
            CSS/SVG. No model calls, ~$0 per icon. Drag a control and the whole
            pack restyles at once.
          </p>
          <p className="mt-2 text-xs text-zinc-600">
            {cacheN} icon{cacheN === 1 ? "" : "s"} cached locally · served
            offline from bundled sets
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Controls column */}
          <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Presets
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setStyle(p.style)}
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:border-cyan-600 hover:text-white"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Restyle
              </h2>
              <RestyleControls style={style} onChange={setStyle} />
            </section>
          </aside>

          {/* Preview + search column */}
          <div className="space-y-6">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Pack preview · {records.length} icons
                </h2>
              </div>
              {loading ? (
                <p className="text-sm text-zinc-500">Loading seed pack…</p>
              ) : (
                <PackPreview records={records} style={style} />
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Add icons
              </h2>
              <SearchPanel onAdd={addIcon} inPack={inPack} />
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
