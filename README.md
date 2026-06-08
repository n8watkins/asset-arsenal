# Asset Arsenal

A chat-guided, OpenAI-powered **icon extraction workbench** (PRD V0.1).

Upload an image full of icons → AI detects the icons and a shared icon-family
style → AI writes one generation prompt per icon → AI regenerates each icon as a
clean, transparent, standalone asset → review, regenerate, and download.

```
Upload image
  → [gpt-5.4-mini]    detect icons + family style   →  Manifest
  → [gpt-5.4-nano]    write one prompt per icon      →  Prompt Pack
  → [gpt-image-1-mini] generate one icon per prompt  →  Generated Icons
  → review / regenerate / download
```

It's a *workbench*, not a black box: two approval gates (manifest, prompts),
"Show JSON" everywhere, and a collapsible debug drawer.

## Setup

```bash
npm install
# Add a real key — generation will not work until you do:
echo 'OPENAI_API_KEY=sk-...' > .env.local
npm run dev
```

The key is **server-side only** — it's never exposed to the browser. The UI and
routes build and render fine without a key; only the OpenAI calls fail (with a
clear "API key is not configured." message).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · `openai@6` · `zod@4`.

## How it's organized

| Path | What |
|---|---|
| `docs/API-CONTRACT.md` | Verified OpenAI/Next call shapes — the spec the code follows |
| `types/icon-pipeline.ts` | Domain + API types (PRD §13) |
| `lib/icon/` | `models` (roles + guardrails), `schemas` (Zod), `prompts` (§15 templates), `errors`, `use-icon-pipeline` (state machine), `client-api`, `download`, `fixtures` |
| `lib/openai/` | `analyze-icons`, `generate-icon-prompts`, `generate-icon` services |
| `app/api/` | `icon-analysis`, `icon-prompts`, `generate-icon`, `generate-icons-batch` |
| `components/icon-pipeline/` | `UploadCard`, `ManifestReviewCard`, `PromptReviewCard`, `IconGrid`, `DebugDrawer`, `Header` |
| `app/preview` | Dev-only route rendering every card against fixtures |

## Model roles

Defined in `lib/icon/models.ts`. If a model ID is rejected by the live API,
change it **there** (one place):

```ts
visionAnalyzerModel: "gpt-5.4-mini"    // image  -> manifest JSON
promptWriterModel:   "gpt-5.4-nano"    // manifest -> prompt pack JSON
imageGeneratorModel: "gpt-image-1-mini" // prompt -> icon image
```

## Guardrails

Max 25 icons/run (hard cap 40), 1 image per icon, transparent PNG output, upload
limited to png/jpeg/webp ≤10MB, partial-failure tolerant generation (one failed
icon doesn't kill the batch; each icon can be regenerated individually).
