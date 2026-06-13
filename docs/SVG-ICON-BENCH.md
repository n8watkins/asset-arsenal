# SVG Icon Bench — the deterministic lane

The plan for a second asset lane that sits beside the AI pipeline (V1/V2/V3).
Where the AI lane **generates pixels**, this lane **fetches a real vector icon
and restyles it** — recolor, stroke, glow, badge, background — all as CSS, then
rasterizes to PNG only at export. No per-icon model spend. Instant. Repeatable.

> **One sentence:** fetch an existing SVG → restyle it with CSS → preview it live
> in HTML → save the SVG → rasterize to PNG on download.

This doc is the durable plan. The strategy framing (why two lanes) lives in
[`ROADMAP.md` §5](./ROADMAP.md); the build queue lives in [`BACKLOG.md`](./BACKLOG.md).

---

## 1. Why this lane exists

The AI lane is the right tool for the icon **that doesn't exist** — the weird
hybrid mark, the custom emote, the hero object. But it's the wrong tool for the
icon that already exists in a library, which is the large majority of real
requests: crosshair, rocket, settings, chart, message, satellite. For those,
generating pixels is slower, costlier, and *less* reliable than fetching the real
vector and restyling it.

| | **AI lane** (V1/V2/V3) | **SVG lane** (this doc) |
|---|---|---|
| Source | model generates pixels | fetch real vector (Iconify) |
| Per-icon cost | $0.011 – $0.176 (image calls) | **~$0** (open icon data) |
| Latency | seconds × N | instant |
| Output | raster PNG | true SVG + PNG |
| Editable | no (raster) | yes (vector, recolorable) |
| Best for | icons that *don't exist* | icons that *do* exist |
| AI involved | the whole chain | **one optional nano call** (intent → search terms) |

The lanes are complementary, not competing. The product routes between them:
**try the deterministic lane first; fall through to AI when there's no good match
or the user explicitly wants something custom.** (`app/bench-router/` is the
natural home for that decision — see §7.)

---

## 2. The flow

```
prompt / intent
  ↓  /api/svg/search-terms        [gpt-5.4-nano, text — OPTIONAL, the only AI in the lane]
searchTerms[]
  ↓  /api/svg/search              (Iconify search → candidate icon IDs across sets)
candidates[]  (prefix:name + preview)
  ↓  user picks into the pack
  ↓  /api/svg/fetch               (fetch raw SVG body + viewBox + license; cache it)
cachedIcons[]  { body, viewBox, colorMode, license }
  ↓  restyle in the browser       (HTML/CSS: color, stroke, glow, badge, bg — live, free)
styledPack  ← the preview IS the export source
  ↓  /api/svg/rasterize           (styled SVG → PNG via sharp, multi-size — export only)
export: { /svg, /png, recipe.json }
```

Two ideas carry the whole design:

1. **HTML/CSS is the preview *and* the export source.** The styled markup the
   user sees in the browser is the same markup we rasterize. One source of truth,
   no drift between "preview" and "what you download."
2. **Restyle is deterministic.** Every style operation is plain CSS / SVG
   attribute manipulation — zero model calls (see §4).

---

## 3. Fetching & caching (Iconify)

### Local-first, API for discovery — it's tiered, not either/or

We do **not** bundle all of Iconify (200k+ icons across 150+ sets — far too
heavy). Iconify publishes **each set as its own npm package** — a single JSON
file holding every icon in that set as raw path data + viewBox + license. We
install the **handful of popular sets** that cover the common ~80%: `lucide`,
`tabler`, `ph` (Phosphor), `mdi`, `bi` (Bootstrap). `@iconify/utils` turns that
JSON into an `<svg>` string (`iconToSVG`, `getIconData`, `replaceIDs`).

The split — which layer serves which operation:

| Operation | Bundled set | Not bundled (long tail) |
|---|---|---|
| **Fetch a vector** | local JSON — **zero network** | Iconify API |
| **Search / discover** | match against the set's own name+alias list, locally | Iconify API |

- **Fetching a bundled icon is 100% local** — no network, no rate limit, license
  bundled. That's the "default is local" claim, and it's the common path.
- **Search/discovery is where the API earns its place.** "Find every crosshair-ish
  icon across *all* of Iconify" is a cross-set query over an index that lives on
  Iconify's servers. We can search *within bundled sets* locally (iterate their
  names/aliases), but discovering icons in sets we didn't bundle needs the API.

So: **bundled sets serve fully offline; the API is the discovery layer + long
tail, not the serving layer.** And whatever the API fetches drops into the lazy
cache (below), so the network footprint only shrinks over time.

Iconify API endpoints (discovery + long tail only):

```
Search:    GET https://api.iconify.design/search?query={q}&limit={n}
           → { icons: ["lucide:crosshair", ...], ... }
Icon data: GET https://api.iconify.design/{prefix}.json?icons={a},{b}
           → { prefix, icons: { name: { body, width, height } }, ... }
License:   GET https://api.iconify.design/collections   (per-set license/attribution)
```

> Always fetch **icon data** (`.json`, raw `body`) over the rendered `.svg`
> endpoint. We want the raw paths so *we* control color/stroke/gradient/size, not
> the server.

### Lazy cache — grow around demand

Do **not** pre-cache all of Iconify (200k+ icons). Fetch what's requested, store
it, and the cache compounds — every request makes the next cheaper and more
likely to hit with zero network. SVGs are tiny (~2–20 KB); storage is a rounding
error (~10 KB avg → 100k icons ≈ 1 GB).

**Phase 1 (bench):** cache in IndexedDB, mirroring how `/gallery` already stores
assets. **Phase 2 (product):** server cache = raw SVG in R2, metadata in Turso —
the same R2+Turso decision the AI lane already made (ROADMAP §3, #1).

Cache record per icon:

```ts
{
  id: "lucide:crosshair",        // prefix:name — the cache key
  provider: "iconify",
  prefix: "lucide",
  name: "crosshair",
  body: "<path d=...>",           // raw inner SVG, currentColor-based
  viewBox: "0 0 24 24",
  colorMode: "monochrome",        // monochrome = fully restyleable | multicolor = limited
  license: { title: "ISC", url: "...", attribution: false },
  tags: ["target", "aim", "reticle"],
  source: "https://api.iconify.design/lucide.json?icons=crosshair",
  cachedAt: 1718200000000,
}
```

`colorMode` is the **determining factor** for clean restyling (see §4): icons
that draw with `currentColor` (most outline sets — Lucide, Tabler, Phosphor) are
fully recolorable; multicolor/filled sets (emoji, some Material) are flagged so
the UI can warn that recolor is partial.

---

## 4. Restyle — all deterministic, all CSS

No model calls. Each control maps to a plain transform on the SVG markup:

| Control | Implementation |
|---|---|
| **Color** | flat: set CSS `color` (icons use `currentColor`) or swap `fill`/`stroke` |
| **Gradient** | inject a `<defs>` gradient, point the icon's paint at `url(#id)` (see below) |
| **Secondary color** | target a second path / `currentColor` layer where present |
| **Stroke width** | override `stroke-width` (outline sets) |
| **Glow** | `filter: drop-shadow(0 0 {blur}px {color})`, stackable for intensity |
| **Badge** | wrap in a `<div>`/`<rect>` shape (circle / rounded / hex) with bg + padding |
| **Background** | transparent (default) / solid / gradient on the wrapper |
| **Size** | scale the `viewBox` / set width+height at rasterize time |

#### Gradients (still deterministic — no AI)

Color is a `solid | gradient` union, not just a hex. A gradient is native SVG:
inject a `<defs>` with a `<linearGradient>`/`<radialGradient>` and point the
icon's paint at it instead of `currentColor`:

```svg
<defs>
  <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%"   stop-color="#67e8f9"/>
    <stop offset="100%" stop-color="#a78bfa"/>
  </linearGradient>
</defs>
<path d="..." stroke="url(#g1)"/>   <!-- or fill="url(#g1)" -->
```

Two gotchas, both already solved:

- **Stroke vs fill.** Outline sets (Lucide, Tabler) paint with `stroke`; filled
  sets with `fill`. The gradient attaches to whichever the icon uses —
  `colorMode`/draw-mode detection (§3) tells us which. (Gradient-on-*stroke* of an
  outline icon looks great for the space/HUD vibe.)
- **ID collisions.** A pack rendered in one HTML page with every icon using
  `id="g1"` clashes and renders wrong. `@iconify/utils`' **`replaceIDs`** rewrites
  each icon's internal IDs to be unique — built for exactly this.

Rasterizing is free: `sharp` renders SVG gradients natively, so gradient → PNG
just works at export with no extra code.

The recipe — the tiny, portable, regenerable description of a pack:

```ts
{
  assetArsenalVersion: "0.1",
  lane: "svg",
  originalRequest: "space HUD crosshair icons",
  icons: [
    { provider: "iconify", prefix: "lucide", name: "crosshair", colorMode: "monochrome" },
    { provider: "iconify", prefix: "ph",     name: "rocket",    colorMode: "monochrome" },
  ],
  style: {
    // color is a union: flat OR gradient
    color: { type: "solid", value: "#67e8f9" },
    // …or: { type: "gradient", kind: "linear", angle: 45,
    //        stops: [{ offset: 0, color: "#67e8f9" }, { offset: 1, color: "#a78bfa" }] }
    secondaryColor: null,
    strokeWidth: 2,
    glow: { color: "#67e8f9", blur: 8 },
    badge: { shape: "rounded-hex", bg: "#0b1220", padding: 12 },
    background: "transparent",
  },
  export: { sizes: [256, 512, 1024], formats: ["svg", "png"] },
}
```

Every export ships a `recipe.json` so a pack is portable — even if the
server-side copy expires, the user can re-import the recipe and rebuild the pack
from cache.

---

## 5. Export

PNG is rasterized **on download only** (never stored speculatively). `sharp` is
already a dependency and renders SVG → PNG natively; the styled SVG (with glow
flattened) goes in at each requested size.

```
asset-arsenal-svg-pack.zip
  /svg
    crosshair.svg          ← restyled vector (color/stroke baked or via currentColor)
    rocket.svg
  /png
    crosshair-512.png      ← rasterized at each size, transparent bg
    rocket-512.png
  recipe.json              ← the regenerable description (§4)
  licenses.json            ← per-icon attribution from the cache record
```

`licenses.json` matters: Iconify sets carry licenses (mostly permissive — MIT,
ISC, Apache, CC-BY). Store the license on the cache record at fetch time and emit
it in every pack. This is cheap insurance and the right thing.

Zip-on-download (don't persist zips) reuses the AI lane's export decision
(ROADMAP #4) — when that endpoint exists, both lanes share it.

---

## 6. Where the code goes (mirrors `lib/icon/` + `app/api/icons/`)

```
lib/svg/
  iconify.ts          # Iconify client: search, fetch icon-data, license (+ local @iconify-json fallback)
  restyle.ts          # deterministic SVG → styled SVG/HTML (currentColor, stroke, glow, badge, bg)
  rasterize.ts        # styled SVG → PNG via sharp, multi-size
  cache.ts            # IndexedDB lazy cache (raw SVG + metadata); R2+Turso later
  recipe.ts           # recipe schema import/export + regenerate-from-recipe
  schemas/
    search-terms.schema.ts
    recipe.schema.ts

app/api/svg/
  search-terms/route.ts   # [gpt-5.4-nano] intent → search terms (optional; skippable)
  search/route.ts         # proxy Iconify search → candidates
  fetch/route.ts          # fetch + cache raw SVGs by id → { body, viewBox, colorMode, license }
  rasterize/route.ts      # styled SVG → PNG (sharp); export only

app/svg-bench/
  page.tsx                # the workbench surface (§7)

components/svg-bench/
  SearchPanel.tsx         # §2 search + multi-select
  RestyleControls.tsx     # §3 color / stroke / glow / badge / bg
  PackPreview.tsx         # §3 live HTML/CSS preview of the whole pack
  ExportPanel.tsx         # §4 sizes/formats + download
  CacheMeter.tsx          # cache hits vs network fetches (the compounding asset)
```

Reuse, don't fork: lift `IconGrid` / `DebugDrawer` patterns from
`components/icon-pipeline/`, the IndexedDB plumbing from `/gallery`, and the
sectioned-bench layout from `app/bench-v2/page.tsx`.

---

## 7. The bench surface (`/svg-bench`)

Same sectioned-workbench pattern as the AI benches — each step is a rerunnable
breakpoint with "Show JSON" visibility:

- **§1 Intent → search terms.** Type a request; nano returns search terms. Terms
  are editable, and the whole step is **skippable** — power users search Iconify
  directly. (This is the only place AI touches the lane.)
- **§2 Search & pick.** Grid of Iconify candidates; multi-select into the pack.
  Each result shows its set + `colorMode` badge.
- **§3 Restyle (the magic moment).** Live HTML/CSS preview of the *whole pack*
  under one style. Drag a color slider → every icon updates at once. Controls:
  color, secondary, stroke, glow, badge shape, background. This is the "oh damn,
  it all matches" moment — and it's free.
- **§4 Export.** Pick sizes/formats → rasterize → download zip (svg + png +
  recipe + licenses).
- **Cache meter.** Shows hits vs fetches so the compounding-asset effect is
  visible.

### Routing (`/bench-router`)

The existing router stub becomes the front door: a request tries the SVG lane
first (search → candidates). If there are strong matches, stay deterministic and
free. If matches are weak, *or* the user clicks "make a custom one instead," hand
off to the AI lane (V2/V3). The user never has to classify their own request —
the cheap path tries first and falls through. The determining signal is simply
"did we find a real icon that's close enough?", with a manual override.

---

## 8. Build order

Smallest shippable slice first — a thin vertical that proves the magic moment
(live restyle of a fetched set) before any AI or server work:

1. **`lib/svg/iconify.ts` + `cache.ts`** — fetch icon-data for a hardcoded list,
   cache in IndexedDB. *(no UI yet — the deterministic foundation)*
2. **`lib/svg/restyle.ts` + `PackPreview`** — render fetched icons in HTML, apply
   one CSS style across the set. *This is the proof: does live restyle feel like
   magic?*
3. **`RestyleControls`** — wire color/stroke/glow/badge/bg to the preview.
4. **`/api/svg/search` + `SearchPanel`** — real Iconify search → pick into pack.
5. **`lib/svg/rasterize.ts` + `/api/svg/rasterize` + `ExportPanel`** — PNG + zip +
   `recipe.json` + `licenses.json`.
6. **`/api/svg/search-terms`** — bolt the nano intent step onto §1 (optional).
7. **`/bench-router`** — try-SVG-first, fall-through-to-AI.

Steps 1–3 need **zero** API keys, zero server routes, and zero spend — they run
entirely in the browser against cached vector data. That's the de-risking slice:
it answers "is the live-restyle moment worth building the rest?" before you spend
anything.

**Defer:** server cache (R2+Turso — shares ROADMAP #1), multicolor restyle
beyond a simple warning, SVG-path editing, custom-vector generation (that's the
AI lane's job, not this one).

---

## 9. What this lane is *not*

- **Not** custom-vector generation. Cleanly synthesizing novel editable vectors
  is the hard, unreliable problem — it stays in the AI lane as a premium PNG
  output, not a promise of editable vectors.
- **Not** a public CDN. We host packs for a retention window and ship a
  `recipe.json` so users can regenerate; we don't host everyone's files forever.
- **Not** a place the user has to understand SVG vs PNG vs AI. They ask for
  assets; the router picks the lane; the export labels what they got.
