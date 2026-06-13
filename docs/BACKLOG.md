# Asset Arsenal — Implementation Backlog

A concrete, pull-from-me to-do for features that are decided but not built. This
is the *what to build* queue; the *why / strategy* lives in
[`ROADMAP.md`](./ROADMAP.md). Mirrored in-app at **/backlog**.

Status legend: 🟢 next · 🟡 queued · ⚪ deferred (waiting on a decision)

---

## 🟢 1. SVG Icon Bench (the deterministic lane)

**What:** A second asset lane beside the AI pipeline — Iconify search → fetch a
real vector → restyle it as CSS (color, stroke, glow, badge, background) → live
HTML preview → export SVG + PNG + recipe. ~$0 per icon, instant, editable-vector
output. Full plan: [`SVG-ICON-BENCH.md`](./SVG-ICON-BENCH.md).

**Why:** Most real requests are for icons that *already exist*. Generating those
with an image model is slower, costlier ($0.016–$0.228/set), and less reliable
than fetching the real vector and restyling it (~$0). Every request this lane
absorbs is pure margin, and the output is a true SVG, not a raster. It's the
right default; the AI lane becomes the premium fall-through for the custom stuff.

**Approach (build order from the plan §8):**
- `lib/svg/iconify.ts` + `cache.ts` — fetch icon-data for a seed list, cache in
  IndexedDB (lazy; grow around demand). Local `@iconify-json/*` packages as the
  offline default; the API for discovery + long tail.
- `lib/svg/restyle.ts` + `PackPreview` — render fetched icons in HTML, apply one
  CSS style across the whole set. **This is the proof slice** — does live restyle
  feel like magic? Needs zero keys, zero routes, zero spend.
- `RestyleControls` → wire color/stroke/glow/badge/bg to the preview.
- `/api/svg/search` + `SearchPanel` → real Iconify search → pick into pack.
- `lib/svg/rasterize.ts` (sharp) + `/api/svg/rasterize` + `ExportPanel` → PNG +
  zip + `recipe.json` + `licenses.json`.
- `/api/svg/search-terms` [nano] → optional intent step.
- `/bench-router` → try-SVG-first, fall-through-to-AI.

**Effort:** M. **Depends on:** nothing for steps 1–3 (browser-only). Shares
ROADMAP #1 (R2+Turso) for the server cache and #4 (zip-on-download) later.

---

## 🟢 2. Regression / eval harness

**What:** A golden set of source images with expected/known-good outputs, run
through V1/V2/V3 on demand, scored, and tracked over time.

**Why:** Right now we judge prompt and pipeline changes by eyeballing. An eval
loop produces the *data* to actually answer "does the collection image earn its
cost?", "does V2 beat V1?", and "did this prompt edit help or hurt?" — instead of
vibes. It turns `/experiments` from a catalog into a measurement tool.

**Approach:**
- A small fixtures set: ~5–10 representative sources committed to the repo.
- A "run eval" action that executes a chosen pipeline + variant across all
  fixtures and records: cost, latency, icon count, success rate, and the outputs.
- Scoring: start with the thumbs up/down already planned for `/experiments`;
  add a cheap automatic signal later (e.g., a vision model rating family
  consistency, or alpha-coverage / blob-count sanity for V3).
- Store runs so two prompt versions can be compared side by side.

**Effort:** M–L. **Depends on:** server persistence (ROADMAP #1) to store results
durably; can prototype against IndexedDB first.

---

## 🟡 2. Text-only brief → asset set

**What:** Generate a style + a full icon set from a **text brief** alone — no
screenshot required (e.g., "fintech dashboard, calm, rounded, deep navy + mint").

**Why:** Widens the funnel from "people who already have a UI to screenshot" to
"anyone with an idea." Natural extension of Bench S — the same style-brief
concept, sourced from words instead of pixels.

**Approach:**
- Reuse Bench S: instead of analyzing an image, take the text brief and produce
  (a) a style brief and (b) a synthetic source image to anchor the family
  (image generation from the brief), then hand that into V2/V3.
- Or skip the synthetic source and feed the brief straight into a
  mega-analysis-style prompt that emits the style + per-icon prompts directly.
- Worth A/B-ing those two paths (good first customer of the eval harness, #1).

**Effort:** M. **Depends on:** Bench S source-generation (built); benefits from #1.

---

## ⚪ 3. URL → screenshot capture (Bench S input mode 2)

**What:** Paste a website URL; we capture a screenshot server-side and feed it
into Bench S as the source. The UI is already stubbed (deferred) on `/bench-s`.

**Why:** "Paste your URL" is a big funnel win over "go take a screenshot
yourself." Cost is negligible (~$0.003/shot vs a ~$0.15 elevation) — the only
real cost is owning a capture dependency.

**Approach (decision needed):**
- **Screenshot API** (ScreenshotOne / Urlbox / etc.): no infra, ~cents per shot,
  needs an API key. Fastest; clean per-shot cost. *Recommended for the bench.*
- **Playwright headless:** free per shot, but a heavy serverless dependency
  (chromium bundling). Better at scale, slower to stand up.
- Wire the chosen capture into the deferred URL field on `/bench-s`, then the
  rest of the flow is unchanged.

**Effort:** S–M. **Depends on:** provider/key choice (the open decision).

---

## Also queued (from ROADMAP §5 — "mastering assets")

Short specs live in the roadmap; pulled here so the queue is complete:

- 🟡 **Per-icon refine loop** — regenerate one icon (family locked), best-of-N,
  prompt nudge, favorite/reject. The bench is generate-only today.
- 🟡 **Export depth** — SVG vectorization (raster→vector), size/padding presets,
  sprite sheets, downloadable style-token JSON.
- 🟡 **Brand kits / style memory** — save a style brief as a reusable brand and
  apply it to future requests.
- ⚪ **Draft → final** — cheap low-q preview pass, high-q only on keepers.
- ⚪ **Side-by-side V1/V2/V3** on one source, scored (first user of the eval harness).

And the foundational backend work is ROADMAP #1–#7 (server persistence → auth →
async queue → zip export → usage ledger/quotas → retention → image-model
migration).
