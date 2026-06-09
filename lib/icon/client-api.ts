// Client-side typed fetch wrappers for the six pipeline API routes.
// Each throws Error(<friendly message>) on non-2xx so callers can route the
// message into the pipeline's error state.
//
// Every call is also appended to the local usage log (success AND failure) as a
// side effect — logging never changes a wrapper's return value or thrown error.

import type {
  AnalyzeResponse,
  ComposeCollectionPromptResponse,
  GenerateCollectionImageResponse,
  ComposeIndividualPromptsResponse,
  GenerateOneResponse,
  GenerateBatchResponse,
  MegaAnalyzeResponse,
  GenerateIconsV2Response,
  GenerateGridResponse,
  GenerateIconV2Item,
  SliceMode,
  IconManifest,
  IndividualIconPrompt,
  IndividualIconPrompts,
  TokenUsage,
} from "@/types/icon-pipeline";
import {
  DEFAULT_STACK,
  estimateStepCostUSD,
  imageCostUSD,
  realizedTextCostUSD,
  type ImageQuality,
  type StepKey,
} from "@/lib/icon/model-reference";
import { logUsage, summarizeText, type UsageResult } from "@/lib/icon/usage-log";

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      (typeof data.error === "string" && data.error) || "Request failed.",
    );
  }
  return data as T;
}

// --- Usage logging helper ----------------------------------------------------
// Runs a postJSON call, logs a UsageEntry for it (ok or failed), then returns
// the response or rethrows. Logging is purely a side effect.

type LogArgs = {
  step: StepKey;
  kind: "text" | "image";
  model?: string;
  quality?: ImageQuality;
  count?: number;
};

function resolveModel(step: StepKey, model?: string): string {
  return model ?? DEFAULT_STACK.models[step];
}

function resolveQuality(step: StepKey, quality?: ImageQuality): ImageQuality {
  return (
    quality ??
    DEFAULT_STACK.quality[step === "collectionImage" ? "collectionImage" : "generateIcons"]
  );
}

async function tracked<T>(
  args: LogArgs,
  run: () => Promise<T>,
  summarize?: (res: T) => UsageResult,
): Promise<T> {
  const model = resolveModel(args.step, args.model);
  const count = args.count ?? 1;
  const quality = args.kind === "image" ? resolveQuality(args.step, args.quality) : undefined;
  const estCost = estimateStepCostUSD(args.step, model, { quality, count });

  try {
    const res = await run();

    let realizedCost: number | null;
    let inputTokens: number | undefined;
    let outputTokens: number | undefined;
    if (args.kind === "image") {
      realizedCost = imageCostUSD(model, quality ?? "medium", count);
    } else {
      const usage = (res as { usage?: TokenUsage }).usage;
      if (usage) {
        inputTokens = usage.inputTokens;
        outputTokens = usage.outputTokens;
        realizedCost = realizedTextCostUSD(model, usage);
      } else {
        realizedCost = null;
      }
    }

    logUsage({
      step: args.step,
      model,
      kind: args.kind,
      quality,
      count,
      estCost,
      realizedCost,
      inputTokens,
      outputTokens,
      ok: true,
      result: summarize?.(res),
    });
    return res;
  } catch (err) {
    logUsage({
      step: args.step,
      model,
      kind: args.kind,
      quality,
      count,
      estCost,
      realizedCost: null,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// Step 1
export function analyzeImage(
  imageBase64: string,
  fileName?: string,
  model?: string,
) {
  return tracked(
    { step: "analyze", kind: "text", model },
    () =>
      postJSON<AnalyzeResponse>("/api/icons/analyze", {
        imageBase64,
        fileName,
        model,
      }),
    (r) => summarizeText(JSON.stringify(r.manifest, null, 2)),
  );
}

// Step 2
export function composeCollectionPrompt(manifest: IconManifest, model?: string) {
  return tracked(
    { step: "collectionPrompt", kind: "text", model },
    () =>
      postJSON<ComposeCollectionPromptResponse>(
        "/api/icons/compose-collection-prompt",
        { manifest, model },
      ),
    (r) => summarizeText(r.collectionPrompt),
  );
}

// Step 3
export function generateCollectionImage(args: {
  sourceImageBase64: string;
  manifest: IconManifest;
  collectionPrompt: string;
  model?: string;
  quality?: ImageQuality;
}) {
  return tracked(
    { step: "collectionImage", kind: "image", model: args.model, quality: args.quality },
    () =>
      postJSON<GenerateCollectionImageResponse>(
        "/api/icons/generate-collection-image",
        args,
      ),
    () => ({ kind: "image", count: 1 }),
  );
}

// Step 4
export function composeIndividualPrompts(args: {
  collectionImageBase64: string;
  manifest: IconManifest;
  model?: string;
}) {
  return tracked(
    { step: "individualPrompts", kind: "text", model: args.model },
    () =>
      postJSON<ComposeIndividualPromptsResponse>(
        "/api/icons/compose-individual-prompts",
        args,
      ),
    (r) => summarizeText(JSON.stringify(r.individualPrompts, null, 2)),
  );
}

// Step 5 (single)
export function generateOneIcon(args: {
  collectionImageBase64: string;
  sharedStylePrompt: string;
  iconPrompt: IndividualIconPrompt;
  model?: string;
  quality?: ImageQuality;
}) {
  return tracked(
    { step: "generateIcons", kind: "image", model: args.model, quality: args.quality },
    () => postJSON<GenerateOneResponse>("/api/icons/generate-one", args),
    (r) => ({ kind: "image", count: r.generatedIcon.status === "success" ? 1 : 0 }),
  );
}

// Step 5 (batch)
export function generateIconsBatch(args: {
  collectionImageBase64: string;
  individualPrompts: IndividualIconPrompts;
  model?: string;
  quality?: ImageQuality;
}) {
  return tracked(
    {
      step: "generateIcons",
      kind: "image",
      model: args.model,
      quality: args.quality,
      count: args.individualPrompts.iconPrompts.length,
    },
    () => postJSON<GenerateBatchResponse>("/api/icons/generate-batch", args),
    (r) => ({
      kind: "image",
      count: r.generatedIcons.filter((g) => g.status === "success").length,
    }),
  );
}

// --- Bench V2 (collapsed pipeline) ---

// V2 §1 — one vision pass for the manifest + shared style + every per-icon
// prompt. Logged under the "analyze" step (it is the V2 analyze call).
export function megaAnalyze(imageBase64: string, fileName?: string, model?: string) {
  return tracked(
    { step: "analyze", kind: "text", model },
    () =>
      postJSON<MegaAnalyzeResponse>("/api/icons/mega-analyze", {
        imageBase64,
        fileName,
        model,
      }),
    (r) => summarizeText(JSON.stringify(r.analysis, null, 2)),
  );
}

// V2 §5 — generate every icon against the source image as the reference.
export function generateIconsV2Batch(args: {
  referenceImageBase64: string;
  sharedStylePrompt: string;
  icons: GenerateIconV2Item[];
  model?: string;
  quality?: ImageQuality;
}) {
  return tracked(
    {
      step: "generateIcons",
      kind: "image",
      model: args.model,
      quality: args.quality,
      count: args.icons.length,
    },
    () => postJSON<GenerateIconsV2Response>("/api/icons/generate-icons-v2", args),
    (r) => ({
      kind: "image",
      count: r.generatedIcons.filter((g) => g.status === "success").length,
    }),
  );
}

// --- Bench V3 (grid pipeline) ---

// One grid image (so count = 1 — that's the whole cost), sliced locally into N
// icons. Logged under "generateIcons" with count 1.
export function generateGrid(args: {
  referenceImageBase64: string;
  sharedStylePrompt: string;
  icons: GenerateIconV2Item[];
  rows: number;
  cols: number;
  mode: SliceMode;
  model?: string;
  quality?: ImageQuality;
}) {
  return tracked(
    { step: "generateIcons", kind: "image", model: args.model, quality: args.quality, count: 1 },
    () => postJSON<GenerateGridResponse>("/api/icons/generate-grid", args),
    () => ({ kind: "image", count: 1 }),
  );
}
