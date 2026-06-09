# Asset Arsenal — Architecture, Cost & Roadmap

The bench works: we can take a source image and produce a consistent icon set
three different ways. This doc is the scaffolding for turning that into a
product — the pipeline shapes we're comparing, the cost model, the storage
decision, the backend to-do, and where the product should go next.

> The live version of §1–§4 is the in-app **/roadmap** page (numbers there are
> computed from the real pricing table). This doc is the durable, shareable copy
> and adds the **product direction** (§5), which the page doesn't cover.

---

## 1. Pipeline shapes

Three ways to run the same job, sharing prompts and models. The open question
across all three: **does the collection image earn its cost?** Costs are model
spend for a 16-icon set on the cheapest stack.

| | Route | How it works | Theory | Trade-off | ~Cost / 16 |
|---|---|---|---|---|---|
| **V1** | `/bench` | analyze → collection prompt → collection image → per-icon prompts → generate ×N | A normalized collection image (icons isolated, dashboard noise stripped) is a better style anchor than the raw source | Most steps/calls, highest cost; two extra calls before any icon exists | **$0.228** |
| **V2** | `/bench-v2` | ONE vision pass = manifest + shared style + a prompt per icon, then generate each icon against the **source image**; fan-out 3 at a time | The model already sees the pixels in the analyze pass, so it can write every per-icon prompt then — more grounded than re-reading a regenerated image. The collection image may not earn its cost | The source is a busy reference; layout noise can leak in (mitigated by a wrapper that takes only style, ignores layout) | **$0.181** |
| **V3** | `/bench-v3` | Same analyze front, then ALL icons in ONE 4×4 grid image, sliced locally | Per-icon image calls dominate cost; one grid + free local slicing is far cheaper | 16 icons share one 1024² canvas → lower per-icon resolution; slicing edge-cases reconciled against the known icon count | **$0.016** |

**V3 collapses V2's 16 image calls into 1** — 16× cheaper on the image line,
~11× cheaper on the full run once the fixed analyze pass is counted. That gap is
the margin lever if we productize.

**Slicing (V3), both local & free** — the choice is reliability, not cost:
- **CV (default):** threshold the alpha channel → dilate to rejoin an icon's
  split strokes → connected-components labeling → crop each blob. Tolerant of
  grid drift. (`lib/icon/slice-grid.ts`, `sharp` + plain-JS components.)
- **Math:** cut a fixed rows×cols grid by arithmetic. Chops icons when the
  model's grid drifts — kept only as a comparison toggle.

---

## 2. Cost model — two layers

Keep these separate or pricing turns into guesswork.

### 2a. Variable — model spend per run (COGS)

| Call | V1 | V2 | V3 |
|---|---|---|---|
| Analyze / mega-analyze (vision) | $0.0047 | $0.0047 | $0.0047 |
| Compose collection prompt (text) | $0.0009 | — | — |
| Collection image (1 image) | $0.036 | — | — |
| Per-icon prompts (vision) | $0.010 | folded in | folded in |
| Icon images (16) | $0.176 | $0.176 | $0.011 (1 grid) |
| **Total / 16-icon run** | **$0.228** | **$0.181** | **$0.016** |

Image calls dominate; text/vision is a rounding error. Numbers track the
`/models` calculator.

### 2b. Infrastructure — cost of being a product

| Layer | What drives it | Choice | Rough |
|---|---|---|---|
| Object storage (assets) | GB stored + bandwidth | **Cloudflare R2 (chosen)** | ~$0.015/GB-mo · $0 egress |
| Database (metadata) | rows: runs, icons, usage, users — never blobs | **Turso (libSQL/SQLite, edge)** | generous free tier |
| Compute — generation | long awaits on OpenAI (seconds × N); watch fn timeouts | background queue, not request-thread | queue free tiers |
| Compute — slicing (V3) | `sharp` native binary; few ms CPU, bundle weight on serverless | Vercel fn now → worker if it bloats | negligible |
| Auth | per-user libraries + billing identity | TBD — Turso bundles no auth (Better Auth / Clerk / Lucia) | free tiers |

**Unit economics:** `price = COGS + infra + margin`. Making COGS legible (2a) is
what makes pricing a decision instead of a guess.

---

## 3. Asset storage & delivery

**Decision: Cloudflare R2 + Turso** (chosen). R2 = S3-compatible object storage
with zero egress fees for the assets; Turso = libSQL/SQLite at the edge for
metadata. The model:

- **Store individual assets in R2; metadata in Turso.** Never put image bytes in
  the database — Turso holds pointers (R2 object key / URL), names, prompts,
  model, cost, timestamps, user_id.
- **Host for a retention window** so users can browse/preview (longer for paid
  tiers), then expire.
- **Zip on download** — build the archive on request from the hosted assets and
  stream it. Don't persist zips; they're derived and go stale.

**Trade-off vs Cloudinary:** R2 has no managed transforms/optimization/DAM, so
any image processing (resize, format) is on us (or a CDN/worker layer) — in
exchange for much cheaper, predictable storage and zero egress. **Note:** Turso
(unlike Supabase) bundles no auth, so auth is a separate choice (Better Auth /
Clerk / Lucia). Metadata-in-Turso + zip-on-download are stable regardless.

> Today everything lives in browser IndexedDB (per-device, ephemeral). That's
> the gap roadmap #1 closes.

---

## 4. Backend roadmap (by dependency)

1. **Persistence → server (Turso + R2).** Foundation for everything: runs/icons/
   usage as rows in Turso, assets in Cloudflare R2, joined by keys. *Depends on:
   nothing — start here.*
2. **Auth + per-user libraries.** Scope assets/history/billing to a user. *#1.*
3. **Async generation queue + progress.** V2's N calls (and V3 grids) are slow and
   blow past serverless request limits; move to a job, stream progress, retry
   partial failures. *#1.*
4. **Zip-on-download export endpoint.** Bundle a run's assets on request, stream
   it. *#1.*
5. **Server-side usage/cost ledger + per-user quotas.** The local usage log
   becomes a real per-user spend record; add spend caps + icon quotas. *#1, #2.*
6. **Asset retention policy.** Host assets for a window, then expire. *#1, #4.*
7. **Image-model migration plan.** `gpt-image-1-mini` (steps 3 & 5) shuts down
   2026-12-01 and the only current model lacks transparent backgrounds. Real
   dependency with a deadline. *Tracked on /models.*

---

## 5. Product direction

### Master assets first — and mean it

Widening before the core is great is the classic trap (breadth as a magnet for
unfinished depth). The asset loop is **not** done just because it produces icons.
"Mastered" means:

- **Consistency** — the whole value is a *coherent family*. Add a visual
  consistency check across a set, regenerate-one with the family locked,
  best-of-N per icon, and a **style-lock** so new icons added later match.
- **Iteration loop** — regenerate a single icon, nudge its prompt, request
  variants, favorite/reject. This is where the experiments thumbs-up/down feeds
  in. The bench is currently generate-only; it needs *refine*.
- **Export depth** — PNG today. Real asset value: multiple sizes + padding
  presets, true transparency, **SVG vectorization** (raster → vector via
  potrace/vectorizer — icon people want vectors), sprite sheets, and a
  downloadable **style-token / design JSON**. Export is what turns "some images"
  into "an asset *system*."
- **Coverage** — not just extract what's visible; detect what icons a product
  *needs* and is missing, and propose the set.

### The right expansion: own the *input*, not the page

Restating the vision as a value/defensibility ladder:

| Rung | What | Verdict |
|---|---|---|
| 0 (today) | Extract assets from a screenshot | shipping |
| **1** | **Own the input** — turn a website / brand / one-line brief into a clean **style context + source** to generate from (needs a stronger model) | **Do it — it *strengthens* assets** |
| **2** | Generate the **complete asset system** — the full set a product needs, + tokens / SVG / sprites | **Do it — this is "mastered"** |
| 3 | Reimagine the page as a concept (art-direction image) | Hold — different product (v0 / Galileo territory) |
| 4 | Emit HTML → feed an LLM → build the site | Hold / maybe-never — saturated (v0 / Bolt / Lovable); not our edge |

**Recommendation: own the asset *system* end-to-end (input → style → full set →
export) before you own the page.** Rungs 1–2 are still "assets," and they're the
moat: a *consistent design-asset system from minimal input* in an underserved
niche. Rungs 3–4 are a different company in a crowded one — flashy, but you'd be
late with no edge. "Be the source creation" (the user's phrase) = rung 1, and
it's the natural next step *because* it feeds better icons, not despite it.

### Outside-the-box bench ideas

- **Text-only brief → asset set** (no screenshot): broadens the funnel; the
  rung-1 input layer makes this fall out naturally.
- **Brand kits / style memory**: save a style as a reusable brand and apply it
  to future requests — sticky and product-shaped.
- **Regression/eval harness**: a golden set of sources + expected outputs so a
  prompt change can be A/B'd. Turns `/experiments` into a real eval loop and
  produces the *data* to know what actually works.
- **Side-by-side V1/V2/V3** on the same source, scored — settle "does the
  collection image earn its cost?" with evidence.
- **Draft → final**: cheap low-quality preview pass, then high-quality on the
  ones you keep — cuts spend and latency on iteration.
