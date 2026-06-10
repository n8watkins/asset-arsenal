# Deep-Dive Code Review — 2026-06-10

> **Status (same day):** All findings in Parts 1–2 are FIXED (commits
> `9987246`, `c3ede72`, `92b69be`), except the two deferred-by-design items:
> the fable data-URL→Blob storage migration and the chat/project split (Part 1
> §10). Gemini findings were resolved by archiving the surface (copy-only).
> Part 3 consolidation: items 1–2 (registry, unified ledger write-path) are
> done; 3–7 (lib/llm helpers, storage convergence, prompt fragments, type
> atoms, micro-dupes) remain open. Router/gemini-chat stay out of the ledger
> (router by design, gemini archived).

Full review of all benches, their integrations, and shared infrastructure.
Ground rules honored: the experimental benches (`/bench`, `/bench-s`,
`/bench-v2`, `/bench-router`, `/experiments`, `/gemini`) keep all their
functionality — findings there are bugs/efficiency only. Fable (`/fable`) can
change dramatically; its carry-forward feature contract lives in
[`FINAL-PRODUCT-FEATURES.md`](./FINAL-PRODUCT-FEATURES.md).

Severity: 🔴 high · 🟠 medium · 🟡 low

---

## Part 1 — Fable Bench

### Owner-reported issues, root-caused

1. **Usage ledger disconnected from global `/usage` history — confirmed, deliberate.**
   `lib/fable/client-api.ts:5-6` opts out by design; only `lib/icon/client-api.ts`'s
   `tracked()` writes `logUsage()`. Fable records live inside the project blob in a
   *separate IndexedDB database* (`fable-bench`, `lib/fable/store.ts:45`); the global
   ledger lives in the `asset-arsenal` DB. Shape gap: fable has 8 step keys vs the
   global 5-value `StepKey`, est-cost-only vs est+realized, plus provider/duration
   fields the global entry lacks. **Fix is ~30 lines**: fire-and-forget `logUsage()`
   from `appendUsage` (`lib/fable/use-fable.ts:203-209`); widen `UsageEntry.step` to
   `string`. `/usage` already tolerates unknown steps (`STEP_LABEL[e.step] ?? e.step`).
2. **No global usage view in Fable — confirmed.** Every surface reads only
   `project.usage`; nothing iterates `listProjects()` to aggregate.
3. **No AI chat titles — confirmed.** Names come only from `freshProject()`
   ("Untitled project", `use-fable.ts:64`) and manual rename. Cheapest fix: add
   `suggestedTitle` to the agent's structured-output schema (zero extra API calls),
   or reuse `style.styleName` after analyze.
4. **Empty chats persisted — confirmed, two paths.** The debounced save effect
   runs on first render with a fresh empty project (`use-fable.ts:168-180`) — just
   visiting `/fable` writes a row; and `newProject()` saves immediately
   (`use-fable.ts:227`). Guard on `events.length > 0 || original`.
5. **Right-click → open in new tab broken after generation — confirmed, two mechanisms.**
   (a) SheetCard's interactive grid overlay (`absolute inset-0`, every cell a
   `role="button"` div) covers the whole image — the context menu targets the
   overlay, not the `<img>` (`SheetCard.tsx:72-83`). (b) All generated images are
   multi-MB base64 **data URLs** (`openai-steps.ts:90,169,248`); Chromium caps
   top-frame data-URL navigation (~2MB) → blank tab. Composer thumbnails use
   object URLs, which is why it "works before generation."
6. **No detail view on click — partially confirmed.** Chat-bubble and source images
   do open the Lightbox; sheets open the regen popover instead (lightbox hidden
   behind a small "enlarge" button); **finals have no click handler at all**
   (`FinalsCard.tsx:96-148`). Lightbox itself lacks zoom, Escape, metadata, download.
7. **Models hardcoded — confirmed, plus a time bomb.** `FABLE_MODELS` is a frozen
   const of string literals (`lib/fable/types.ts:26-31`); no request schema accepts
   a model; the client never even sends `quality` (everything runs at server default
   "medium" while placeholders claim "high"). 🔴 The hardcoded `gpt-image-1-mini` is
   marked **deprecated in the catalog, shutdown 2026-12-01**
   (`lib/icon/model-reference.ts:144-152`) — Fable bypasses the catalog so it will
   never surface that warning.
8. **DevDrawer weaker than `/bench` tooling — confirmed.** Missing vs other benches:
   exact live request/response bodies per step, raw error JSON (`FableError.rawError`
   exists server-side, never serialized to client), model visibility/override,
   per-step manual runs with custom inputs. Ledger keeps only a 300-char
   `promptPreview`; raw Gemini JSON is parsed then discarded.
9. **One-shot agent far too aggressive — confirmed.** `executeDecision`
   (`use-fable.ts:518-590`): one "looks good" → approve + analyze + render ALL
   sheets, no checkpoints; `generate_finals` silently auto-approves every draft
   sheet; a prompt revision supersedes and re-renders every draft sheet. Also
   inconsistent: some buttons call internals directly, others inject synthetic
   English chat messages re-classified by the agent (`SheetCard.tsx:118`,
   `ChatFeed.tsx:182`) — a fragile NL detour for already-structured actions.
   Target architecture (plan-returning router, checkpointed execution, two-tier
   routing reusing `lib/router`'s `needsUserChoice` + preset harness) is in
   FINAL-PRODUCT-FEATURES.md §2.
10. **Chat vs Project.** `FableProject` is one chat; events+usage sit flat next to
    design assets. Clean split exists in the data already: chat = events + usage +
    pendingDecision; project = sources + style + candidates + sheets + finals.
    Needs a `fable-bench` DB v1→v2 migration wrapping each record as
    project+single-chat, a project home UI (Blueprint card is 80% of the style
    guide), and an asset store (data-URL-in-JSON won't scale to a gallery).

### Other Fable bugs

- 🔴 **Cross-chat contamination race.** `mutate` writes to `projectRef.current`
  (`use-fable.ts:183-191`); `openProject`/`newProject` swap the ref without
  cancelling in-flight work and the Sidebar never disables while busy — finish a
  generation after switching chats and the artifacts/usage are written and
  *persisted* into the wrong chat. Fix: capture project id at executor start,
  no-op mutations on mismatch.
- 🟠 `generateFinalsFor([])` never resolves — the pump's `resolve` only fires in
  `runOne(...).finally`; empty queue → `busy` stuck forever (`use-fable.ts:493-511`).
  Reachable via approve-sheet after all its candidates were removed.
- 🟠 Failed-call usage discarded client-side: routes attach `usage` to error
  payloads, but `postJSON` throws and drops it (`lib/fable/client-api.ts:34-40`).
- 🟠 `fable.error` is rendered nowhere; the file-validation early return in
  `sendMessage` only does `setError` → attach a bad file and nothing visibly happens.
- 🟠 Second image attachment silently ignored — only adopted when `!original`
  (`use-fable.ts:727-736`); user thinks they swapped the source; they didn't.
- 🟡 Double-send race (busy gate reads closure state, `use-fable.ts:713`;
  `confirmPending` checks nothing). Use a ref.
- 🟡 Bare Enter in SheetCard's instruction input fires a paid sheet regeneration
  (`SheetCard.tsx:160-166`).
- 🟡 Sidebar staleness: `refreshKey={project.events.length}` misses renames and
  artifact-only mutations.
- 🟡 `listProjects` loads every full project (all embedded data-URL images) just
  to build sidebar summaries (`store.ts:79-105`). Needs a summary index.
- 🟡 Debounced save dropped on unmount <500ms after a text/candidate edit.
- Cosmetic: placeholder quality "high" vs actual "medium"; `new_sheet` op only
  reaches the first 16-candidate chunk; `ChatFeed` memo depends on a
  fresh-every-render object; unused `preview_prompt` step key and
  `FABLE_STAGE_ORDER` export.

---

## Part 2 — Legacy benches (fix, never remove)

### `/bench` (V1)

- 🔴 **§5 sends stale prompts after §4 produces real ones**
  (`app/bench/page.tsx:1109-1115, 1139-1153`). `Section5` seeds `sharedStyle`/
  `promptText` from mount-time state (usually fixtures) and never re-syncs — and
  unlike §2/§3/§4 it has no "↑ pull" button. Paid image call with mismatched
  prompt content. Fix: sync on `state.individualPrompts` change or add the pull
  button.
- 🟠 Raw tab dumps megabytes of base64 into a `<pre>`
  (`components/bench/interpreted.tsx` RawView ~129-149) — the data-URL guard only
  catches bare strings, but sections pass objects with `imageUrl` data URLs.
  Recursively redact.
- 🟡 §6/chain cost estimates price `stack.iconCount` (15), not the actual
  `prompts.iconPrompts.length` (`page.tsx:58-67, 1399-1413`).
- 🟡 "Saved N icons" can lie — `persistBenchIcons` counts attempts whose IDB
  failures were swallowed (`lib/icon/bench-persist.ts:39-63`); re-runs also
  overwrite the run's `iconCount` instead of accumulating.
- 🟡 Section Run buttons stay enabled during a chain cascade — manual runs and
  the chain silently clobber each other's `patch()`es.

### `/bench-v2`

- 🟠 "ran ~$X" displays the estimate, not realized cost — `runAnalyze` ignores
  the returned `usage` and re-prints the estimate (`page.tsx:129-132`). Use
  `realizedTextCostUSD(ANALYZE_MODEL, usage)`.
- 🟡 `useRef(crypto.randomUUID())` generates+discards a UUID every render (line 65).
- 🟡 "Remove image" leaves stale error/cost/saved notes (`clearRef`, lines 113-119).

### `/bench-s`

- 🟡 AI-elevated sources get the "Uploaded" badge in the gallery (saved with
  `category: "source"`; GalleryView maps non-collection → "uploaded",
  `GalleryView.tsx:305-317`). Add an additive `elevated` category. Also ignores
  returned `usage` (estimate-only display, same as V2).

### `/bench-router`

- 🟡 `isFree` hardcodes `"gemini-3.1-flash-lite"` (page.tsx:121) — compare against
  `DEFAULT_JUDGE_MODEL` or a catalog flag.

### `/experiments`

- 🟠 **Experiment runs spend real tokens/images but never hit the usage ledger**
  (`lib/experiments/run-client.ts` — no `logUsage`; `runCell` can run
  `images.edit` at high quality). `/usage` claims "every call from this browser."
  Wrap in the existing `tracked()` pattern.
- 🟡 Switching signature mid-run resurrects stale results — in-flight `runOne`
  promises write into the new signature's slots (`ExperimentRunner.tsx:98-121`).
  Guard with a run token or disable the select while loading.
- 🟡 `lib/icon/experiments.ts` is dormant (zero importers) with a stale header
  claiming the /experiments page renders it. Keep, but fix the comment.

### `/gemini`

- 🟠 **The page instructs users to use UI that doesn't exist.** The drawer
  provider is intentionally parked (not mounted in `app/layout.tsx`), but
  `app/gemini/page.tsx:20-22` and ChatCollection's empty state still say "open
  the drawer (✦ bottom-left) / hit Send to Gemini" — neither exists, so new
  analyses can't be created. Fix the copy (or remount).
- 🟡 Failed send loses the composer — input cleared before the request, no retry.
- 🟡 `onDeleteChat` calls `setActiveId` inside the `setChats` updater and reads
  stale closure state.

### Home `/` + shared components

- 🟠 Per-icon Download triggers **two** downloads — `IconGrid` calls both
  `downloadViaAnchor` and `onDownload`, and the page's handler downloads again
  (`IconGrid.tsx:134-138`, `app/page.tsx:212-214`).
- 🟠 Per-icon "Regenerate" silently regenerates the entire batch
  (`app/page.tsx:205-209`) — N× the expected spend from one click. Relabel or confirm.
- 🟠 GalleryPicker eagerly loads the entire library (all blobs → object URLs)
  per instance at mount — `/bench` mounts three — and never refreshes, so
  session-generated icons don't appear until reload (`GalleryPicker.tsx:30`).
  Fetch on open.
- 🟡 Picker groups collection images under "Uploaded" while GalleryView shows
  them under "AI-generated" (`GalleryPicker.tsx:107-118`).
- 🟡 Source downloads lose their extension (`GalleryView.tsx:130-132` —
  `slugify("shot.png")` → `shot-png`).

### Usage ledger accuracy

- 🟠 Realized image cost overstated on partial batch failure —
  `realizedCost = imageCostUSD(model, quality, count)` uses *requested* count
  (`lib/icon/client-api.ts:94-95`) while batch routes return per-icon failures
  inside a 200. Use the success count (already computed in `summarize`).
- 🟡 `/usage` rollup tables sum `realizedCost ?? estCost` while the headline sums
  `realizedCost ?? 0` (`app/usage/page.tsx:54` vs `83`) — cards can exceed their
  own headline.
- 🟡 Latent quality-fallback mismatch for elevate-source (client logs "high"
  default, server renders "medium" default).

---

## Part 3 — Consolidation (additive; no bench loses anything)

**How many of each thing exist today:** 3 usage-tracking systems (+2 explicit
blind spots: router, gemini chat), 2 IndexedDB databases + 1 localStorage key,
5 model-id definition sites, 2 parallel prompt layers, the same `images.edit`
wrapper copy-pasted **7×**, the same Gemini structured-JSON pattern **5×**,
`splitDataUrl` defined **4×**. The raw SDK clients themselves
(`lib/openai/client.ts`, `lib/gemini/client.ts`) are already shared singletons
— the duplication is one level up, in step scaffolding.

Ranked recommendations:

1. **Single model registry** (high value, low effort). Add Gemini rows + paid
   pricing + a `freeTier` flag to `CATALOG` in `lib/icon/model-reference.ts`;
   re-point `FABLE_MODELS`, `JUDGE_MODELS`, bench-s's `IMAGE_MODELS`, and the
   bench-router free badge at it (`EXPERIMENT_MODELS` already derives correctly
   — follow that pattern). Deprecation warnings (gpt-image-1-mini!) and price
   changes then propagate everywhere from one file.
2. **Unified usage ledger** (high value, low-medium effort). One `LedgerEntry`
   superset with `bench` + `scope {projectId, chatId, runId}` + `provider`,
   written to the existing `usage` store; old rows adapt at read time
   (`bench:"bench"`, `provider:"openai"`). Fable keeps `project.usage` as its
   per-chat view and *additionally* logs from `appendUsage` (one call site);
   experiments/router/gemini-chat log from their client wrappers. `/usage`
   gains a bench filter + per-project rollups. Pricing math is already unified
   via `model-reference.ts` helpers — this is purely a write-path change.
3. **`lib/llm/` call helpers** (high value, medium effort). `editImage(...)`
   and `generateJson(...)` (+ one shared `splitDataUrl`) collapse ~700
   duplicated lines across `fable/openai-steps.ts`, `fable/gemini-steps.ts`,
   `lib/openai/*`, `router/route-request.ts`, `run-cell.ts`. Adopt in fable
   first; old benches incrementally. Natural seam for ledger auto-logging.
4. **Stop the fable storage divergence early** (medium value, low effort).
   Gallery stores Blobs; fable stores data URLs embedded in project JSON (~33%
   larger, every `put` rewrites all images, quota risk, and the migration cost
   compounds with every saved project). Move fable images to Blob fields, or at
   minimum add a fable→gallery export reusing `bench-persist.ts` patterns.
5. **Shared prompt invariants** (medium value, low effort). The standalone-icon
   "output requirements" negative block is duplicated near-verbatim at
   `icon/prompts.ts:206-222`, `:315-328`, `fable/prompts.ts:344-362`; extract
   to `prompt-fragments.ts` and compose. Leave experimental *wording* per-bench
   — that's the point of the benches.
6. **Shared type atoms** (low-medium value). Promote `TokenUsage`, the
   `icon_NNN` id helpers, and the generation status enum to `lib/shared/`.
   Don't merge `IconCandidate`/`ManifestIcon` — they encode different bench
   philosophies.
7. **Micro-dupes opportunistically**: 4× `splitDataUrl`, 3× `toDataUrl`, dual
   zod/Gemini schema declarations (one `zodToGeminiSchema` helper).

**Router evolution:** don't graft Fable onto `lib/router` — Fable's `runAgent`
already *is* the every-interaction router (state-aware, pixel-seeing,
ops-emitting); `lib/router` is the stateless cold-intake tier. Extract a
generic `classifyIntent` core on `generateJson`, keep both decision
vocabularies as configurations of it, port `needsUserChoice` and the
`/bench-router` preset/expectation harness to Fable's intents.

---

## Verified non-issues

Route-handler conventions checked against the bundled Next 16.2.7 docs — fine.
Also confirmed as-designed: §2-§4 pull-button model, `saveIcon` UUID keying,
`useLibrary` object-URL lifecycle, router/gemini-chat ledger opt-outs
(explicitly commented), `runChain` artifact threading, bounded-worker pools in
the batch routes, `structuredClone` on stack select.
