// Fable Bench — server-only OpenAI image-generation steps.
//
// All three functions:
//   - use getClient() + the caller's image model (default FABLE_MODELS.image) + images.edit
//   - return { ...result, usage: FableUsageRecord[] }
//   - on failure, build a usage record with ok:false + error and attach it
//     to a FableError so the route can append it to the ledger

import { getClient } from "@/lib/openai/client";
import { imageBase64ToFile } from "@/lib/openai/to-file";
import { openaiImageUsageRecord, previewOf } from "./pricing";
import { FableError } from "./errors";
import { FABLE_MODELS } from "./types";
import type { FableUsageRecord, ImageQuality } from "./types";

// ---------------------------------------------------------------------------
// renderImprovedSource — full interface image (opaque, 1536×1024)
// ---------------------------------------------------------------------------

export async function renderImprovedSource(args: {
  imageBase64: string;
  imagePrompt: string;
  model?: string;
  quality?: ImageQuality;
}): Promise<{ imageBase64: string; usage: FableUsageRecord[] }> {
  const client = getClient();
  const model = args.model ?? FABLE_MODELS.image;
  const quality = args.quality ?? "medium";
  const start = Date.now();
  const promptPreview = previewOf(args.imagePrompt);

  let res;
  try {
    const sourceFile = await imageBase64ToFile(args.imageBase64, "source.png");
    res = await client.images.edit({
      model,
      image: sourceFile,
      prompt: args.imagePrompt,
      n: 1,
      size: "1536x1024",
      background: "opaque",
      quality,
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const usageRecord = openaiImageUsageRecord({
      step: "improve_source_image",
      model,
      quality,
      imageCount: 1,
      durationMs,
      ok: false,
      error: err instanceof Error ? err.message : "OpenAI image edit failed.",
      promptPreview,
    });
    throw new FableError(
      "improve_source_image",
      err instanceof Error ? err.message : "Source improvement rendering failed.",
      [usageRecord],
      err,
    );
  }

  const durationMs = Date.now() - start;
  const b64 = res.data?.[0]?.b64_json;

  if (!b64) {
    const usageRecord = openaiImageUsageRecord({
      step: "improve_source_image",
      model,
      quality,
      imageCount: 1,
      durationMs,
      ok: false,
      error: "No image data returned.",
      promptPreview,
    });
    throw new FableError("improve_source_image", "Improved source rendered no image data.", [usageRecord]);
  }

  const usageRecord = openaiImageUsageRecord({
    step: "improve_source_image",
    model,
    quality,
    imageCount: 1,
    durationMs,
    ok: true,
    promptPreview,
  });

  return {
    imageBase64: `data:image/png;base64,${b64}`,
    usage: [usageRecord],
  };
}

// ---------------------------------------------------------------------------
// renderPreviewSheet — icon grid image (opaque, 1024×1024)
// ---------------------------------------------------------------------------

export async function renderPreviewSheet(args: {
  referenceImageBase64: string;
  sheetPrompt: string;
  model?: string;
  quality?: ImageQuality;
}): Promise<{ imageBase64: string; usage: FableUsageRecord[] }> {
  const client = getClient();
  const model = args.model ?? FABLE_MODELS.image;
  const quality = args.quality ?? "medium";
  const start = Date.now();
  const promptPreview = previewOf(args.sheetPrompt);

  let res;
  try {
    const referenceFile = await imageBase64ToFile(args.referenceImageBase64, "reference.png");
    res = await client.images.edit({
      model,
      image: referenceFile,
      prompt: args.sheetPrompt,
      n: 1,
      size: "1024x1024",
      background: "opaque",
      quality,
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const usageRecord = openaiImageUsageRecord({
      step: "preview_image",
      model,
      quality,
      imageCount: 1,
      durationMs,
      ok: false,
      error: err instanceof Error ? err.message : "OpenAI image edit failed.",
      promptPreview,
    });
    throw new FableError(
      "preview_image",
      err instanceof Error ? err.message : "Preview sheet rendering failed.",
      [usageRecord],
      err,
    );
  }

  const durationMs = Date.now() - start;
  const b64 = res.data?.[0]?.b64_json;

  if (!b64) {
    const usageRecord = openaiImageUsageRecord({
      step: "preview_image",
      model,
      quality,
      imageCount: 1,
      durationMs,
      ok: false,
      error: "No image data returned.",
      promptPreview,
    });
    throw new FableError("preview_image", "Preview sheet rendered no image data.", [usageRecord]);
  }

  const usageRecord = openaiImageUsageRecord({
    step: "preview_image",
    model,
    quality,
    imageCount: 1,
    durationMs,
    ok: true,
    promptPreview,
  });

  return {
    imageBase64: `data:image/png;base64,${b64}`,
    usage: [usageRecord],
  };
}

// ---------------------------------------------------------------------------
// renderFinalIcon — single transparent standalone icon (1024×1024)
// ---------------------------------------------------------------------------

export async function renderFinalIcon(args: {
  referenceImageBase64: string;
  wrappedPrompt: string;
  model?: string;
  quality?: ImageQuality;
}): Promise<{ imageBase64: string; usage: FableUsageRecord[] }> {
  const client = getClient();
  const model = args.model ?? FABLE_MODELS.image;
  const quality = args.quality ?? "medium";
  const start = Date.now();
  const promptPreview = previewOf(args.wrappedPrompt);

  let res;
  try {
    const referenceFile = await imageBase64ToFile(args.referenceImageBase64, "reference.png");
    res = await client.images.edit({
      model,
      image: referenceFile,
      prompt: args.wrappedPrompt,
      n: 1,
      size: "1024x1024",
      background: "transparent",
      quality,
    });
  } catch (err) {
    const durationMs = Date.now() - start;
    const usageRecord = openaiImageUsageRecord({
      step: "final_icon",
      model,
      quality,
      imageCount: 1,
      durationMs,
      ok: false,
      error: err instanceof Error ? err.message : "OpenAI image edit failed.",
      promptPreview,
    });
    throw new FableError(
      "final_icon",
      err instanceof Error ? err.message : "Final icon rendering failed.",
      [usageRecord],
      err,
    );
  }

  const durationMs = Date.now() - start;
  const b64 = res.data?.[0]?.b64_json;

  if (!b64) {
    const usageRecord = openaiImageUsageRecord({
      step: "final_icon",
      model,
      quality,
      imageCount: 1,
      durationMs,
      ok: false,
      error: "No image data returned.",
      promptPreview,
    });
    throw new FableError("final_icon", "Final icon rendered no image data.", [usageRecord]);
  }

  const usageRecord = openaiImageUsageRecord({
    step: "final_icon",
    model,
    quality,
    imageCount: 1,
    durationMs,
    ok: true,
    promptPreview,
  });

  return {
    imageBase64: `data:image/png;base64,${b64}`,
    usage: [usageRecord],
  };
}
