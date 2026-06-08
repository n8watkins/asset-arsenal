"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "@/components/Nav";
import {
  CATALOG,
  STEPS,
  SOURCES,
  CAVEATS,
  REFERENCE_ACCESSED,
  DEFAULT_STACK,
  compatibleModels,
  costForStack,
  getModel,
  CAPABILITY_LABEL,
  type Stack,
  type StepKey,
  type ImageQuality,
  type CatalogModel,
  type Citation,
  type Capability,
} from "@/lib/icon/model-reference";
import { loadStacks, saveStacks } from "@/lib/icon/stacks";

function usd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function clone(s: Stack): Stack {
  return JSON.parse(JSON.stringify(s)) as Stack;
}

// ---------------------------------------------------------------------------
// Small shared bits
// ---------------------------------------------------------------------------

function SourceLinks({ items, label = "Sources" }: { items: Citation[]; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
      <span className="uppercase tracking-widest">{label}</span>
      {items.map((c) => (
        <a
          key={c.url + c.label}
          href={c.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-zinc-800 px-2 py-1 text-cyan-400/80 ring-1 ring-zinc-700 transition-colors hover:text-cyan-300 hover:ring-zinc-600"
        >
          {c.label} ↗
        </a>
      ))}
    </div>
  );
}

function StatusBadge({ m }: { m: CatalogModel }) {
  if (m.status === "current") {
    return (
      <span className="rounded-md bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
        current
      </span>
    );
  }
  return (
    <span
      className="rounded-md bg-amber-900/40 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-700/40"
      title={m.deprecation ? `deprecated ${m.deprecation.since}; shutdown ${m.deprecation.shutdown}` : "deprecated"}
    >
      deprecated{m.deprecation ? ` · ends ${m.deprecation.shutdown}` : ""}
    </span>
  );
}

function CapChip({ c }: { c: Capability }) {
  return (
    <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300 ring-1 ring-zinc-700">
      {CAPABILITY_LABEL[c]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ModelsPage() {
  const [stack, setStack] = useState<Stack>(() => clone(DEFAULT_STACK));
  const [saved, setSaved] = useState<Stack[]>([]);
  const [stackName, setStackName] = useState("");

  useEffect(() => {
    setSaved(loadStacks());
  }, []);

  const { lines, total } = costForStack(stack);

  function setModel(stepKey: StepKey, modelId: string) {
    setStack((s) => ({ ...s, models: { ...s.models, [stepKey]: modelId } }));
  }

  function persist(next: Stack[]) {
    setSaved(next);
    saveStacks(next);
  }

  function handleSave() {
    const name = stackName.trim() || `Stack ${saved.length + 1}`;
    const toSave = { ...clone(stack), name };
    // replace by name if it exists, else append
    const idx = saved.findIndex((s) => s.name === name);
    const next = idx >= 0 ? saved.map((s, i) => (i === idx ? toSave : s)) : [...saved, toSave];
    persist(next);
    setStackName("");
  }

  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">Models & Costs</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              The vertical stack of models this pipeline runs on, what each step
              needs, and what a run costs — swap any model to see the price
              change. Every figure is cited.
            </p>
            <Link href="/bench" className="self-start text-sm font-medium text-cyan-400/80 hover:text-cyan-300">
              → back to the Test Bench
            </Link>
          </div>

          {/* SOURCES — at the top, as requested */}
          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold">Sources</h2>
              <span className="text-xs text-zinc-500">
                All figures verified against OpenAI&apos;s official docs · accessed{" "}
                <span className="text-cyan-400">{REFERENCE_ACCESSED}</span>
              </span>
            </div>
            <SourceLinks items={SOURCES} label="Official docs" />
          </section>

          {/* CALCULATOR / STACK BUILDER */}
          <section className="flex flex-col gap-5 rounded-2xl border border-cyan-900/50 bg-zinc-900 p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Stack calculator</h2>
                <p className="mt-1 max-w-xl text-sm text-zinc-400">
                  6 pipeline steps; <span className="text-zinc-300">step 0 (upload) is free</span>,
                  so 5 steps incur model cost. Pick a model (and image quality)
                  per step.
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono text-3xl font-bold text-cyan-300">≈ {usd(total)}</div>
                <div className="text-xs text-zinc-500">per run · {stack.iconCount} icons</div>
              </div>
            </div>

            {/* Run controls */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                Icons per run
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={stack.iconCount}
                  onChange={(e) =>
                    setStack((s) => ({
                      ...s,
                      iconCount: Math.max(1, Math.min(40, Number(e.target.value) || 1)),
                    }))
                  }
                  className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </label>
              <button
                onClick={() => setStack(clone(DEFAULT_STACK))}
                className="text-sm text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              >
                ↩ reset to active stack
              </button>
            </div>

            {/* Step 0 — free */}
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-zinc-800 px-4 py-3 text-sm text-zinc-500">
              <span className="font-mono text-zinc-600">Step 0</span>
              <span className="text-zinc-400">Upload source image</span>
              <span className="ml-auto font-mono text-zinc-600">no model · free</span>
            </div>

            {/* Steps 1–5 */}
            <div className="flex flex-col gap-4">
              {STEPS.map((step) => {
                const options = compatibleModels(step);
                const selectedId = stack.models[step.key];
                const selected = getModel(selectedId);
                const line = lines.find((l) => l.step.key === step.key)!;
                const isImage = step.kind === "image";
                const quality =
                  step.key === "collectionImage"
                    ? stack.quality.collectionImage
                    : step.key === "generateIcons"
                      ? stack.quality.generateIcons
                      : undefined;

                return (
                  <div key={step.key} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-violet-300">Step {step.num}</span>
                          <h3 className="text-base font-semibold text-zinc-100">{step.name}</h3>
                        </div>
                        <p className="max-w-xl text-sm leading-relaxed text-zinc-400">{step.description}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-mono text-lg text-zinc-100">{usd(line.cost)}</div>
                        {!line.exact && <div className="text-xs text-amber-400/70">estimate</div>}
                      </div>
                    </div>

                    {/* requirements */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs uppercase tracking-widest text-zinc-600">requires</span>
                      {step.requires.map((c) => (
                        <CapChip key={c} c={c} />
                      ))}
                      {step.prefers?.map((c) => (
                        <span key={c} className="rounded-md bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-500 ring-1 ring-zinc-700/60">
                          prefers: {CAPABILITY_LABEL[c]}
                        </span>
                      ))}
                    </div>

                    {/* model + quality pickers */}
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={selectedId}
                        onChange={(e) => setModel(step.key, e.target.value)}
                        className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 font-mono text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                      >
                        {options.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id}
                            {m.status === "deprecated" ? "  (deprecated)" : ""}
                          </option>
                        ))}
                      </select>
                      {selected && <StatusBadge m={selected} />}
                      {isImage && quality && (
                        <label className="flex items-center gap-2 text-sm text-zinc-400">
                          quality
                          <select
                            value={quality}
                            onChange={(e) =>
                              setStack((s) => ({
                                ...s,
                                quality: { ...s.quality, [step.key]: e.target.value as ImageQuality },
                              }))
                            }
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          >
                            <option value="low">low</option>
                            <option value="medium">medium</option>
                            <option value="high">high</option>
                          </select>
                        </label>
                      )}
                      <span className="font-mono text-xs text-zinc-600">{line.detail}</span>
                    </div>

                    {line.warning && (
                      <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-300/90">
                        ⚠ {line.warning}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save / load stacks */}
            <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-200">Saved stacks</h3>
                <span className="text-xs text-zinc-600">stored locally · the Bench will read these next</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={stackName}
                  onChange={(e) => setStackName(e.target.value)}
                  placeholder="name this stack…"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  Save stack
                </button>
              </div>
              {saved.length === 0 ? (
                <p className="text-sm text-zinc-600">No saved stacks yet.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {saved.map((s) => {
                    const c = costForStack(s).total;
                    return (
                      <div key={s.name} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2">
                        <span className="flex-1 truncate text-sm text-zinc-200">{s.name}</span>
                        <span className="font-mono text-xs text-cyan-300">≈ {usd(c)}</span>
                        <span className="font-mono text-xs text-zinc-600">{s.iconCount} icons</span>
                        <button
                          onClick={() => setStack(clone(s))}
                          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-cyan-600/60 hover:text-cyan-300"
                        >
                          Load
                        </button>
                        <button
                          onClick={() => persist(saved.filter((x) => x.name !== s.name))}
                          className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:border-red-700/60 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <SourceLinks items={SOURCES} label="Cost sources" />
          </section>

          {/* MODEL CATALOG */}
          <section className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
            <h2 className="text-xl font-semibold">Model catalog</h2>
            <p className="-mt-2 text-sm text-zinc-400">
              Every current option per capability class, with the deprecated
              ones flagged. This is the menu you swap among per step.
            </p>

            <CatalogGroup title="Text / vision models" models={CATALOG.filter((m) => m.kind === "text")} />
            <CatalogGroup title="Image-generation models (images.edit)" models={CATALOG.filter((m) => m.kind === "image")} />
          </section>

          {/* CAVEATS */}
          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
            <h2 className="text-xl font-semibold">Notes & caveats</h2>
            <div className="flex flex-col gap-4">
              {CAVEATS.map((c) => (
                <div
                  key={c.title}
                  className={`flex flex-col gap-1 rounded-xl border p-4 ${
                    c.severity === "warn"
                      ? "border-amber-800/40 bg-amber-950/20"
                      : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  <h3 className={`text-sm font-semibold ${c.severity === "warn" ? "text-amber-300" : "text-zinc-200"}`}>
                    {c.severity === "warn" ? "⚠ " : ""}
                    {c.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{c.body}</p>
                  {c.source && (
                    <a href={c.source.url} target="_blank" rel="noreferrer" className="text-xs text-cyan-400/80 hover:text-cyan-300">
                      {c.source.label} ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Expandability + maintenance note */}
          <p className="pb-6 text-xs text-zinc-600">
            This is the OpenAI vertical stack. The data model is provider-neutral,
            so Gemini / Flux / etc. can be added later as catalog entries. To
            update prices or models, edit{" "}
            <span className="font-mono text-zinc-500">lib/icon/model-reference.ts</span>{" "}
            and bump the accessed date; the active stack reads from{" "}
            <span className="font-mono text-zinc-500">lib/icon/models.ts</span>.
          </p>
        </div>
      </main>
    </>
  );
}

function CatalogGroup({ title, models }: { title: string; models: CatalogModel[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-500">{title}</h3>
      <div className="flex flex-col gap-3">
        {models.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-base font-semibold text-zinc-100">{m.id}</span>
              <StatusBadge m={m} />
              <div className="ml-auto flex flex-wrap gap-1.5">
                {m.capabilities.map((c) => (
                  <CapChip key={c} c={c} />
                ))}
              </div>
            </div>
            {m.note && <p className="text-sm text-zinc-400">{m.note}</p>}

            {/* pricing */}
            {m.tokenPricing && (
              <p className="font-mono text-xs text-zinc-400">
                <span className="text-zinc-600">per 1M tokens →</span> in ${m.tokenPricing.inputPerM.toFixed(2)} ·{" "}
                {m.tokenPricing.cachedInputPerM != null && <>cached ${m.tokenPricing.cachedInputPerM.toFixed(3)} · </>}
                out ${m.tokenPricing.outputPerM.toFixed(2)}
                {m.contextWindow && <span className="text-zinc-600"> · ctx {m.contextWindow.toLocaleString()}</span>}
                {m.knowledgeCutoff && <span className="text-zinc-600"> · cutoff {m.knowledgeCutoff}</span>}
              </p>
            )}
            {m.imagePricing && (
              <p className="font-mono text-xs text-zinc-400">
                <span className="text-zinc-600">per image (1024²) →</span> low {usd(m.imagePricing.low)} · medium{" "}
                {usd(m.imagePricing.medium)} · high {usd(m.imagePricing.high)}
              </p>
            )}

            <SourceLinks items={m.citations} />
          </div>
        ))}
      </div>
    </div>
  );
}
