import Link from "next/link";
import Nav from "@/components/Nav";
import {
  DEFAULT_STACK,
  estimateStepCostUSD,
  imageCostUSD,
} from "@/lib/icon/model-reference";

export const metadata = { title: "Roadmap · Asset Arsenal" };

// Strategy doc, in-app. Three things product-building needs written down:
//   1. the pipeline shapes we're testing (theory + trade-off),
//   2. the cost model in TWO layers — per-run model COGS vs infrastructure,
//   3. a prioritized backend roadmap to go from "the bench works" to "a product".
// Cost numbers are computed live from the same helpers /models uses, so they
// can't drift from the real pricing table.

const N = 16; // reference icon-set size for cost comparisons

const txt = (step: Parameters<typeof estimateStepCostUSD>[0], model: string) =>
  estimateStepCostUSD(step, model);

const analyze = txt("analyze", DEFAULT_STACK.models.analyze);
const compose = txt("collectionPrompt", DEFAULT_STACK.models.collectionPrompt);
const indiv = txt("individualPrompts", DEFAULT_STACK.models.individualPrompts);
const collectionImg = imageCostUSD(
  DEFAULT_STACK.models.collectionImage,
  DEFAULT_STACK.quality.collectionImage,
  1,
);
const perIcon = imageCostUSD(
  DEFAULT_STACK.models.generateIcons,
  DEFAULT_STACK.quality.generateIcons,
  1,
);

const COST_V1 = analyze + compose + collectionImg + indiv + perIcon * N;
const COST_V2 = analyze + perIcon * N; // one analyze pass, N image calls
const COST_V3 = analyze + perIcon * 1; // one analyze pass, one grid image

function usd(n: number): string {
  return n >= 0.01 ? `$${n.toFixed(3)}` : `$${n.toFixed(4)}`;
}

type Pipe = {
  tag: string;
  tone: string;
  href: string;
  title: string;
  how: string;
  theory: string;
  tradeoff: string;
  cost: number;
};

const PIPELINES: Pipe[] = [
  {
    tag: "V1",
    tone: "cyan",
    href: "/bench",
    title: "Full chain",
    how: "analyze → collection prompt → collection image → per-icon prompts → generate ×N. The collection image is a clean, regenerated style anchor that §4 and §5 reference.",
    theory:
      "A normalized collection image (icons isolated on a grid, stripped of dashboard noise) is a better style reference than the raw source, so every icon stays on-family.",
    tradeoff:
      "Most steps, most model calls, highest cost. Two extra calls (compose + collection image) before any icon exists.",
    cost: COST_V1,
  },
  {
    tag: "V2",
    tone: "amber",
    href: "/bench-v2",
    title: "Collapsed",
    how: "ONE vision pass returns the manifest + shared style + a ready prompt per icon, then each icon is generated against the original source image (no collection image). Fans out 3 at a time.",
    theory:
      "The model already sees the pixels in the analyze pass — so it can write every per-icon prompt then, more grounded than re-reading a regenerated image. The collection image may not earn its cost.",
    tradeoff:
      "The source is a busy reference; its layout noise can leak into icons (mitigated by the wrapper telling the model to take only style, ignore layout).",
    cost: COST_V2,
  },
  {
    tag: "V3",
    tone: "fuchsia",
    href: "/bench-v3",
    title: "Grid",
    how: "Same analyze front as V2, then ALL icons in ONE 4×4 grid image, sliced locally (alpha-channel connected components, or fixed-grid math). One image call instead of N.",
    theory:
      "Per-icon image calls dominate cost. Generating the whole family in one image and cutting it locally is ~16× cheaper, and local slicing is free regardless of method.",
    tradeoff:
      "16 icons share one 1024² canvas → lower per-icon resolution; slicing has edge-cases (touching/split icons) reconciled against the known icon count.",
    cost: COST_V3,
  },
];

// Per-run variable cost (COGS) — what each generation actually charges us.
const COGS_ROWS = [
  { label: "Analyze / mega-analyze (vision)", v1: usd(analyze), v2: usd(analyze), v3: usd(analyze) },
  { label: "Compose collection prompt (text)", v1: usd(compose), v2: "—", v3: "—" },
  { label: "Collection image (1 image)", v1: usd(collectionImg), v2: "—", v3: "—" },
  { label: "Per-icon prompts (vision)", v1: usd(indiv), v2: "folded in", v3: "folded in" },
  { label: `Icon images (${N} icons)`, v1: usd(perIcon * N), v2: usd(perIcon * N), v3: `${usd(perIcon)} (1 grid)` },
];

// Fixed + scaling infrastructure cost — what it costs to RUN this as a product.
const INFRA = [
  {
    layer: "Object storage (the PNGs)",
    driver: "GB stored × months. Icons are tiny (~50–200 KB each).",
    pick: "Supabase Storage now → Cloudflare R2 at scale",
    rough: "~$0.015–0.023 / GB-mo · pennies at first",
  },
  {
    layer: "Bandwidth / egress",
    driver: "GB served when users browse / download. The sneaky-big line.",
    pick: "R2 (zero egress) is the scale lever",
    rough: "$0 on R2 · metered on Vercel/Supabase",
  },
  {
    layer: "Database (metadata)",
    driver: "Rows: runs, icons, usage ledger, users. Never blobs.",
    pick: "Supabase Postgres",
    rough: "free → ~$25/mo Pro",
  },
  {
    layer: "Compute — generation",
    driver: "Long awaits on OpenAI (seconds × N). Watch function timeouts.",
    pick: "Background queue, not request-thread",
    rough: "queue free tiers (Inngest/Trigger.dev)",
  },
  {
    layer: "Compute — slicing (V3)",
    driver: "sharp is a native binary; a few ms CPU but bundle weight on serverless.",
    pick: "Vercel fn now → separate worker if it bloats",
    rough: "negligible CPU",
  },
  {
    layer: "Auth",
    driver: "Per-user libraries + billing identity.",
    pick: "Supabase Auth",
    rough: "free",
  },
];

// The prioritized backend to-do — "what to work on in the background."
const ROADMAP = [
  {
    n: 1,
    title: "Persistence → server (Postgres + object storage)",
    why: "Today everything is IndexedDB — per-device and ephemeral. This is the foundation everything else needs: runs/icons/usage as rows in Postgres, PNGs as objects in storage, joined by keys.",
    depends: "nothing — start here",
  },
  {
    n: 2,
    title: "Auth + per-user libraries",
    why: "A product needs identity to scope assets, history, and billing. Supabase Auth ties rows + objects to a user.",
    depends: "#1",
  },
  {
    n: 3,
    title: "Async generation queue + progress",
    why: "V2's N image calls (and even V3's grids) are slow and blow past serverless request limits. Move generation to a job; stream progress; survive partial failure with retries.",
    depends: "#1",
  },
  {
    n: 4,
    title: "Zip-on-download export endpoint",
    why: "Bundle a run's PNGs into a .zip on request and stream it. Don't store zips — build from the stored individual assets so they're always fresh.",
    depends: "#1",
  },
  {
    n: 5,
    title: "Server-side usage/cost ledger + per-user quotas",
    why: "The local usage log becomes a real per-user spend record (the COGS table below, per account). Add spend caps + icon quotas so a runaway batch can't surprise-bill.",
    depends: "#1, #2",
  },
  {
    n: 6,
    title: "Asset retention policy",
    why: "Host individual assets for a window so users can browse, then expire (longer for paid tiers). Keeps storage bounded; matches the 'host a bit, then zip' model.",
    depends: "#1, #4",
  },
  {
    n: 7,
    title: "Image-model migration plan",
    why: "gpt-image-1-mini (steps 3 & 5) shuts down 2026-12-01 and the only current model lacks transparent backgrounds. A real backend dependency with a deadline.",
    depends: "tracked on /models",
  },
];

const toneRing: Record<string, string> = {
  cyan: "ring-cyan-700/40 bg-cyan-900/20 text-cyan-300",
  amber: "ring-amber-700/40 bg-amber-900/20 text-amber-300",
  fuchsia: "ring-fuchsia-700/40 bg-fuchsia-900/20 text-fuchsia-300",
};

export default function RoadmapPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-12">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">Roadmap &amp; architecture</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              What the bench proved, what it costs, and what it takes to turn it
              into a product. The generation works — this page is the scaffolding:
              the pipeline shapes we&apos;re comparing, the cost model in two
              layers (per-run vs infrastructure), and a prioritized backend to-do.
            </p>
          </div>

          {/* Pipeline shapes */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Pipeline shapes</h2>
              <p className="max-w-2xl text-sm text-zinc-400">
                Three ways to run the same job, sharing prompts and models. The
                open question across all three:{" "}
                <em className="text-zinc-300">does the collection image earn its cost?</em>{" "}
                Costs below are model spend for a {N}-icon set on the cheapest stack.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {PIPELINES.map((p) => (
                <div key={p.tag} className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${toneRing[p.tone]}`}>
                      {p.tag}
                    </span>
                    <h3 className="text-base font-semibold text-zinc-100">{p.title}</h3>
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <p className="text-zinc-400">{p.how}</p>
                    <p className="text-zinc-300">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Theory · </span>
                      {p.theory}
                    </p>
                    <p className="text-zinc-400">
                      <span className="text-xs uppercase tracking-wide text-zinc-500">Trade-off · </span>
                      {p.tradeoff}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="font-mono text-sm text-zinc-200">{usd(p.cost)}</span>
                    <Link href={p.href} className="text-xs text-cyan-400/80 hover:text-cyan-300">
                      open ↗
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-zinc-600">
              V3 collapses V2&apos;s {N} image calls into 1 — that&apos;s {N}× cheaper on
              the image line, and ≈{Math.round(COST_V2 / COST_V3)}× cheaper on the full
              run once the fixed analyze pass is counted in.
            </p>
          </section>

          {/* Cost model — two layers */}
          <section className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Cost model — two layers</h2>
              <p className="max-w-2xl text-sm text-zinc-400">
                Two very different cost shapes. Keep them separate or pricing
                guesswork creeps in: <strong className="text-zinc-200">variable</strong>{" "}
                (per generation, scales with usage) and{" "}
                <strong className="text-zinc-200">infrastructure</strong> (fixed +
                slow-scaling, the cost of being online).
              </p>
            </div>

            {/* Layer 1 — variable COGS */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
                1 · Variable — model spend per run (COGS)
              </h3>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Call</th>
                      <th className="px-4 py-2 font-medium">V1</th>
                      <th className="px-4 py-2 font-medium">V2</th>
                      <th className="px-4 py-2 font-medium">V3</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {COGS_ROWS.map((r) => (
                      <tr key={r.label} className="text-zinc-300">
                        <td className="px-4 py-2">{r.label}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.v1}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.v2}</td>
                        <td className="px-4 py-2 font-mono text-xs">{r.v3}</td>
                      </tr>
                    ))}
                    <tr className="bg-zinc-900/60 font-semibold text-zinc-100">
                      <td className="px-4 py-2">Total / {N}-icon run</td>
                      <td className="px-4 py-2 font-mono text-xs">{usd(COST_V1)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{usd(COST_V2)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{usd(COST_V3)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-600">
                Live from the same pricing table as the{" "}
                <Link href="/models" className="text-cyan-400/80 hover:text-cyan-300">
                  models cost calculator
                </Link>
                . Image calls dominate; text/vision is a rounding error.
              </p>
            </div>

            {/* Layer 2 — infrastructure */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
                2 · Infrastructure — cost of being a product
              </h3>
              <div className="overflow-x-auto rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Layer</th>
                      <th className="px-4 py-2 font-medium">What drives it</th>
                      <th className="px-4 py-2 font-medium">Recommended</th>
                      <th className="px-4 py-2 font-medium">Rough</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {INFRA.map((r) => (
                      <tr key={r.layer} className="align-top text-zinc-300">
                        <td className="px-4 py-2 font-medium text-zinc-200">{r.layer}</td>
                        <td className="px-4 py-2 text-zinc-400">{r.driver}</td>
                        <td className="px-4 py-2 text-zinc-300">{r.pick}</td>
                        <td className="px-4 py-2 font-mono text-xs text-zinc-400">{r.rough}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-600">
                Unit economics: <span className="font-mono text-zinc-400">price = COGS + infra + margin</span>.
                Making COGS legible (above) is what makes pricing a decision, not a guess.
              </p>
            </div>
          </section>

          {/* Asset storage & delivery */}
          <section className="flex flex-col gap-3 rounded-2xl border border-violet-800/40 bg-violet-950/20 p-6">
            <h2 className="text-xl font-semibold text-violet-200">Asset storage &amp; delivery</h2>
            <p className="max-w-2xl text-sm text-zinc-300">
              The decision under &quot;do we store images or hand out a zip?&quot;:
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-zinc-300">
              <li>
                <strong className="text-zinc-100">Store individual PNGs</strong> in object
                storage; <strong className="text-zinc-100">metadata in Postgres</strong>.
                Never put image bytes in the database.
              </li>
              <li>
                <strong className="text-zinc-100">Host them for a retention window</strong> so
                users can browse/preview (longer for paid tiers), then expire.
              </li>
              <li>
                <strong className="text-zinc-100">Zip on download</strong> — build the archive
                on request from the stored assets and stream it. Don&apos;t persist
                zips; they&apos;re derived and go stale.
              </li>
              <li>
                <strong className="text-zinc-100">Skip Cloudinary for now</strong> — it&apos;s a
                transform/optimization CDN, but icons are already-final PNGs. Plain
                object storage + CDN is cheaper for store-and-serve. Reach for R2
                (zero egress) when bandwidth becomes the bill.
              </li>
            </ul>
            <p className="text-xs text-zinc-500">
              Today: assets live only in browser IndexedDB (per-device, ephemeral) — that&apos;s the gap roadmap #1 closes.
            </p>
          </section>

          {/* Backend roadmap */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">Backend roadmap</h2>
              <p className="max-w-2xl text-sm text-zinc-400">
                Ordered by dependency — what to pull into the background, top first.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {ROADMAP.map((r) => (
                <div key={r.n} className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-sm text-zinc-300">
                    {r.n}
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold text-zinc-100">{r.title}</h3>
                    <p className="text-sm text-zinc-400">{r.why}</p>
                    <span className="text-xs text-zinc-600">depends on: {r.depends}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
