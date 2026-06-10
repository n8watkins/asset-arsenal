# Fable Bench V2 — Implementation Plan

Scope: **Fable only** (`lib/fable/**`, `components/fable/**`, `app/fable/**`,
`app/api/fable/**`) plus the global `/usage` page and **additive-only** touches
to shared gallery storage. The other benches must not change behavior.

Source: owner critique 2026-06-10. Every item below is grounded in the current
code; root causes are noted where found.

---

## Root causes found while grounding this plan

| Symptom | Root cause |
|---|---|
| Image without text → error | `AgentRequestSchema.text: z.string().min(1)` (`lib/fable/schemas.ts:16`) rejects the request with 400 before the agent runs. |
| Clicked image preview capped at chat-column size | `Lightbox` renders `fixed inset-0` but **inside** `.fable-card-in` ancestors whose animation leaves a `transform` applied — a transformed ancestor becomes the containing block for `fixed`, so the lightbox is trapped in the card. (`components/fable/ui.tsx:170`, anim CSS in `app/fable/page.tsx`) |
| Before/after appears for a plain image send | The mid-project image-adoption path pushes the new image into `project.improved` (`use-fable.ts` executeDecision, "B7" block) — `SourceCard` then renders "Improved source" with Before/After tabs even though no improvement ran. |
| Quick-action chip drops the attached image | Chips call `fable.sendMessage(q, null)` directly (`app/fable/page.tsx:207`) — the composer's draft text and attached image are bypassed entirely. |
| Can dialogue with some sheets but not others | The instruction input + actions only render for `sheet.status === "draft"` (`SheetCard.tsx:186`); approved/superseded sheets get nothing. |
| No downscaling of uploads | `fileToDataUrl` (use-fable.ts) validates mime/size only; full-res base64 goes to the routes and straight into `images.edit` (`lib/openai/to-file.ts`). Nothing resizes anywhere. |

---

## Workstream A — Conversation, composer, image handling
**Files:** `components/fable/Composer.tsx`, `components/fable/ChatFeed.tsx`,
`components/fable/ui.tsx` (Lightbox), `components/fable/cards/SourceCard.tsx`,
`app/fable/page.tsx`, `lib/fable/schemas.ts` (agent schema only),
`lib/fable/gemini-steps.ts` (agent prompt only).

1. **Image-only sends.** Relax `AgentRequestSchema.text` to allow `""`. Agent
   prompt: when an image arrives with no text, intent = `clarify` — ask what
   the user wants to do with it. The image is already stored on the project
   (first image → `original`; later images ride the turn), so follow-up turns
   can act on it; make the agent prompt say so explicitly ("an image was
   provided earlier this conversation and is the working source").
2. **Image alone uses chat history as context.** Add the last ~6 user/assistant
   turns to the agent request state summary so a bare image (or terse reply)
   is classified against what was just being discussed, and the router asks a
   question when genuinely ambiguous.
3. **Bigger composer.** Raise textarea caps (hero 220→320px, docked 160→260px),
   bump docked font to `text-base`, start at 2 rows when text is present.
4. **Attachment chip layout.** Filename **below** the thumbnail (stacked
   column), not to the right; larger thumbnail (h-16).
5. **Quick-action chips include composer context.** Extend `ComposerHandle`
   with `sendQuick(chipText)`: merges chip text with the current draft +
   attached image and submits through the normal `onSend`. Page chips call
   that instead of `fable.sendMessage(q, null)`.
6. **Lightbox = whole page.** Render via `createPortal(document.body)` so the
   transformed-ancestor trap can't apply. Click-away on the backdrop already
   closes; keep it. Applies everywhere Lightbox is used (bubbles, sheets,
   finals, source).
7. **SourceCard honesty + side-by-side.** Only show a compare when a real
   `kind === "improved"` version exists (image adoption must not fake one —
   tag adopted versions or filter by `kind`). Replace Before/After **tabs**
   with a **side-by-side** two-up grid (original | improved), each pane
   clickable to the lightbox.
8. **Client-side downscale — as a SETTING.** New `lib/fable/settings.ts`:
   localStorage-backed global Fable settings
   (`{ downscaleMaxEdge: 0 | 1024 | 2048, sourceCrops: boolean }`, defaults
   `1024` / `true`) with a `useFableSettings()` hook. In `fileToDataUrl`,
   when `downscaleMaxEdge > 0` and the longest edge exceeds it, decode via
   `createImageBitmap` and draw to a canvas at that max edge (PNG for
   transparency, JPEG q0.92 otherwise). Show "downscaled from 4032×3024" as
   a chip note. **Cost research (June 2026):** OpenAI already downscales
   inputs server-side (shortest side → 512px, longest capped 2048px) and
   bills 65 + 129/tile tokens at $10/1M — ≈$0.002 for a ≤1024² input vs
   ≈$0.006 max. So the savings are pennies; the real wins are payload size,
   IndexedDB bloat, and upload speed. Settings UI ships in Workstream D;
   until then defaults apply.

## Workstream B — Agent depth: blueprint dialogue, sheets, finals, transparency
**Files:** `lib/fable/use-fable.ts`, `lib/fable/types.ts`,
`lib/fable/gemini-steps.ts`, `lib/fable/prompts.ts`, `lib/fable/schemas.ts`,
`app/api/fable/revise-prompts/route.ts`, `app/api/fable/preview-sheet/route.ts`,
`components/fable/cards/BlueprintCard.tsx`, `SheetCard.tsx`, `FinalsCard.tsx`.
**Sequencing: starts after Workstream A lands (both touch gemini-steps/schemas).**

9. **Blueprint is a conversation, not a gate.** After analyze, don't
   immediately push "generate previews?" — the assistant reply invites edits
   ("want to tweak the palette, icons, or name before we render?"). New intent
   `edit_blueprint` with ops that patch `FableStyle` fields (palette, mood,
   lineStyle, background, negativeRules, styleName) + regenerate
   `sharedStylePrompt` via the revise route. Preview rendering happens when
   the user asks (chip or message), still cost-confirmed.
10. **Blueprint editing UI.** Current inline rename/remove of candidates stays;
    add an explicit ✎ Edit toggle that makes style fields editable (palette
    chips add/remove, text fields). No silent free-editing — fields are
    read-only until the button is pressed (owner request).
11. **Dialogue with every sheet.** Show the instruction input + per-icon
    popover on `approved` sheets too (instruction → regenerate as new draft
    variant); superseded sheets get one action: "Branch from this version".
12. **Refine icons from finals.** FinalsCard cells get the same popover as
    sheet cells: Regenerate + free-text refine (routes through
    `reviseIconsDirect` → prompt revision → `generateFinalsFor`).
13. **Icon buttons.** Replace "PNG"/"Regen" text buttons with ⤓ and ↻ icon
    buttons (title/aria labels preserved).
14. **Transparency + preview backgrounds.** Style gains
    `iconBackground: "transparent" | color`. Agent op to change it
    conversationally. Preview-sheet route accepts `background` and prompts for
    transparent-styled sheets accordingly; SheetCard/FinalsCard get a backdrop
    swatch picker (checkerboard default, any hex) — display-only CSS, no
    regeneration needed to recolor the view.
15. **Source-icon crops (experimental, behind the `sourceCrops` settings
    flag, default ON).** New step `locate_icons`: ONE Gemini vision call
    sends the approved source + the full candidate list and returns one
    structured response with a normalized bounding box (or null) per icon
    id — **a single request for all icons, not one per icon**. Client crops
    via canvas (free). Each crop renders **to the left of the candidate's
    name/concept text** on the BlueprintCard, and is offered as the per-icon
    reference image for finals ("rebuild from the original pixels"). Re-run
    (one more call) only when candidates change or the source is swapped.
    Owner intent: Fable is the experiment platform — wire it up, flag it,
    keep or remove later.
16. **Title dedupe.** When applying `suggestedTitle`/styleName, check
    `listProjects()` names; suffix `(2)`, `(3)`… on collision.

## Workstream C — Gallery, projects, zip
**Files:** `lib/fable/store.ts`, new `lib/fable/gallery-sync.ts`, new
`lib/zip.ts`, `components/fable/Composer.tsx` (plus-menu), new
`components/fable/ProjectView.tsx`, `components/fable/cards/FinalsCard.tsx` +
`CompletionCard.tsx` (zip), **additive only:** `lib/storage/db.ts`,
`lib/storage/repo.ts`, `components/gallery/GalleryView.tsx`,
`components/gallery/GalleryPicker.tsx`.

17. **Every image lands in the global gallery.** Uploads, improved sources,
    sheets, finals — saved as Blobs to the `asset-arsenal` gallery store with
    additive optional fields `bench: "fable"`, `projectId`, `projectName`,
    `step`. Regeneration archives the outgoing version to the gallery **before**
    replacing it (history is never lost). Fire-and-forget, never blocks the
    pipeline.
18. **Gallery segmented by project.** GalleryView gains a project filter
    (dropdown built from distinct `projectName`); "All" remains the default so
    legacy benches see zero change. Records without a project show as today.
19. **Project view in Fable.** Header tab "Chat | Project": the project view
    shows the blueprint, every asset (sources incl. versions, sheets incl.
    superseded, finals incl. archived regens) with their prompts, in a grid —
    the UI-oriented "project ≠ chat" surface.
20. **Plus-button drop-up.** Upload file / **From gallery** (reuse
    `GalleryPicker`) / **Recent** (last N images across fable projects).
21. **Zip downloads.** `lib/zip.ts`: minimal STORE-only zip writer (~80 lines,
    PNGs are already compressed — no new dependency). "Download all" on
    FinalsCard/CompletionCard produces `<project-name>.zip`; supports any
    multi-file selection.

## Workstream D — Live/Dev rework: prompts, models, raw I/O
**Files:** `components/fable/DevDrawer.tsx`, new
`components/fable/ModelSettings.tsx`, `components/fable/ChatFeed.tsx` (step
rows), `app/fable/page.tsx` (header), `lib/fable/types.ts` (usage record
fields), all `app/api/fable/*` routes (echo), `lib/fable/client-api.ts`.
**Sequencing: after B (shared types/use-fable edits).**

22. **Model settings in Live.** Header ⚙ popover: pick the model per role —
    agent/analysis (Gemini tier), image model, quality. Backed by the existing
    `setModelConfig`; deprecation/transparency warnings carried over from
    DevDrawer. Visible in both modes.
23. **Live shows the prompt + model for every request.** Routes already return
    prompts; attach `model` + full `prompt` to each usage record / step event.
    In Live, each generation card/step gets an expandable "prompt · model"
    row. The owner's rule: *user sees prompt and can change model; dev sees
    the raw API traffic.*
24. **Dev shows raw request/response.** Routes accept `debug: true` (sent when
    devMode is on) and include a scrubbed request summary + raw response
    metadata in the reply; kept on a ring buffer (last 20) in memory, rendered
    in DevDrawer as expandable JSON. Failure `raw` already exists — this adds
    the success path.
25. **Capabilities outline.** Small "What can I do here?" panel listing
    Live vs Dev abilities (owner asked for an explicit outline).

## Workstream E — Usage: project view, bench views, Gemini quota
**Files:** `app/usage/page.tsx`, `lib/icon/usage-log.ts` (additive),
`lib/icon/model-reference.ts` (additive), `components/fable/UsagePanel.tsx`.

26. **Call-log project view.** Toggle: Calls | Projects. Projects mode groups
    entries by `projectId` into accordions (header: project name/id, bench,
    total cost, call count); inside, rows are **collapsed by step + model**
    ("5× agent_route · gemini-3.1-flash-lite · $0", "3× final_icon ·
    gpt-image-1-mini · $0.06"). Needs `projectName` carried on entries
    (additive optional field; Fable supplies it).
27. **Bench selector.** Keep/extend the bench filter as a dropdown covering
    every bench that logs (pipeline, fable, experiments, …) — each selection
    scopes headline, rollups, and call log.
28. **Gemini free-tier quota.** Catalog gains
    `freeTierDailyRequests?: number` per Gemini model (flash-lite: 1000,
    flash: 250, pro: 100 — TODO confirm current published RPD; owner cited
    500). `/usage` and the Fable UsagePanel show "today: 37 / 500 requests"
    per Gemini model, computed from ledger timestamps (local midnight).
29. **UsagePanel per-project rows.** In "All Fable" scope add a by-project
    table (name, calls, cost) above by-model.

---

## Sub-agent execution map

Hard file boundaries; one agent per workstream, two phases because
`use-fable.ts`, `gemini-steps.ts`, `schemas.ts` are hot files:

- **Phase 1 (parallel):**
  - Agent 1 → Workstream A
  - Agent 2 → Workstream C, **minus** anything in A's or shared hook files:
    builds `lib/zip.ts`, `lib/fable/gallery-sync.ts` (functions only),
    store.ts additions, additive `lib/storage/db.ts`/`repo.ts` fields,
    gallery project filter, `ProjectView.tsx` (component only), zip buttons
    on FinalsCard/CompletionCard. Deferred to Phase 2: calling gallery-sync
    from `use-fable.ts`, wiring ProjectView into the page header, the
    Composer plus-menu.
  - Agent 3 → Workstream E, **without editing `lib/fable/store.ts`** (join
    project names via the existing `listProjects()` read) and deferring the
    one-line `projectName` addition to the `logUsage` call in `use-fable.ts`
    to Phase 2.
- **Phase 2 (parallel, after Phase 1 commits):**
  - Agent 4 → Workstream B + the deferred wiring above (owns
    `lib/fable/**`, `app/api/fable/**`, cards)
  - Agent 5 → Workstream D (owns `DevDrawer`, new `ModelSettings`/settings
    UI incl. downscale + sourceCrops toggles, `Composer` plus-menu,
    `app/fable/page.tsx` wiring) — does NOT edit `lib/fable/**` or routes;
    integration seams reconciled at review.

Verification gate for every agent: `npx tsc --noEmit` clean; manual smoke of
the touched surface; commit per workstream. **No edits outside the listed
files; never touch other benches' pages or behavior.**

## Answered questions

- **Do we downscale images before OpenAI?** No — nothing in the chain resizes
  (client reads the file verbatim; `imageBase64ToFile` just re-encodes).
  OpenAI downscales server-side to 2048 max edge and bills by 512px tiles:
  ≈$0.002 per ≤1024² input vs ≈$0.006 max, so client downscaling saves
  pennies but fixes payload/storage bloat. A8 makes it a setting
  (Off / 1024 / 2048, default 1024).
- **Can we crop a candidate icon out of the original source?** Yes — preview
  sheets use deterministic grid math (we *generated* the layout), but for
  arbitrary sources Gemini vision bounding-box detection works. ONE call for
  all candidates, cropping is free client-side canvas. Planned as B15,
  behind the `sourceCrops` settings flag.
