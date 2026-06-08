# Asset Arsenal — API Contract

The single source of truth for how we call OpenAI and structure the Next.js
route handlers. All steps code against this. Verified against the installed
SDKs: `next@16.2.7`, `openai@6.42.0`, `zod@^4.4.3`, React 19, Node 22.

> ⚠️ **Live-call status:** `OPENAI_API_KEY` in `.env.local` is currently
> **empty**. Everything below is verified at the **type / SDK level**, not
> against the live API. Model IDs (`gpt-5.4-mini`, `gpt-5.4-nano`,
> `gpt-image-1-mini`) are the intended defaults; if the API rejects an ID at
> runtime, fix it in `lib/icon/models.ts` ONLY.

## The pipeline — a 6-step artifact chain

The app is the memory layer; each step explicitly passes the artifacts the next
one needs. The **collection image** is the visual style anchor:
steps 4 and 5 pass it back to the model as a reference image.

```
sourceImage
  ↓  /api/icons/analyze                       (vision)
iconManifest
  ↓  /api/icons/compose-collection-prompt     (text)
collectionPrompt
  ↓  /api/icons/generate-collection-image     (images.edit, source as reference)
collectionImage
  ↓  /api/icons/compose-individual-prompts    (vision, collection image as input)
individualPrompts { sharedStylePrompt, iconPrompts[] }
  ↓  /api/icons/generate-one | generate-batch (images.edit, collection image as reference)
generatedIcons[]
```

## Model roles (lib/icon/models.ts)

```ts
export const MODEL_ROLES = {
  visionAnalyzerModel:   "gpt-5.4-mini",    // step 1: image      -> manifest JSON
  collectionPromptModel: "gpt-5.4-nano",    // step 2: manifest   -> collection prompt (text)
  collectionImageModel:  "gpt-image-1-mini",// step 3: src+prompt -> collection image
  individualPromptModel: "gpt-5.4-mini",    // step 4: sheet+manifest -> prompts JSON (vision)
  imageGeneratorModel:   "gpt-image-1-mini",// step 5: sheet+prompt -> single icon
} as const;
```

## Structured JSON outputs — `responses.parse` + `zodTextFormat`

Steps 1 and 4 return JSON. Use `client.responses.parse(...)` with
`zodTextFormat(Schema, "name")`; read `res.output_parsed` (typed, may be null).

Strict-mode rules for schemas fed to `zodTextFormat`:

- **No `.default(...)`.** Express optionals as `.nullable()` (e.g. `glowStyle`).
- Keep schemas flat; avoid discriminated unions and `.transform()`.
- `confidence` is `z.enum(["high","medium","low"])`.

### Step 1 — analyze (vision) → manifest

```ts
const res = await client.responses.parse({
  model: MODEL_ROLES.visionAnalyzerModel,
  input: [{ role: "user", content: [
    { type: "input_text",  text: ICON_ANALYSIS_PROMPT },
    { type: "input_image", image_url: dataUrl, detail: "high" },
  ]}],
  text: { format: zodTextFormat(IconManifestSchema, "icon_manifest") },
});
```

Manifest shape: `{ iconCount, sharedIconFamilyStyle, icons[], excludedAsNonIcons }`.

### Step 2 — compose collection prompt (text)

Text-only. The composer is told to return **only the final prompt text** (no
JSON), so we use `responses.create` and read `res.output_text.trim()`.

### Step 4 — compose individual prompts (vision)

Same vision shape as step 1, but the **collection image** is the `input_image` and
the manifest is interpolated into the text. Returns
`{ sharedStylePrompt, iconPrompts[] }` where each prompt has
`{ iconId, iconName, concept, collectionImageReference, prompt }`.

## Image generation with a reference image — `images.edit`

Steps 3 and 5 pass a **reference image** to the GPT image model. The SDK does
this through `client.images.edit({ image, prompt, ... })` — the `image` field
accepts up to 16 reference images for gpt-image models. Convert a base64 / data
URL into an `Uploadable` via `toFile` (see `lib/openai/to-file.ts`).

```ts
const file = await imageBase64ToFile(base64, "ref.png"); // toFile(buffer, name, { type })
const res = await client.images.edit({
  model: MODEL_ROLES.imageGeneratorModel,
  image: file,                 // step 3: source image; step 5: collection image
  prompt: wrappedPrompt,
  n: 1,
  size: "1024x1024",           // 1024x1024 | 1024x1536 | 1536x1024 | auto
  background: "transparent",   // step 5 icons; step 3 collection image uses "auto"
  quality: "medium",           // "low" | "medium" | "high" | "auto"
});
const b64 = res.data?.[0]?.b64_json;          // gpt-image returns b64_json
const imageUrl = `data:image/png;base64,${b64}`;
```

- gpt-image models return `b64_json` by default; do NOT pass `response_format`.
- `background: "transparent"` requires PNG (default) — good for reusable icons.
- `input_fidelity` is **unsupported on `gpt-image-1-mini`** — do not send it.

## Next.js 16 route handlers

Standard Web `Request`/`Response`. Each route: parse JSON body → validate with a
zod request schema (`lib/icon/schemas/request.schema.ts`) → call the service →
map `IconPipelineError` to `{ error }` + status. Images travel as base64 in the
JSON body, so no multipart parsing is needed. Keep `OPENAI_API_KEY`
server-side; never expose it (no `NEXT_PUBLIC_` prefix).

## Shared error type (lib/icon/errors.ts)

```ts
export class IconPipelineError extends Error {
  constructor(
    public step: PipelineErrorStep, // upload | analysis | collection_prompt |
                                    // collection_image | individual_prompts | icon_generation
    message: string,
    public rawError?: unknown,
  ) { super(message); this.name = "IconPipelineError"; }
}
```

A missing key surfaces as a clear "API key is not configured." 500.
