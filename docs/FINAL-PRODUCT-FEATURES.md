# Final Product — Features Fable Bench Introduced (and Gaps It Exposed)

Fable Bench (`/fable`) is the closest thing to the final product: an agentic,
chat-first, end-to-end image→icon-pack flow. This doc is the carry-forward
contract: every feature Fable introduced that the final version should keep,
every gap Fable made visible, and the defects we explicitly do NOT carry
forward. The other benches (`/bench`, `/bench-s`, `/bench-v2`, `/bench-router`,
`/experiments`) remain standalone experiments — nothing here limits them.

Status legend: ✅ keep as-is · 🔧 keep but fix/evolve · 🆕 gap Fable exposed —
build for final · ❌ defect, do not carry forward

---

## 1. The core interaction model

| | Feature | Where today | Notes |
|---|---|---|---|
| ✅ | **Chat-first layout** — the whole page IS the conversation; hero empty state, docked composer, artifact cards inline in the stream | `app/fable/page.tsx`, `components/fable/ChatFeed.tsx`, `Hero.tsx`, `Composer.tsx` | Explicitly praised. The conversation-as-product framing is the final UX. |
| ✅ | **Hover-to-identify icons on preview sheets** — hovering a cell on the sheet tells you which icon you're looking at, so you and the agent share a referent ("icon_004") without regenerating anything | `components/fable/cards/SheetCard.tsx:66-140` | Explicitly praised as "next level." The point is *identification and discussion*, not per-cell regeneration. Keep the hover/popover affordance; de-emphasize one-click regen (it's a money trap and currently blocks right-click — see §5). |
| 🔧 | **Per-turn intent routing** — every user message is classified (intent + ops + reply + confidence) against a state summary before anything runs | `app/api/fable/agent`, `lib/fable/gemini-steps.ts:94-240` | The mechanism is right; the *execution* is far too aggressive (see §2). This becomes the every-interaction router of the final product. |
| ✅ | **Mechanical actions bypass the agent** — regenerate/retry/approve buttons act directly, no NL classification | partially true today | This is the stated rule for final. Today some buttons cheat by injecting synthetic English chat messages that get re-classified (`SheetCard.tsx:118`, `ChatFeed.tsx:182`) — make ALL mechanical actions emit structured ops directly. |
| 🔧 | **Stage machine + contextual quick-action chips** above the composer | `lib/fable/types.ts:50-59`, `ui.tsx:45-52` | Keep; chips should reflect the *plan* the router proposes (see §2). |
| ✅ | **Whole-page drag-drop + paste-to-attach**, in-composer thumbnail chip, auto-grow textarea | `app/fable/page.tsx:49-64`, `Composer.tsx` | Keep. |

## 2. The router agent — Fable's biggest lesson

Fable proved per-turn classification works and proved one-shot execution
doesn't. A single "looks good" today triggers analyze + render ALL preview
sheets with zero checkpoints (`use-fable.ts:518-590`), and `generate_finals`
silently auto-approves every draft sheet. Far too aggressive.

Final version:

- 🆕 **Router on every user interaction** (except mechanical buttons). The
  classifier returns a **plan** — ordered ops with a cost estimate — not an
  immediate cascade.
- 🆕 **Checkpointed execution** — one step per confirmation by default, with an
  explicit "auto mode" for trusting users. Fable's decision cards
  (`cards/DecisionCard.tsx`) are already the plan-preview UI.
- 🆕 **Two-tier routing** — cold intake (which pipeline? — today's
  `lib/router`) and in-session (which ops? — today's Fable agent) stay separate
  decision spaces sharing one generic `classifyIntent` core. Steal from
  `lib/router`: the `needsUserChoice` flag, deterministic derivation
  (`deriveStartingPoint`), and the `/bench-router` preset regression harness —
  port that harness to Fable's intents so router tuning is testable.

## 3. Chats, projects, and naming

- 🆕 **Projects ≠ chats.** A project is the UI-oriented container: **style
  guide** (Fable's Blueprint card — palette, mood/line/shape tags, negative
  rules — is the seed), **gallery images**, and **clickable icon references**
  that insert structured mentions (`icon_004`) into the composer. Chats hang
  off a project (`chat.projectId`); the data already cleaves cleanly: chat =
  events + usage + pendingDecision, project = sources + style + candidates +
  sheets + finals.
- 🆕 **AI-named chats** — generate a title so chats are referenceable with
  context. Cheapest path: add `suggestedTitle` to the agent's structured-output
  schema (zero extra calls) or reuse `style.styleName` from analyze.
- ❌ **Empty chats must not be persisted.** Today merely visiting `/fable`
  saves an "Untitled project" 500ms later (`use-fable.ts:168-180`), and New
  saves immediately (`use-fable.ts:227`). Guard saves on substance
  (`events.length > 0 || original`).
- ✅ **Sidebar chat history** — thumbnails, stage pill, relative time,
  hover-delete (`Sidebar.tsx`). Keep, fix staleness (refresh key is
  `events.length`, so renames don't repaint).

## 4. Cost & usage

- 🔧 **Per-call usage ledger** — provider/model/step/tokens/cost/duration per
  call, always-visible header cost pill, live cost line during finals
  (`lib/fable/pricing.ts`, `types.ts:197-216`). Keep the per-chat view, but:
- 🆕 **One global ledger.** Fable's ledger must also write to the existing
  global usage history (`lib/icon/usage-log.ts` → `/usage`). It's ~30 lines:
  fire `logUsage(...)` from `appendUsage` (`use-fable.ts:203-209`); widen
  `UsageEntry.step` to accept fable step keys. `/usage` already degrades
  gracefully for unknown steps. Unified-ledger design in
  `docs/CODE-REVIEW-2026-06-10.md` §Consolidation.
- 🆕 **Global usage view inside the product** — cross-chat/cross-project
  totals, not just the open chat's. Today nothing aggregates across projects.
- ✅ **Free-tier-aware cost model** (Gemini $0, OpenAI priced from the shared
  catalog) — keep, but put the free-tier flag in the model catalog so going
  paid is one switch.
- ✅ **Server attaches usage records even to failed calls** — keep the
  contract, fix the client which currently drops them
  (`lib/fable/client-api.ts:34-40`).

## 5. Images: viewing, saving, browser-native behavior

- 🆕 **Detailed image view on click** — every generated image (sheets AND
  finals) opens a real lightbox: zoom/pan, Escape to close, metadata/prompt
  panel, download. Today finals have no click handler at all
  (`FinalsCard.tsx:96-148`) and sheets hide "enlarge" behind a tiny text
  button.
- ❌ **Right-click must always work.** Two breakages to never reintroduce:
  (1) SheetCard's interactive overlay covers every pixel of the image, so the
  context menu targets a `div`, not the `<img>` (`SheetCard.tsx:72-83`) — keep
  overlays `pointer-events: none` except on hover-activated targets; (2)
  generated images are multi-MB base64 **data URLs**, which browsers refuse to
  open as top-frame tabs — render feed images from object URLs (convert once,
  revoke on unmount) and/or provide explicit open/download actions.
- ✅ **Streaming finals grid** — bounded concurrency, shimmer placeholders,
  per-icon retry/download/regen, checkerboard transparency backdrop, progress +
  live cost (`use-fable.ts:399-514`, `cards/FinalsCard.tsx`). Keep wholesale.
- ✅ **"Pixels are precious" crash safety** — immediate IndexedDB flush after
  every image generation. Keep.
- 🆕 **Generated assets reach the shared gallery** — Fable finals currently
  exist only inside the project blob; the final product saves them to the
  gallery library like the other benches do (`lib/icon/bench-persist.ts`
  pattern).

## 6. Pipeline quality features worth keeping

- ✅ **Source-upgrade loop** — before/after tabs, version strip, collapsible AI
  critique, tweak input (`cards/SourceCard.tsx`).
- ✅ **Style blueprint extraction** — editable candidate list with inline
  rename/remove (`cards/BlueprintCard.tsx`); becomes the project style guide.
- ✅ **Per-sheet approval** — generate finals for one sheet while other drafts
  stay under review (`use-fable.ts:874-896`).
- ✅ **Sheet supersede semantics** — superseded sheets dim in place, history
  stays readable.
- ✅ **Sheet-position-grounded final rendering** ("row 2, col 3 of a 3×3
  grid") for family/color fidelity (`prompts.ts:312-322`).

## 7. Dev mode & configurability

- 🆕 **Model selection.** Models are frozen consts today
  (`lib/fable/types.ts:26-31`) — and the hardcoded image model
  `gpt-image-1-mini` is **deprecated (shutdown 2026-12-01)** per the catalog.
  Final version: optional `model`/`quality` on every request schema, defaults
  from the catalog (never literals), a picker in dev mode — parity with
  `/bench`'s Stack picker.
- 🆕 **Dev mode at `/bench` parity** — raw request/response bodies per step,
  raw error JSON (`FableError.rawError` exists but is never sent to the
  client), per-step manual runs with custom inputs, model visibility. Keep
  Fable's DevDrawer tabs (usage table, prompt inventory, scrubbed project
  JSON) and add the above.
- ✅ **Live/Dev mode toggle** — keep the concept; dev mode just needs more
  inside it.

---

## Known Fable defects (tracked in CODE-REVIEW-2026-06-10.md, do not carry forward)

Cross-chat contamination when switching chats mid-generation (HIGH);
`generateFinalsFor([])` hangs `busy` forever; dropped usage on failed calls;
invisible `error` state; second image attachment silently ignored; double-send
race; bare-Enter accidental sheet regen; sidebar staleness; `listProjects`
loads every full project (all embedded images) just to draw the sidebar;
data-URL-in-JSON storage (vs the gallery's Blob storage) — the migration risk
compounds with every saved project.
