# Asset Arsenal — API Contract Memo (WP0)

This is the single source of truth for how we call OpenAI and structure Next.js
route handlers. All work packages code against this. Verified against the
installed SDKs on the scaffold commit:

- `next@16.2.7`, `openai@6.42.0`, `zod@^4.4.3`, React 19, Node 22.

> ⚠️ **Live-call status:** `OPENAI_API_KEY` in `.env.local` is currently **empty**.
> Everything below is verified at the **type / SDK level**, not against the live
> API. The first real smoke test happens once a real `sk-...` key is set. Treat
> model IDs (`gpt-5.4-mini`, `gpt-5.4-nano`) as the intended defaults; if the API
> rejects an ID at runtime, fix it in `lib/icon/models.ts` ONLY (one place).

## Model roles (lib/icon/models.ts)

```ts
export const MODEL_ROLES = {
  visionAnalyzerModel: "gpt-5.4-mini",   // image  -> manifest JSON
  promptWriterModel:   "gpt-5.4-nano",   // manifest -> prompt pack JSON
  imageGeneratorModel: "gpt-image-1-mini", // prompt -> icon image
} as const;
```

## Structured JSON outputs — use `responses.parse` + `zodTextFormat`

Both helpers exist in this SDK: `openai/helpers/zod` exports `zodTextFormat`,
and `client.responses.parse(...)` returns a typed `output_parsed`. This is the
clean path for steps 1 & 2 (no manual JSON.parse, no fragile prompt-only JSON).

### Vision analysis (analyze-icons.ts) — gpt-5.4-mini

```ts
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { IconManifestSchema } from "@/lib/icon/schemas/icon-manifest.schema";

const res = await client.responses.parse({
  model: MODEL_ROLES.visionAnalyzerModel,
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: ICON_ANALYSIS_PROMPT },
        { type: "input_image", image_url: dataUrl, detail: "high" }, // dataUrl = "data:image/png;base64,...."
      ],
    },
  ],
  text: { format: zodTextFormat(IconManifestSchema, "icon_manifest") },
});

const manifest = res.output_parsed; // typed IconManifest | null
if (!manifest) throw new IconPipelineError("analysis", "Model returned no manifest");
```

- `input_image` accepts a base64 data URL via `image_url`. `detail: "high"` for dense dashboards.
- Error codes the API may emit for bad images: `invalid_image`, `image_too_large`, `unsupported_image_media_type`, etc. Map to a friendly message.

### Prompt pack (generate-icon-prompts.ts) — gpt-5.4-nano

```ts
const res = await client.responses.parse({
  model: MODEL_ROLES.promptWriterModel,
  input: [{ role: "user", content: PROMPT_PACK_PROMPT /* manifest + family style interpolated */ }],
  text: { format: zodTextFormat(IconPromptPackSchema, "icon_prompt_pack") },
});
const promptPack = res.output_parsed;
```

### Zod schema rules for strict structured outputs

Strict mode requires every property present and `additionalProperties:false`.
The helper handles optional→nullable, but to avoid surprises:

- **Do NOT use `.default(...)`** in schemas fed to `zodTextFormat`.
- For optional fields (`glowStyle`, `notes`), use `.nullable()` (not bare `.optional()`), or just make them required.
- Keep schemas flat; avoid discriminated unions and `.transform()` in the output schema.
- Confidence is an enum: `z.enum(["high","medium","low"])`.

## Image generation (generate-icon.ts) — gpt-image-1-mini

```ts
const res = await client.images.generate({
  model: MODEL_ROLES.imageGeneratorModel,
  prompt: wrappedPrompt,        // §15.3 style wrapper + icon-specific prompt
  n: 1,
  size: "1024x1024",
  background: "transparent",    // icons should be transparent PNGs
  quality: "medium",            // "low" | "medium" | "high" | "auto"
});

const b64 = res.data?.[0]?.b64_json;
if (!b64) throw new IconPipelineError("icon_generation", "No image returned");
const imageUrl = `data:image/png;base64,${b64}`;
```

- **gpt-image models return `b64_json` by default** and do NOT support the legacy
  `response_format` param. Do not pass `response_format`.
- Valid sizes: `1024x1024 | 1024x1536 | 1536x1024 | auto`. Icons use `1024x1024` (1:1).
- `background: "transparent"` requires PNG output (default) — good for reusable icons.

## Next.js 16 route handlers

Standard Web `Request`/`Response`. Pattern (mirrors PRD §14):

```ts
// app/api/icon-analysis/route.ts
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }

  // validate with zod, enforce limits, call service, map errors to friendly strings
  return Response.json({ manifest });
}
```

- Route handlers live only under `app/`; cannot coexist with `page.js` at the same segment.
- Not cached by default for POST. No special config needed.
- `request.json()` for JSON bodies. For our flow the image arrives as base64 in the JSON body (`imageBase64`), so no multipart parsing needed.
- Keep `OPENAI_API_KEY` server-side; never expose to client. No `NEXT_PUBLIC_` prefix.

## Shared error type

```ts
// lib/icon/errors.ts
export class IconPipelineError extends Error {
  constructor(
    public step: "upload" | "analysis" | "prompt_generation" | "icon_generation",
    message: string,
    public rawError?: unknown,
  ) { super(message); this.name = "IconPipelineError"; }
}
```

Services throw `IconPipelineError`; routes catch and map to `{ error }` + status.
A missing key should surface as a clear "API key is not configured." 500.
