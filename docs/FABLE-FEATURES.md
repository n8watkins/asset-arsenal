# Fable Bench — Feature Inventory

Every feature Fable Bench (`/fable`) has that **did not exist in any other
bench** (`/bench`, `/bench-s`, `/bench-v2`, `/bench-router`, `/experiments`,
home pipeline). This is the reference list of what Fable introduced — many of
these were never explicitly requested but are candidates for whatever the final
product becomes. File references point at where each one lives.

## Interaction & layout

1. **Chat-first end-to-end flow.** The whole page IS the conversation: hero
   empty state → chat feed → docked composer. Every other bench is a
   form/sections page. (`app/fable/page.tsx`, `components/fable/Hero.tsx`)
2. **Inline artifact cards in the chat stream.** Sources, blueprints, sheets,
   finals appear as live cards merged chronologically into the conversation —
   pinned in position, updating in place. (`components/fable/ChatFeed.tsx`)
3. **Hover-to-identify icons on preview sheets.** Hovering a cell on the
   rendered sheet shows exactly which icon (`icon_004 — Settings`) you're
   looking at, so you and the agent share a referent without regenerating
   anything. Per-cell popover with targeted refine/regenerate.
   (`components/fable/cards/SheetCard.tsx`)
4. **Whole-page drag-drop + paste-to-attach** with thumbnail chip in the
   composer; auto-growing textarea. (`app/fable/page.tsx`, `Composer.tsx`)
5. **Contextual quick-action chips** above the composer that change with
   pipeline stage. (`components/fable/ui.tsx`, stage machine in
   `lib/fable/types.ts`)
6. **Lightbox enlarge** for chat/source images. (`components/fable/ui.tsx`)

## Agent & pipeline behavior

7. **Per-turn intent classification.** Every user message goes through a
   Gemini agent that returns intent + structured ops + a conversational reply +
   confidence, judged against a live project-state summary. Other benches have
   buttons; `/bench-router` classifies only the first intake.
   (`app/api/fable/agent`, `lib/fable/gemini-steps.ts`)
8. **Low-confidence confirmation gate** — below 0.55 the agent asks instead of
   acting, with confirm/cancel in the feed. (`lib/fable/use-fable.ts`)
9. **Agent decision cards** in dev mode: intent badge, confidence bar, planned
   ops list, rationale. (`components/fable/cards/DecisionCard.tsx`)
10. **Source-upgrade loop with versions.** AI critique of the uploaded image,
    before/after tabs, version thumbnail strip, free-text "tweak it" input.
    (`components/fable/cards/SourceCard.tsx`)
11. **Style blueprint extraction as an editable artifact.** Palette swatches,
    mood/line/shape tags, negative rules, plus an icon-candidate list with
    inline rename/remove. (`components/fable/cards/BlueprintCard.tsx`)
12. **Per-sheet approval.** Approve one preview sheet and generate finals for
    just its icons while other sheets stay in draft. (`use-fable.ts`)
13. **Sheet supersede semantics.** Regenerated sheets dim their predecessors in
    place — history stays readable instead of being replaced. (`SheetCard.tsx`)
14. **Sheet-position-grounded final rendering.** Each final icon's prompt tells
    the model "this icon is at row 2, col 3 of the attached 3×3 sheet" for
    family/color fidelity. (`lib/fable/prompts.ts`)
15. **Streaming finals grid.** Bounded concurrency (3 at a time), shimmer
    placeholders, per-icon retry/download/regenerate, checkerboard transparency
    backdrop, live progress + running cost line.
    (`components/fable/cards/FinalsCard.tsx`, `use-fable.ts`)

## Persistence & sessions

16. **Multi-session chat history sidebar** — thumbnails, stage pill, relative
    time, hover-delete; switch between saved sessions. (No other bench has
    sessions at all; they lose state on reload.) (`components/fable/Sidebar.tsx`,
    `lib/fable/store.ts`)
17. **"Pixels are precious" crash safety** — explicit IndexedDB flush
    immediately after every image generation, plus debounced autosave of
    everything else. (`use-fable.ts`)

## Cost & dev tooling

18. **Per-call usage ledger on the artifact** — provider/model/step/tokens/
    cost/duration/prompt-preview per call, attached to the chat it belongs to;
    always-visible header cost pill. (`lib/fable/pricing.ts`,
    `lib/fable/types.ts`)
19. **Usage records attached even to failed calls** — server routes return a
    usage record alongside the error. (`lib/fable/errors.ts`, `app/api/fable/*`)
20. **Free-tier-aware cost model** — Gemini calls priced $0, OpenAI priced from
    the shared catalog. (`lib/fable/pricing.ts`)
21. **Live/Dev mode toggle** — one switch hides all plumbing for a clean
    product view, or shows decision cards, step rows, and the DevDrawer
    (usage table, prompt inventory, scrubbed project JSON, manual pipeline
    triggers). (`app/fable/page.tsx`, `components/fable/DevDrawer.tsx`)

---

*Known gaps and fixes in flight (global usage wiring, AI chat titles, model
selection, project-vs-chat split, richer dev mode) are tracked in
[`CODE-REVIEW-2026-06-10.md`](./CODE-REVIEW-2026-06-10.md).*
