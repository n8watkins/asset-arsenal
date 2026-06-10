"use client";

// Bench Router — the entry step of the product, in isolation. Given what the
// user "provided" (image present? icon list? free text?), the router picks which
// downstream flow to run. It never reads pixels — only presence + the text. The
// only model call classifies the text's intent; the starting point is derived in
// code. Defaults to Gemini Flash-Lite (free tier), so testing the paths is free.

import { useCallback, useMemo, useState } from "react";
import Nav from "@/components/Nav";
import { JUDGE_MODELS, DEFAULT_JUDGE_MODEL } from "@/lib/gemini/models";
import { getModel } from "@/lib/icon/model-reference";
import { classifyRoute } from "@/lib/router/client";
import {
  FLOW_META,
  ROUTER_FLOWS,
  type RouterDecision,
  type RouterFlow,
} from "@/lib/router/types";
import type { TokenUsage } from "@/types/icon-pipeline";

type Preset = {
  name: string;
  hasImage: boolean;
  text: string;
  iconList: string;
  expect: RouterFlow; // the path this preset is meant to exercise
};

// Quick-fill cases — one per path, plus the ambiguous last-resort. `expect` is
// the intended route, shown next to the result so drift is obvious at a glance.
const PRESETS: Preset[] = [
  {
    name: "Polished dashboard",
    hasImage: true,
    text: "",
    iconList: "",
    expect: "extract_assets_from_image",
  },
  {
    name: "Rough draft → improve",
    hasImage: true,
    text: "this is just a rough wireframe, can you clean it up and make it look polished first",
    iconList: "",
    expect: "upgrade_design_first",
  },
  {
    name: "Style from words",
    hasImage: false,
    text: "dark neon SaaS dashboard icons for an AI analytics app, thin monoline, subtle glow",
    iconList: "",
    expect: "generate_style_reference_from_prompt",
  },
  {
    name: "Just an icon list",
    hasImage: false,
    text: "",
    iconList: "analytics, billing, users, settings, api, database",
    expect: "build_icon_pack_from_list",
  },
  {
    name: "Image + list (match style)",
    hasImage: true,
    text: "match this style",
    iconList: "analytics, security, users, automation",
    expect: "use_uploaded_style_reference",
  },
  {
    name: "Too vague",
    hasImage: false,
    text: "help",
    iconList: "",
    expect: "ask_for_clarification",
  },
];

function parseList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BenchRouterPage() {
  const [hasImage, setHasImage] = useState(false);
  const [text, setText] = useState("");
  const [iconListRaw, setIconListRaw] = useState("");
  const [model, setModel] = useState<string>(DEFAULT_JUDGE_MODEL);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<RouterDecision | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [expected, setExpected] = useState<RouterFlow | null>(null);

  const iconList = useMemo(() => parseList(iconListRaw), [iconListRaw]);

  const applyPreset = useCallback((p: Preset) => {
    setHasImage(p.hasImage);
    setText(p.text);
    setIconListRaw(p.iconList);
    setExpected(p.expect);
    setDecision(null);
    setError(null);
    setUsage(null);
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      const res = await classifyRoute({ hasImage, text, iconList, model });
      setDecision(res.decision);
      setUsage(res.usage ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [hasImage, text, iconList, model]);

  // The catalog knows which models we currently call on a free tier — don't
  // hardcode a single model id here.
  const isFree = getModel(model)?.freeTier ?? false;

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">Bench Router</h1>
              <span className="rounded-md bg-sky-900/30 px-2 py-0.5 text-xs text-sky-300 ring-1 ring-sky-700/40">
                intake routing
              </span>
            </div>
            <p className="max-w-2xl text-sm text-zinc-400">
              The entry step, isolated. Given what the user provided —{" "}
              <strong className="text-zinc-200">image present? icon list? free text?</strong>{" "}
              — the router picks which downstream flow to run. It never reads the
              image; only presence and the text. The starting point is computed in
              code, and one small model call classifies intent.
            </p>
          </div>

          {/* Presets */}
          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-sky-400">▸</span>
              <h2 className="text-lg font-semibold">Test cases</h2>
              <span className="text-xs text-zinc-500">one per path — load, then run</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="rounded-lg border border-zinc-700 bg-zinc-950/60 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-sky-500/60 hover:text-sky-200"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          {/* Inputs */}
          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-sky-400">1</span>
              <h2 className="text-lg font-semibold">Input</h2>
            </div>

            <label className="flex cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={hasImage}
                onChange={(e) => setHasImage(e.target.checked)}
                className="h-4 w-4 accent-sky-500"
              />
              <span className="text-zinc-300">Image attached</span>
              <span className="text-xs text-zinc-600">
                presence only — the router never sees the pixels
              </span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                User&apos;s text / request
              </span>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={3}
                placeholder="e.g. dark neon SaaS icons — or leave empty"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/60 focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                Explicit icon list{" "}
                <span className="text-zinc-600">(comma or newline separated — optional)</span>
              </span>
              <textarea
                value={iconListRaw}
                onChange={(e) => setIconListRaw(e.target.value)}
                rows={2}
                placeholder="analytics, billing, users, settings"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/60 focus:outline-none"
              />
              {iconList.length > 0 && (
                <span className="text-xs text-zinc-500">{iconList.length} icon(s) parsed</span>
              )}
            </label>

            <div className="flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-xs uppercase tracking-widest text-zinc-500">Model</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-200"
                >
                  {JUDGE_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      Gemini {m.label} — {m.blurb}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={run}
                disabled={running}
                className="rounded-xl bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-200 ring-1 ring-sky-500/40 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? "Routing…" : "▸ Route"}
              </button>
              <span className="text-xs text-zinc-500">
                {isFree ? "free tier" : "billed"}
              </span>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </section>

          {/* Decision */}
          {decision && (
            <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-sky-400">2</span>
                <h2 className="text-lg font-semibold">Decision</h2>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md bg-sky-500/15 px-3 py-1 font-mono text-sm text-sky-200 ring-1 ring-sky-500/40">
                  {decision.recommendedFlow}
                </span>
                {expected &&
                  (expected === decision.recommendedFlow ? (
                    <span className="rounded bg-emerald-900/30 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-emerald-700/40">
                      matches expected
                    </span>
                  ) : (
                    <span className="rounded bg-amber-900/30 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-700/40">
                      expected {expected}
                    </span>
                  ))}
                {decision.needsUserChoice && (
                  <span className="rounded bg-violet-900/30 px-2 py-0.5 text-xs text-violet-300 ring-1 ring-violet-700/40">
                    needs user choice
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Starting point" value={decision.startingPoint} mono />
                <div className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                    Confidence
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{ width: `${Math.round(decision.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-sm text-zinc-300">
                      {decision.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Reason</span>
                <p className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-300">
                  {decision.reason}
                </p>
              </div>

              {usage && (
                <p className="text-xs text-zinc-600">
                  {usage.inputTokens} in / {usage.outputTokens} out tokens ·{" "}
                  {isFree ? "free tier" : model}
                </p>
              )}
            </section>
          )}

          {/* Flow legend */}
          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold">The paths</h2>
            <p className="text-sm text-zinc-400">
              Every flow the router can pick. The recommended one is highlighted.
            </p>
            <div className="flex flex-col gap-2">
              {ROUTER_FLOWS.map((flow) => {
                const picked = decision?.recommendedFlow === flow;
                return (
                  <div
                    key={flow}
                    className={`flex flex-col gap-0.5 rounded-lg border p-3 ${
                      picked
                        ? "border-sky-500/50 bg-sky-950/20"
                        : "border-zinc-800 bg-zinc-950/40"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${picked ? "text-sky-200" : "text-zinc-200"}`}>
                        {FLOW_META[flow].label}
                      </span>
                      <span className="font-mono text-[10px] text-zinc-600">{flow}</span>
                    </div>
                    <span className="text-xs text-zinc-400">{FLOW_META[flow].blurb}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-sm text-zinc-300 ${mono ? "font-mono" : ""}`}>{value || "—"}</span>
    </div>
  );
}
