import Link from "next/link";
import Nav from "@/components/Nav";
import {
  STRATEGIES,
  VARIANTS,
  BASELINE,
  STEP_META,
  OUTPUT_MODE_LABEL,
  variantsForStep,
  type PromptVariant,
} from "@/lib/icon/experiments";
import { STEPS } from "@/lib/icon/model-reference";

export const metadata = { title: "Experiments · Asset Arsenal" };

// Read-only catalog of the prompt hypotheses we want to compare, per step, plus
// a plain-language explanation of how the experiment works and what the baseline
// is. Choosing a variant per step on the bench + thumbs up/down come next.

function ModeBadge({ mode }: { mode: PromptVariant["mode"] }) {
  if (!mode) return null;
  const tone =
    mode === "enforced"
      ? "bg-emerald-900/30 text-emerald-300 ring-emerald-700/40"
      : mode === "prompt-json"
        ? "bg-cyan-900/30 text-cyan-300 ring-cyan-700/40"
        : "bg-amber-900/30 text-amber-300 ring-amber-700/40";
  return (
    <span className={`rounded-md px-2 py-0.5 text-xs ring-1 ${tone}`}>
      {OUTPUT_MODE_LABEL[mode]}
    </span>
  );
}

function VariantCard({ v }: { v: PromptVariant }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold text-zinc-100">{v.label}</h3>
        {v.isBaseline && (
          <span className="rounded-md bg-violet-900/30 px-2 py-0.5 text-xs text-violet-300 ring-1 ring-violet-700/40">
            baseline
          </span>
        )}
        <ModeBadge mode={v.mode} />
      </div>
      <p className="text-sm text-zinc-400">{v.hypothesis}</p>
      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-cyan-400/80 hover:text-cyan-300">
          view prompt template
        </summary>
        <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
          {v.template}
        </pre>
      </details>
    </div>
  );
}

export default function ExperimentsPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">Experiments</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              We don&apos;t yet know the best way to prompt each step — so instead
              of committing to one, we keep a few <em>hypotheses</em> per step and
              compare them. The trick: across any hypothesis, the only thing that
              changes is the <strong className="text-zinc-200">prompt</strong> (and
              the <strong className="text-zinc-200">model</strong>, which the{" "}
              <Link href="/models" className="text-cyan-400/80 hover:text-cyan-300">
                stack
              </Link>{" "}
              already varies). So an experiment is just{" "}
              <span className="font-mono text-zinc-300">
                step × prompt variant × model
              </span>
              , judged with a thumbs up / down on the result.
            </p>
            <p className="max-w-2xl text-sm text-zinc-500">
              This page is the catalog of variants worth trying. Running them — pick
              a variant per step on the Bench, then rate each output — is the next
              step; for now this lays out <em>what</em> we&apos;d compare and why.
            </p>
          </div>

          {/* Baseline */}
          <section className="flex flex-col gap-3 rounded-2xl border border-violet-800/40 bg-violet-950/20 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-violet-200">
                Start here: the baseline
              </h2>
              <span className="rounded-md bg-violet-900/40 px-2 py-0.5 text-xs text-violet-200 ring-1 ring-violet-700/40">
                run this first
              </span>
            </div>
            <p className="max-w-2xl text-sm text-zinc-300">{BASELINE.why}</p>
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-xs uppercase tracking-widest text-zinc-500">
                Baseline = cheapest models + most-structured prompt, every step
              </span>
              <div className="flex flex-col gap-1.5">
                {STEPS.map((s) => (
                  <div
                    key={s.key}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                  >
                    <span className="font-mono text-xs text-violet-300">
                      §{s.num}
                    </span>
                    <span className="text-zinc-300">{s.name}</span>
                    <span className="font-mono text-xs text-cyan-300/80">
                      {BASELINE.models[s.key]}
                    </span>
                    <span className="ml-auto font-mono text-xs text-zinc-500">
                      {
                        VARIANTS.find((v) => v.id === BASELINE.variantByStep[s.key])
                          ?.label
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* The three JSON strategies */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">
                The headline question: how do we get structured output?
              </h2>
              <p className="max-w-2xl text-sm text-zinc-400">
                Two steps (§1 analyze, §4 per-icon prompts) have to return JSON the
                rest of the chain can consume. There are three ways to ask for it,
                and that&apos;s the experiment most worth running.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {STRATEGIES.map((s) => (
                <div
                  key={s.mode}
                  className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                >
                  <div className="flex items-center gap-2">
                    <ModeBadge mode={s.mode} />
                  </div>
                  <h3 className="text-base font-semibold text-zinc-100">
                    {s.title}
                  </h3>
                  <p className="text-sm text-zinc-400">{s.thesis}</p>
                  <p className="text-xs text-zinc-500">{s.detail}</p>
                  <p className="mt-auto pt-1 text-xs text-zinc-400">
                    <span className="text-zinc-500">trade-off: </span>
                    {s.tradeoff}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Per-step variants */}
          <section className="flex flex-col gap-6">
            <h2 className="text-xl font-semibold">Variants by step</h2>
            {STEPS.map((s) => {
              const vs = variantsForStep(s.key);
              return (
                <div key={s.key} className="flex flex-col gap-3">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-sm font-bold text-violet-400">
                      §{STEP_META[s.key].num}
                    </span>
                    <h3 className="text-lg font-medium text-zinc-200">
                      {STEP_META[s.key].name}
                    </h3>
                    <span className="text-xs text-zinc-600">
                      {vs.length} variant{vs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {vs.map((v) => (
                      <VariantCard key={v.id} v={v} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          <p className="pb-6 text-xs text-zinc-600">
            Next: a per-step variant picker on the{" "}
            <Link href="/bench" className="text-zinc-500 hover:text-cyan-400">
              Bench
            </Link>{" "}
            (so you can run any variant) and thumbs up / down on each result,
            logged alongside the model used — so the votes accumulate into a feel
            for what actually works.
          </p>
        </div>
      </main>
    </>
  );
}
