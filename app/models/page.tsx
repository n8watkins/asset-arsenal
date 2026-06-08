import Link from "next/link";
import Nav from "@/components/Nav";
import {
  MODELS,
  CAVEATS,
  RUN_ESTIMATE,
  RUN_ESTIMATE_TOTAL,
  REFERENCE_ACCESSED,
  type ModelRef,
  type Citation,
} from "@/lib/icon/model-reference";

function usd(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
        on
          ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
          : "bg-zinc-800 text-zinc-600 ring-1 ring-zinc-700 line-through"
      }`}
    >
      {label}
    </span>
  );
}

function Cite({ items }: { items: Citation[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
      <span className="uppercase tracking-widest">Sources</span>
      {items.map((c) => (
        <a
          key={c.url}
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

function ModelCard({ m }: { m: ModelRef }) {
  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-2xl font-bold text-zinc-100">{m.id}</h2>
          <span className="rounded-md bg-violet-900/30 px-2.5 py-1 font-mono text-xs text-violet-300 ring-1 ring-violet-700/40">
            {m.tier}
          </span>
        </div>
        <p className="text-base font-medium text-cyan-300">{m.role}</p>
        <p className="font-mono text-xs text-zinc-500">{m.pipelineSteps}</p>
      </div>

      {/* What it does */}
      <p className="text-base leading-relaxed text-zinc-300">{m.whatItDoes}</p>

      {/* Modalities + specs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Chip on={m.modalities.textIn} label="text in" />
          <Chip on={m.modalities.textOut} label="text out" />
          <Chip on={m.modalities.visionIn} label="vision in" />
          <Chip on={m.modalities.imageOut} label="image out" />
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-zinc-400">
          {m.contextWindow && (
            <span>
              <span className="text-zinc-500">context</span>{" "}
              {m.contextWindow.toLocaleString()} tok
            </span>
          )}
          {m.maxOutput && (
            <span>
              <span className="text-zinc-500">max output</span>{" "}
              {m.maxOutput.toLocaleString()} tok
            </span>
          )}
          {m.knowledgeCutoff && (
            <span>
              <span className="text-zinc-500">knowledge cutoff</span>{" "}
              {m.knowledgeCutoff}
            </span>
          )}
        </div>
      </div>

      {/* Pricing */}
      {m.tokenPricing && (
        <div className="overflow-hidden rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-zinc-500">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Per 1M tokens</th>
                <th className="px-4 py-2 text-right font-medium">Input</th>
                <th className="px-4 py-2 text-right font-medium">Cached in</th>
                <th className="px-4 py-2 text-right font-medium">Output</th>
              </tr>
            </thead>
            <tbody className="text-zinc-200">
              <tr>
                <td className="px-4 py-2 text-zinc-500">price</td>
                <td className="px-4 py-2 text-right font-mono">${m.tokenPricing.inputPerM.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {m.tokenPricing.cachedInputPerM != null ? `$${m.tokenPricing.cachedInputPerM.toFixed(3)}` : "—"}
                </td>
                <td className="px-4 py-2 text-right font-mono">${m.tokenPricing.outputPerM.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {m.image && (
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-950 text-zinc-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Per image (1024²)</th>
                  <th className="px-4 py-2 text-right font-medium">Low</th>
                  <th className="px-4 py-2 text-right font-medium">Medium</th>
                  <th className="px-4 py-2 text-right font-medium">High</th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                <tr className="border-b border-zinc-800/60">
                  <td className="px-4 py-2 text-zinc-500">price</td>
                  <td className="px-4 py-2 text-right font-mono">{usd(m.image.perImage1024.low)}</td>
                  <td className="px-4 py-2 text-right font-mono">{usd(m.image.perImage1024.medium)}</td>
                  <td className="px-4 py-2 text-right font-mono">{usd(m.image.perImage1024.high)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 text-zinc-500">output tokens</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-400">{m.image.outputTokens1024.low}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-400">{m.image.outputTokens1024.medium}</td>
                  <td className="px-4 py-2 text-right font-mono text-zinc-400">{m.image.outputTokens1024.high}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-500">
            Token rates: image output ${m.image.imageOutputPerM.toFixed(2)}/1M · text input $
            {m.image.textInputPerM.toFixed(2)}/1M · image input (cached) $
            {m.image.imageInputCachedPerM.toFixed(2)}/1M. Sizes: {m.image.sizes.join(" · ")}.
          </p>
        </div>
      )}

      {/* Verification + citations */}
      <p className="text-xs text-emerald-400/80">✓ {m.verification}</p>
      <Cite items={m.citations} />
    </section>
  );
}

export default function ModelsPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-10">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">Models & Costs</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              What each model in the pipeline does, and what a run actually
              costs — so you can know your spend before you generate. Every
              number is cited; verified against OpenAI&apos;s official docs on{" "}
              <span className="text-cyan-400">{REFERENCE_ACCESSED}</span>.
            </p>
            <Link
              href="/bench"
              className="self-start text-sm font-medium text-cyan-400/80 hover:text-cyan-300"
            >
              → back to the Test Bench
            </Link>
          </div>

          {/* Cost-per-run estimator */}
          <section className="flex flex-col gap-4 rounded-2xl border border-cyan-900/50 bg-zinc-900 p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">
                  Cost of one run (~{RUN_ESTIMATE.iconCount} icons)
                </h2>
                <p className="mt-1 text-sm text-zinc-400">
                  Image costs are exact (OpenAI per-image table); token counts on
                  the text/vision steps are estimates.
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono text-3xl font-bold text-cyan-300">
                  ≈ {usd(RUN_ESTIMATE_TOTAL)}
                </div>
                <div className="text-xs text-zinc-500">estimated total</div>
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-950 text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Step</th>
                    <th className="px-4 py-2 text-left font-medium">Model</th>
                    <th className="px-4 py-2 text-left font-medium">Detail</th>
                    <th className="px-4 py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {RUN_ESTIMATE.lines.map((l) => (
                    <tr key={l.step} className="border-t border-zinc-800/60">
                      <td className="px-4 py-2 text-zinc-200">{l.step}</td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-400">{l.model}</td>
                      <td className="px-4 py-2 text-zinc-500">
                        {l.detail}
                        {!l.exact && <span className="ml-1 text-amber-400/70">~</span>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-zinc-200">{usd(l.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500">
              <span className="text-amber-400/70">~</span> = estimated token
              counts. Scales roughly linearly: each extra medium icon ≈ $0.011.
            </p>
          </section>

          {/* Per-model cards */}
          <div className="flex flex-col gap-6">
            {MODELS.map((m) => (
              <ModelCard key={m.id} m={m} />
            ))}
          </div>

          {/* Caveats */}
          <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
            <h2 className="text-xl font-semibold">Notes & caveats</h2>
            <div className="flex flex-col gap-4">
              {CAVEATS.map((c) => (
                <div key={c.title} className="flex flex-col gap-1">
                  <h3 className="text-sm font-semibold text-zinc-200">{c.title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{c.body}</p>
                  {c.source && (
                    <a
                      href={c.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-cyan-400/80 hover:text-cyan-300"
                    >
                      {c.source.label} ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>

          <p className="pb-6 text-xs text-zinc-600">
            Pricing and model specs change. To update, edit{" "}
            <span className="font-mono text-zinc-500">lib/icon/model-reference.ts</span>{" "}
            and bump the accessed date. Model IDs are configured in{" "}
            <span className="font-mono text-zinc-500">lib/icon/models.ts</span>.
          </p>
        </div>
      </main>
    </>
  );
}
