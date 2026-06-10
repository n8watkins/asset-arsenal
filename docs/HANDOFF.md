# HANDOFF — asset-arsenal (updated 2026-06-10)

Zero-context briefing for the next agent. Read this fully, then
[`FABLE-V2-PLAN.md`](./FABLE-V2-PLAN.md) (the implemented plan) before
touching code. Do not re-ask the user anything answered here.

## Project summary

Experimental Next.js app (~20k lines) hosting multiple image→icon-pack
pipeline **benches**: `/bench` (V1), `/bench-s`, `/bench-v2`, `/bench-router`,
`/experiments`, `/gemini` (archived), the home-page pipeline, and **`/fable`**
— the chat-first agentic bench that is the de-facto product candidate and the
only bench under active development. **Standing rule: legacy benches are kept
experiments — never remove functionality from them; fix-only. Fable may change
dramatically.** Owner's product intent: Fable is also the experiment platform —
wild features get wired up behind settings flags and kept or removed later.

Stack: Next.js 16.2.7 (Turbopack, **breaking changes vs training data — read
`node_modules/next/dist/docs/` before Next-specific code**, per AGENTS.md),
React 19, zod 4, `openai` SDK (gpt-image-1-mini default), `@google/genai`
(Gemini 3.1 flash-lite default, free tier), `idb`/IndexedDB. Local-only: `npm
run dev` on :3000, no deployment, no test suite, no eslint config —
**`npx tsc --noEmit` is the verification bar**.

## State (this session's commits, oldest → newest)

All committed on `main`, working tree clean, tsc clean. **Local only — not
pushed** (owner pushes on request; remote is github.com/n8watkins/asset-arsenal).

- `e1bc29d` / `56246ab` — Fable V2 plan from the owner's full critique
  (29 items, 5 workstreams) + settings-flag decisions and OpenAI input-token
  cost research.
- `60a5a08` (A) — image-only sends (router clarifies instead of 400),
  recentMessages router context, bigger composer, chips carry the attached
  image, Lightbox portal fix, honest side-by-side source compare,
  `lib/fable/settings.ts` (downscaleMaxEdge default 1024, sourceCrops default
  on) + client-side upload downscale.
- `75592ff` (E) — `/usage`: Calls|Projects accordion view, bench dropdown
  scoping the whole page, Gemini free-tier RPD meters; Fable UsagePanel
  by-project table + quota section.
- `9fa795f` (C) — `lib/zip.ts` (STORE-only writer, round-trip verified), zip
  Download-all, gallery provenance fields (additive) + project filter
  dropdowns, `ProjectView.tsx`, `gallery-sync.ts`, `store.listRecentImages`.
- `a81bc65` (D) — ModelSettings ⚙ popover (per-role models, settings,
  capabilities outline), DevDrawer Raw I/O tab, Composer plus-menu
  (Upload / From gallery / Recent), Chat|Project header toggle.
- `e9d24dc` (B) — edit_blueprint intent + BlueprintCard Edit mode, dialogue
  with approved/superseded sheets, refine-from-finals, icon buttons,
  iconBackground + transparent sheets + BackdropPicker, **locate_icons source
  crops** (one Gemini call → boxes; canvas crops; crop rides as a 2nd
  reference image to finals — SDK supports image arrays), title dedupe,
  gallery auto-archive everywhere, projectName on ledger, Live prompt+model
  step rows, debug raw I/O capture → 20-entry `rawLog`.
- `90c4268` — dev-mode fixes after owner feedback: model+prompt on EVERY step
  row in dev, raw I/O capture always-on (display stays dev-only), model shown
  in Raw I/O row headers.
- `0bd38d1` — **Blob storage migration**: `lib/fable/images.ts` owns the
  fable-bench DB (v2) with an `images` Blob store; project docs hold opaque
  `idb-image:<uuid>` refs; lazy migration on `loadProject`; resolver seam
  (`useObjectUrl` / `resolveToDataUrl` / `resolveToBlob` / `getDisplayUrl`)
  is the ONLY layer that knows where bytes live.

Verified: tsc clean at every commit; `/fable` serves 200 on the dev server.
**NOT yet verified by a human**: runtime behavior of this session's features
(migration of old projects, crops quality, transparent sheets, zip contents,
quota numbers). A manual smoke checklist is in the final section of the
session notes below ("Smoke test").

## Next steps (ordered)

1. **Owner smoke test** (blocking nothing, but do it before building more):
   open an old project (migrates → check IndexedDB `fable-bench` v2 `images`
   store has rows, project record is small); full generation run with a
   reload mid-finals; zip download; ＋→Recent attach; delete a test project
   (images rows vanish); try source crops + transparent sheet quality.
2. **Gemini free-tier RPD constants** — placeholders 1000/250/100 in
   `lib/icon/model-reference.ts` (named constants, marked TODO). Owner cited
   500 for flash-lite. Ask the owner for the numbers from their quota page or
   have them paste it; just edit the three constants.
3. **Chat-vs-project data-model split** (last big deferred item): Project =
   root entity owning assets (sources/style/sheets/finals/models/settings);
   Conversation = child owning `events` (+ `conversationId` on usage records).
   Keep 1:1 initially; lazy-migrate old records by wrapping events into
   "conversation 1". This pre-shapes the Turso schema. Acceptance: types +
   store split landed, old projects open fine, ProjectView becomes the
   project home, "new chat in project" affordance optional.
4. **Consolidation items 3–7** from `CODE-REVIEW-2026-06-10.md` (shared
   `editImage`/`generateJson` helpers, prompt fragments, type atoms) — code
   health only, optional.
5. **Turso + R2 later** (owner-decided architecture, do NOT re-litigate):
   Turso/libSQL holds rows only — projects, conversations, events, usage,
   image METADATA. Image **bytes go to Cloudflare R2** (S3-compatible; ref
   becomes/maps to an R2 key; resolver swaps to CDN/presigned URLs; the
   IndexedDB image store demotes to local cache). Never store image bytes in
   Turso. Steps 3 above + the shipped ref indirection are the prerequisites.

## Conventions & gotchas (hard-won)

- **Commits**: imperative subject, body bullets, trailer
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Commit after each
  coherent change; push only when asked.
- **Verification** = `npx tsc --noEmit` (no tests/eslint). Dev server:
  `npm run dev` (:3000; another unrelated dev server may sit on :3001 —
  leave it).
- **Legacy benches are read-only behavior-wise**; shared files
  (`lib/storage/*`, `lib/icon/usage-log.ts`, `lib/icon/model-reference.ts`)
  take **additive optional fields only** (IndexedDB is schemaless — follow the
  `category?` precedent, no version bumps/indexes on the asset-arsenal DB).
- **Image refs**: `imageUrl` fields hold either `idb-image:<uuid>` refs or
  legacy data URLs. NEVER send a ref to an API route, the gallery, or a raw
  `<img src>` — resolve via `lib/fable/images.ts`. Candidate `sourceCrop`s
  stay inline (tiny). Blob write FIRST, then doc write ("pixels are
  precious" crash-safety).
- **`position: fixed` traps**: `.fable-card-in`'s animation leaves a
  transform on ancestors → any fixed overlay inside cards must portal to
  `document.body` (Lightbox does).
- **Cross-chat safety**: async executors in `use-fable.ts` capture `pid` and
  write via `mutateFor(pid, fn)`; new code must follow this or chat switches
  contaminate projects.
- **Sub-agent pattern that works**: parallel agents in ONE tree with hard
  file boundaries (lib/fable/** vs components/fable/** vs shared files),
  agents never commit, orchestrator reviews + commits per workstream.
- **OpenAI input images**: server-side downscale to 2048 max edge, billed
  65+129/tile tokens at $10/1M — client downscale saves pennies; it exists
  for payload/storage health (settings, default 1024).
- **Known tradeoffs** (documented in code, owner-accepted): quota meters
  count the local ledger (per-browser); Blueprint Edit saves locally and
  sharedStylePrompt re-syncs on next revise; analyze/revise/agent_route
  prompts surface as ~300-char previews (full prompt is server-side only);
  regenerated finals can leave one duplicate gallery record (belt-and-braces
  archiving).

## File map (for the next steps)

- `docs/FABLE-V2-PLAN.md` — the implemented 29-item plan; execution map.
- `docs/CODE-REVIEW-2026-06-10.md` — original findings; consolidation 3–7 open.
- `docs/FABLE-FEATURES.md` — inventory of Fable-only features.
- `lib/fable/use-fable.ts` — orchestrating hook; all pipeline execution.
- `lib/fable/images.ts` — Blob store + ref resolver (the Turso/R2 seam).
- `lib/fable/store.ts` — project persistence, lazy image migration,
  summaries/usage/recents.
- `lib/fable/types.ts` — FableProject contract, events, ops, intents.
- `lib/fable/settings.ts` — global flags (downscale, sourceCrops).
- `lib/fable/gemini-steps.ts` / `openai-steps.ts` / `prompts.ts` /
  `schemas.ts` — agent + step implementations and route schemas.
- `app/api/fable/*` — 7 routes (incl. `locate-icons`); all accept model
  overrides + `debug`, return usage on failure.
- `app/fable/page.tsx` — shell: header toggles, ModelSettings, views.
- `components/fable/*` — Composer (plus-menu), ChatFeed (step rows),
  DevDrawer (Raw I/O), UsagePanel, ProjectView, Sidebar, ModelSettings,
  cards/* (Blueprint/Sheet/Finals/Source/Backdrop).
- `lib/icon/usage-log.ts` + `app/usage/page.tsx` — global ledger + page
  (bench dropdown, Projects view, quota meters).
- `lib/icon/model-reference.ts` — model catalog; **Gemini RPD TODO constants**.
- `lib/zip.ts`, `lib/fable/gallery-sync.ts`, `lib/storage/repo.ts` — zip
  writer, fable→gallery archiver, gallery storage (additive meta).
