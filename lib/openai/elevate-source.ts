import { IconPipelineError } from "@/lib/icon/errors";
import { buildSourceElevationPrompt } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";
import { imageBase64ToFile } from "./to-file";

/**
 * Bench S step 2 — source image -> elevated source image.
 *
 * Polishes the source (clarity, consistency, de-noise) while preserving its
 * identity — the result is a clean style reference for V2/V3. Opaque, not
 * transparent (it's a full interface image, not an icon).
 */
export async function elevateSource(args: {
  imageBase64: string;
  improvements?: string[];
  model?: string;
  quality?: "low" | "medium" | "high";
}): Promise<{ imageBase64: string }> {
  const client = getClient();
  const model = args.model ?? MODEL_ROLES.collectionImageModel;

  try {
    const sourceFile = await imageBase64ToFile(args.imageBase64, "source.png");

    const res = await client.images.edit({
      model,
      image: sourceFile,
      prompt: buildSourceElevationPrompt(args.improvements),
      n: 1,
      size: "1024x1024",
      background: "opaque",
      quality: args.quality ?? "medium",
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      throw new IconPipelineError("collection_image", "No elevated image data returned.");
    }
    return { imageBase64: `data:image/png;base64,${b64}` };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "collection_image",
      err instanceof Error ? err.message : "Unexpected error during source elevation.",
      err,
    );
  }
}
