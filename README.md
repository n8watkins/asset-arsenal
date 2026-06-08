# Asset Arsenal

An OpenAI-powered **icon extraction workbench**. Upload a source image → a
6-step AI pipeline detects the icons, builds a style-anchoring collection image,
then regenerates each icon as a clean, transparent standalone asset.

```
sourceImage
  → /api/icons/analyze                     [gpt-5.4-mini, vision]
iconManifest
  → /api/icons/compose-collection-prompt   [gpt-5.4-nano, text]
collectionPrompt
  → /api/icons/generate-collection-image   [gpt-image-1-mini, images.edit, source as reference]
collectionImage  ← the visual style anchor
  → /api/icons/compose-individual-prompts  [gpt-5.4-mini, vision, collection image as input]
individualPrompts { sharedStylePrompt, iconPrompts[] }
  → /api/icons/generate-one | generate-batch  [gpt-image-1-mini, images.edit, collection image as reference]
generatedIcons[]
```

The collection image is the visual style anchor for the whole run — steps 4 and 5
pass it back to the model as a reference image via `images.edit` (not
`images.generate`, which has no reference-image input).

It's a *workbench*, not a black box: each pipeline step is an independent,
rerunnable breakpoint with "Show JSON" visibility at every stage.

## Setup

```bash
npm install
# Add a real key — OpenAI calls will not work until you do:
echo 'OPENAI_API_KEY=sk-...' > .env.local
npm run dev
```

The key is **server-side only** — it's never exposed to the browser. The UI and
routes build and render fine without a key; only the OpenAI calls fail (with a
clear "API key is not configured." message).

## Routes

| Route | What |
|---|---|
| `/bench` | Primary surface — 6 sections, one per pipeline step. Each shows the resolved prompt before running and feeds its output into the next step. |
| `/` | Linear run-through of the full flow. |
| `/gallery` | IndexedDB-backed library of source images and generated icons. |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · `openai@6` · `zod@4`.

## How it's organized

| Path | What |
|---|---|
| `docs/API-CONTRACT.md` | Authoritative spec for the 6-step chain, model roles, and call shapes |
| `types/icon-pipeline.ts` | Domain + API types |
| `lib/icon/models.ts` | Model role IDs + cost guardrails (change model IDs here only) |
| `lib/icon/prompts.ts` | All per-step prompts — edit here to tune the pipeline |
| `lib/icon/schemas/` | Zod schemas for structured outputs and request validation |
| `app/api/icons/` | `analyze`, `compose-collection-prompt`, `generate-collection-image`, `compose-individual-prompts`, `generate-one`, `generate-batch` |

## Model roles

Defined in `lib/icon/models.ts`. If a model ID is rejected by the live API,
change it **there** (one place):

```ts
visionAnalyzerModel:   "gpt-5.4-mini"     // step 1: source image       -> manifest JSON
collectionPromptModel: "gpt-5.4-nano"     // step 2: manifest           -> collection prompt text
collectionImageModel:  "gpt-image-1-mini" // step 3: source + prompt    -> collection image
individualPromptModel: "gpt-5.4-mini"     // step 4: collection image      -> individual prompts JSON
imageGeneratorModel:   "gpt-image-1-mini" // step 5: collection image + prompt -> single icon
```

## Guardrails

Max 25 icons/run (hard cap 40), 1 image per icon, transparent PNG output, upload
limited to png/jpeg/webp ≤10MB, partial-failure tolerant generation (one failed
icon doesn't kill the batch; each icon can be regenerated individually).
