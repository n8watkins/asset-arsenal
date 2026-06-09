import { IconPipelineError } from "@/lib/icon/errors";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";
import { imageBase64ToFile } from "./to-file";

/**
 * Bench V3 — generate ONE grid image containing every icon, using the source
 * image as the style reference. The caller slices the returned image locally.
 */
export async function generateGridImage(args: {
  referenceImageBase64: string;
  prompt: string;
  model?: string;
  quality?: "low" | "medium" | "high";
}): Promise<{ imageBase64: string }> {
  const client = getClient();
  const model = args.model ?? MODEL_ROLES.imageGeneratorModel;

  try {
    const referenceFile = await imageBase64ToFile(
      args.referenceImageBase64,
      "reference.png",
    );

    const res = await client.images.edit({
      model,
      image: referenceFile,
      prompt: args.prompt,
      n: 1,
      size: "1024x1024",
      background: "transparent",
      quality: args.quality ?? "medium",
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      throw new IconPipelineError("icon_generation", "No grid image data returned.");
    }
    return { imageBase64: `data:image/png;base64,${b64}` };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "icon_generation",
      err instanceof Error ? err.message : "Unexpected error during grid generation.",
      err,
    );
  }
}
