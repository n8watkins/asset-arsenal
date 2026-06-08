# Asset Arsenal — Icon Extraction Pipeline

A human-readable walkthrough of the 6-step artifact chain. For technical call
shapes, request/response schemas, and SDK usage see `docs/API-CONTRACT.md`.
Prompts are defined in `lib/icon/prompts.ts` — tune them there. The pipeline
is exercised step-by-step in the `/bench` route.

---

## Design philosophy: the contact sheet as the visual anchor

The pipeline builds a **contact sheet** (a single image containing every icon
in the family) before generating any individual icon. Once that image exists,
every subsequent step passes it back to the model as an attached reference
image. This is what keeps all the icons visually consistent — the contact
sheet is the style source of truth, not just a description of one.

The image steps (`generate-collection-image` and `generate-one` /
`generate-batch`) use `images.edit` rather than `images.generate` because
`edit` is the SDK call that accepts a reference image as input.

---

## Step 0 — Upload source image

**Goal.** Accept a screenshot or export from the user's UI and make it
available to the rest of the pipeline. No AI call is made here.

**Inputs.** A raw image file (PNG / JPEG / WebP, up to 10 MB).

**What happens.** The client converts the file to a base64 data URL and stores
it in pipeline state. Allowed MIME types and size limits are enforced in
`lib/icon/models.ts` (`IMAGE_UPLOAD_LIMITS`).

**Output artifact — `SourceImage`.**

```ts
{
  id: string;
  imageUrl: string;      // object URL or data URL
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  uploadedAt: string;
}
```

**API route.** No server route — handled client-side.

---

## Step 1 — Analyze source image → `iconManifest`

**Goal.** Have a vision model look at the source image and produce a structured
JSON inventory of every icon present, along with the shared visual style of the
icon family.

**Inputs.**
- `sourceImage` (base64 data URL) — attached as an `input_image` with
  `detail: "high"`.
- `ICON_ANALYSIS_PROMPT` (from `lib/icon/prompts.ts`) — instructs the model to
  find feature icons, metric icons, navigation icons, status icons, action
  icons, dashboard glyphs, and similar symbolic UI marks; to ignore cards,
  charts, backgrounds, and full layout sections; and to extract the shared
  icon family style (color palette, line style, shape language, glow style,
  background rule, negative rules).

**What's sent to the AI.**

```
model: gpt-5.4-mini   (MODEL_ROLES.visionAnalyzerModel)
input: [
  { type: "input_text",  text: ICON_ANALYSIS_PROMPT },
  { type: "input_image", image_url: <sourceImage data URL>, detail: "high" },
]
text format: zodTextFormat(IconManifestSchema, "icon_manifest")
```

The response is parsed with `client.responses.parse`; the typed result is read
from `res.output_parsed`.

**Output artifact — `IconManifest`.**

```ts
{
  iconCount: number;
  sharedIconFamilyStyle: {
    colorPalette: string[];
    lineStyle: string;
    shapeLanguage: string;
    glowStyle: string | null;
    backgroundRule: string;
    negativeRules: string[];
  };
  icons: Array<{
    id: string;             // stable "icon_001", "icon_002", …
    name: string;
    concept: string;
    whereVisible: string;
    visualDescription: string;
    confidence: "high" | "medium" | "low";
  }>;
  excludedAsNonIcons: string[];
}
```

**API route.** `POST /api/icons/analyze`

---

## Step 2 — Compose collection prompt → `collectionPrompt`

**Goal.** Turn the raw JSON manifest into a polished, single natural-language
image-generation prompt that can be sent directly to an image model. This
intermediate step keeps the "think about what to draw" work separate from the
image generation itself.

**Inputs.**
- `iconManifest` (serialized to JSON string and interpolated into the prompt
  via `buildCollectionPromptComposer`).

**What's sent to the AI.**

```
model: gpt-5.4-nano   (MODEL_ROLES.collectionPromptModel)
call:  responses.create   (text-only; no image attached)
input: buildCollectionPromptComposer(manifestJson)
```

The prompt instructs the model to return **only the final prompt text** — no
JSON, no explanation, no mention of "manifest" or "schema". See
`lib/icon/prompts.ts → buildCollectionPromptComposer` for the full
instructions. The result is read from `res.output_text.trim()`.

**Output artifact — `collectionPrompt` (plain string).**

A ready-to-use image-generation prompt describing:
1. the overall goal (unified icon collection image)
2. the shared icon family style
3. which icons to include
4. the desired layout (clean grid)
5. output constraints
6. negative constraints (no labels, no UI clutter, etc.)

**API route.** `POST /api/icons/compose-collection-prompt`

---

## Step 3 — Generate collection image (contact sheet) → `collectionImage`

**Goal.** Generate the **contact sheet** — a single image that shows all icons
in the family together, in the shared style. This image becomes the visual
style anchor for every icon generated afterward.

**Inputs.**
- `sourceImage` (base64) — attached as the reference image via `images.edit`.
- `iconManifest` (JSON string) — embedded in the prompt body as the
  "source of truth for which icons should appear."
- `collectionPrompt` — the generation prompt from Step 2, appended after the
  manifest.

The full prompt body is built by `buildCollectionImageBody(manifestJson, collectionPrompt)`
in `lib/icon/prompts.ts`.

**What's sent to the AI.**

```
model:      gpt-image-1-mini   (MODEL_ROLES.collectionImageModel)
call:       client.images.edit
image:      sourceImage (converted to Uploadable via toFile)
prompt:     buildCollectionImageBody(manifestJson, collectionPrompt)
n:          1
size:       1024x1024
background: "auto"
quality:    "high"
```

The model returns `b64_json`; the route converts it to a data URL.

**Output artifact — `CollectionImage`.**

```ts
{
  id: string;
  imageUrl: string;      // data URL of the contact sheet
  promptUsed: string;    // the collection prompt sent to the model
  modelUsed: string;
  createdAt: string;
}
```

**API route.** `POST /api/icons/generate-collection-image`

---

## Step 4 — Compose individual prompts → `individualPrompts`

**Goal.** Using the contact sheet as a visual style reference, produce one
carefully-crafted image-generation prompt for each icon in the manifest. Also
produce a shared style paragraph that every individual generation will include.

**Inputs.**
- `collectionImage` (base64) — attached as an `input_image`; the model uses it
  as the style reference.
- `iconManifest` (JSON string) — interpolated into the text via
  `buildIndividualPromptComposer`; used as the source of truth for icon names,
  concepts, and meanings.

**What's sent to the AI.**

```
model: gpt-5.4-mini   (MODEL_ROLES.individualPromptModel)
call:  client.responses.parse   (vision)
input: [
  { type: "input_text",  text: buildIndividualPromptComposer(manifestJson) },
  { type: "input_image", image_url: <collectionImage data URL>, detail: "high" },
]
text format: zodTextFormat(IndividualIconPromptsSchema, "individual_icon_prompts")
```

The prompt (see `lib/icon/prompts.ts → buildIndividualPromptComposer`) asks
the model to ground every icon prompt in the contact sheet's actual style and
to note the icon's position in the sheet where possible.

**Output artifact — `IndividualIconPrompts`.**

```ts
{
  sharedStylePrompt: string;   // reused verbatim in every Step 5 call
  iconPrompts: Array<{
    iconId: string;
    iconName: string;
    concept: string;
    contactSheetReference: string;   // e.g. "row 2, column 3"
    prompt: string;                  // icon-specific generation prompt
  }>;
}
```

**API route.** `POST /api/icons/compose-individual-prompts`

---

## Step 5 — Generate each icon → `generatedIcons[]`

**Goal.** Render each icon as a standalone, reusable 1:1 square asset that
visually matches the contact sheet family style.

**Inputs (per icon).**
- `collectionImage` (base64) — attached as the reference image via
  `images.edit`; this is what keeps the icon visually consistent with the rest
  of the family.
- `sharedStylePrompt` — the shared style paragraph from Step 4, embedded in
  the generation wrapper.
- `iconPrompt` (`IndividualIconPrompt`) — the icon-specific prompt from Step 4.

The full prompt body is built by `buildIconGenerationWrapper({ sharedStylePrompt, iconName, iconConcept, iconPrompt })`
in `lib/icon/prompts.ts`.

**What's sent to the AI (per icon).**

```
model:      gpt-image-1-mini   (MODEL_ROLES.imageGeneratorModel)
call:       client.images.edit
image:      collectionImage (converted to Uploadable via toFile)
prompt:     buildIconGenerationWrapper(...)
n:          1
size:       1024x1024
background: "transparent"
quality:    "medium"
```

The generation wrapper enforces strict output constraints: one icon only, 1:1
square, centered, no text, no labels, no UI chrome, transparent or dark-navy
background. See `lib/icon/prompts.ts → buildIconGenerationWrapper` for the
full list.

**Output artifact — `GeneratedIcon` (one per icon, collected into `generatedIcons[]`).**

```ts
{
  id: string;
  iconId: string;
  iconName: string;
  prompt: string;        // the final wrapped prompt actually sent
  imageUrl: string;      // data URL once generated, "" while pending
  modelUsed: string;
  status: "pending" | "generating" | "success" | "failed";
  error?: string;
  createdAt: string;
}
```

**API routes.**
- `POST /api/icons/generate-one` — generate a single icon (one
  `IndividualIconPrompt` in the request body).
- `POST /api/icons/generate-batch` — generate all icons in one request (the
  full `IndividualIconPrompts` object).

---

## Final artifact chain

```
sourceImage
  ↓  /api/icons/analyze                        (vision, gpt-5.4-mini)
iconManifest
  ↓  /api/icons/compose-collection-prompt      (text-only, gpt-5.4-nano)
collectionPrompt
  ↓  /api/icons/generate-collection-image      (images.edit, gpt-image-1-mini; source image attached)
collectionImage  ◄── the contact sheet / visual style anchor
  ↓  /api/icons/compose-individual-prompts     (vision, gpt-5.4-mini; contact sheet attached)
individualPrompts  { sharedStylePrompt, iconPrompts[] }
  ↓  /api/icons/generate-one | generate-batch  (images.edit, gpt-image-1-mini; contact sheet attached)
generatedIcons[]
```

---

## The simplest version

1. **Break the source image into icon JSON.** A vision model scans the
   screenshot and produces a structured list of every icon with its name,
   concept, visual description, and the shared family style.

2. **Turn the icon JSON into a prompt for an all-icons image.** A text model
   converts the manifest into a clean natural-language prompt that describes
   the full icon family grid.

3. **Generate that all-icons image (the contact sheet) from source + JSON + prompt.**
   An image model receives the original screenshot as a visual reference, the
   manifest as the icon checklist, and the composed prompt — and produces the
   contact sheet.

4. **Use the contact sheet + JSON to make per-icon prompts.** A vision model
   looks at the contact sheet and the manifest together to write one
   tightly-scoped generation prompt per icon, grounded in the sheet's actual
   rendered style.

5. **Generate each icon from the contact sheet + its prompt.** For each icon,
   an image model receives the contact sheet as the visual reference and the
   wrapped per-icon prompt — producing a standalone, reusable asset that
   matches the family.
