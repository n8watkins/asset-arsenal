import Link from "next/link";
import Nav from "@/components/Nav";

export const metadata = { title: "Backlog · Asset Arsenal" };

// The "what to build" queue (decided, not built). Strategy/why lives on
// /roadmap; this is the actionable to-do, mirrored in docs/BACKLOG.md.

type Status = "next" | "queued" | "deferred";

const STATUS: Record<Status, { label: string; tone: string }> = {
  next: { label: "next", tone: "bg-emerald-900/30 text-emerald-300 ring-emerald-700/40" },
  queued: { label: "queued", tone: "bg-amber-900/30 text-amber-300 ring-amber-700/40" },
  deferred: { label: "deferred", tone: "bg-zinc-800 text-zinc-400 ring-zinc-700" },
};

type Item = {
  n: number;
  status: Status;
  title: string;
  what: string;
  why: string;
  approach: string[];
  effort: string;
  depends: string;
};

const ITEMS: Item[] = [
  {
    n: 1,
    status: "next",
    title: "Regression / eval harness",
    what: "A golden set of source images with known-good outputs, run through V1/V2/V3 on demand, scored and tracked over time.",
    why: "Replaces eyeballing with data — actually answers 'does the collection image earn its cost?' and 'did this prompt edit help?'. Turns /experiments from a catalog into a measurement tool.",
    approach: [
      "~5–10 representative sources committed as fixtures.",
      "A 'run eval' action: execute a pipeline + variant across all fixtures, record cost / latency / icon count / success rate / outputs.",
      "Scoring starts with thumbs up/down; add a cheap auto-signal later (vision-model consistency rating, or alpha-coverage / blob-count sanity for V3).",
      "Persist runs so two prompt versions compare side by side.",
    ],
    effort: "M–L",
    depends: "server persistence (Roadmap #1); can prototype on IndexedDB first",
  },
  {
    n: 2,
    status: "queued",
    title: "Text-only brief → asset set",
    what: "Generate a style + a full icon set from a text brief alone — no screenshot (e.g. 'fintech dashboard, calm, rounded, navy + mint').",
    why: "Widens the funnel from 'people with a UI to screenshot' to 'anyone with an idea.' Natural extension of Bench S — the style brief, sourced from words.",
    approach: [
      "Reuse Bench S: from the text brief produce a style brief + a synthetic source image, then hand into V2/V3.",
      "Or feed the brief straight into a mega-analysis-style prompt that emits style + per-icon prompts directly.",
      "A/B those two paths — a good first customer of the eval harness (#1).",
    ],
    effort: "M",
    depends: "Bench S (built); benefits from #1",
  },
  {
    n: 3,
    status: "deferred",
    title: "URL → screenshot capture (Bench S mode 2)",
    what: "Paste a website URL; capture a screenshot server-side and feed it into Bench S. The UI is already stubbed (deferred) on /bench-s.",
    why: "'Paste your URL' beats 'go screenshot it yourself.' Cost is negligible (~$0.003/shot vs a ~$0.15 elevation) — the real cost is owning a capture dependency.",
    approach: [
      "Decision needed — Screenshot API (ScreenshotOne/Urlbox: no infra, ~cents/shot, needs key — recommended) vs Playwright headless (free/shot, heavy serverless dep).",
      "Wire the chosen capture into the deferred URL field on /bench-s; the rest of the flow is unchanged.",
    ],
    effort: "S–M",
    depends: "provider/key choice (the open decision)",
  },
];

const ALSO: { status: Status; text: string }[] = [
  { status: "queued", text: "Per-icon refine loop — regenerate one (family locked), best-of-N, prompt nudge, favorite/reject. The bench is generate-only today." },
  { status: "queued", text: "Export depth — SVG vectorization (raster→vector), size/padding presets, sprite sheets, style-token JSON." },
  { status: "queued", text: "Brand kits / style memory — save a style brief as a reusable brand, apply to future requests." },
  { status: "deferred", text: "Draft → final — cheap low-q preview pass, high-q only on keepers." },
  { status: "deferred", text: "Side-by-side V1/V2/V3 on one source, scored (first user of the eval harness)." },
];

function Badge({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`rounded-md px-2 py-0.5 text-xs ring-1 ${s.tone}`}>{s.label}</span>;
}

export default function BacklogPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold">Backlog</h1>
            <p className="max-w-2xl text-base text-zinc-400">
              The <em>what to build</em> queue — decided, not yet built. The{" "}
              <Link href="/roadmap" className="text-cyan-400/80 hover:text-cyan-300">strategy / why</Link>{" "}
              lives on the roadmap; this is the actionable to-do (also in{" "}
              <span className="font-mono text-zinc-300">docs/BACKLOG.md</span>).
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {ITEMS.map((it) => (
              <div key={it.n} className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 font-mono text-sm text-zinc-300">{it.n}</span>
                  <h2 className="text-lg font-semibold text-zinc-100">{it.title}</h2>
                  <Badge status={it.status} />
                </div>
                <p className="text-sm text-zinc-300">{it.what}</p>
                <p className="text-sm text-zinc-400">
                  <span className="text-xs uppercase tracking-wide text-zinc-500">Why · </span>
                  {it.why}
                </p>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500">Approach</span>
                  <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-zinc-300">
                    {it.approach.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
                <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                  <span>effort: <span className="text-zinc-300">{it.effort}</span></span>
                  <span>depends on: <span className="text-zinc-300">{it.depends}</span></span>
                </div>
              </div>
            ))}
          </div>

          <section className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold">Also queued — mastering assets</h2>
            <p className="text-sm text-zinc-400">Short specs on <Link href="/roadmap" className="text-cyan-400/80 hover:text-cyan-300">/roadmap §product</Link>; listed so the queue is complete.</p>
            <ul className="flex flex-col gap-2">
              {ALSO.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                  <Badge status={a.status} />
                  <span>{a.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-zinc-600">Foundational backend = Roadmap #1–#7 (persistence → auth → queue → zip → ledger → retention → model migration).</p>
          </section>
        </div>
      </main>
    </>
  );
}
