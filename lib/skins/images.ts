// Page skins - step 2: generate the three skin images in parallel and post-process
// them with sharp (compress, make the texture tile seamlessly, trim the emblem).

import sharp from "sharp";
import { getClient } from "@/lib/openai/client";
import { imageCostUSD, type ImageQuality } from "@/lib/icon/model-reference";
import type { SkinSpec } from "./spec";
import type { SkinAssets, SkinUsage } from "./types";

/** gpt-image-2 is the current (non-deprecated) model but has no transparency,
 *  so the emblem uses gpt-image-1.5 until a current model supports it. */
export const IMAGE_MODELS = {
  hero: { model: "gpt-image-2", size: "1536x1024", quality: "medium", transparent: false },
  texture: { model: "gpt-image-2", size: "1024x1024", quality: "medium", transparent: false },
  emblem: { model: "gpt-image-1.5", size: "1024x1024", quality: "medium", transparent: true },
} as const;

type Slot = keyof typeof IMAGE_MODELS;

const SUFFIX: Record<Slot, string> = {
  hero: " Wide 3:2 composition, rich detail, no text, no letters, no logos, no UI.",
  texture:
    " Flat, top-down, evenly distributed pattern that fills the whole square edge to edge, low contrast, no focal point, no border, no vignette, no text.",
  emblem:
    " A single centered emblem, bold simple shapes that read at 32 pixels, transparent background, no text, no letters, no frame.",
};

async function generate(slot: Slot, prompt: string): Promise<Buffer> {
  const cfg = IMAGE_MODELS[slot];
  const res = await getClient().images.generate({
    model: cfg.model,
    prompt: prompt + SUFFIX[slot],
    n: 1,
    size: cfg.size,
    quality: cfg.quality,
    ...(cfg.transparent ? { background: "transparent" as const } : {}),
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image data returned.");
  return Buffer.from(b64, "base64");
}

async function postProcess(slot: Slot, png: Buffer): Promise<string> {
  if (slot === "hero") {
    const out = await sharp(png).resize({ width: 1200 }).webp({ quality: 80 }).toBuffer();
    return `data:image/webp;base64,${out.toString("base64")}`;
  }
  if (slot === "texture") {
    // Mirror-tile a 512px quarter into 1024px so the tile is seamless by construction.
    const q = await sharp(png).resize(512, 512).toBuffer();
    const [fl, fp, both] = await Promise.all([
      sharp(q).flop().toBuffer(),
      sharp(q).flip().toBuffer(),
      sharp(q).flip().flop().toBuffer(),
    ]);
    const out = await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#000" } })
      .composite([
        { input: q, left: 0, top: 0 },
        { input: fl, left: 512, top: 0 },
        { input: fp, left: 0, top: 512 },
        { input: both, left: 512, top: 512 },
      ])
      .webp({ quality: 78 })
      .toBuffer();
    return `data:image/webp;base64,${out.toString("base64")}`;
  }
  const out = await sharp(png).trim().resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toBuffer();
  return `data:image/webp;base64,${out.toString("base64")}`;
}

export async function generateSkinImages(
  prompts: SkinSpec["imagePrompts"],
): Promise<{ assets: SkinAssets; usage: SkinUsage[] }> {
  const slots: Slot[] = ["hero", "texture", "emblem"];
  const results = await Promise.all(
    slots.map(async (slot) => {
      const cfg = IMAGE_MODELS[slot];
      const start = Date.now();
      try {
        const url = await postProcess(slot, await generate(slot, prompts[slot]));
        const usage: SkinUsage = {
          step: slot,
          model: cfg.model,
          durationMs: Date.now() - start,
          costUSD: imageCostUSD(cfg.model, cfg.quality as ImageQuality, 1),
          detail: `${cfg.size} ${cfg.quality}`,
        };
        return { slot, url, usage };
      } catch (err) {
        const usage: SkinUsage = {
          step: slot,
          model: cfg.model,
          durationMs: Date.now() - start,
          costUSD: 0,
          error: err instanceof Error ? err.message : String(err),
        };
        return { slot, url: null, usage };
      }
    }),
  );
  const assets: SkinAssets = { hero: null, texture: null, emblem: null };
  for (const r of results) assets[r.slot] = r.url;
  return { assets, usage: results.map((r) => r.usage) };
}
