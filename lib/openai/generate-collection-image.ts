import type { CollectionImage, IconManifest } from "@/types/icon-pipeline";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildCollectionImageBody } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";
import { imageBase64ToFile } from "./to-file";

/**
 * Step 3 — generate the icon collection image.
 *
 * Sends the source image as a visual reference (via images.edit) together with
 * the manifest (source of truth for which icons appear) and the composed
 * collection prompt. The collection image is the visual anchor for steps 4 & 5.
 */
export async function generateCollectionImage(args: {
  sourceImageBase64: string;
  manifest: IconManifest;
  collectionPrompt: string;
}): Promise<CollectionImage> {
  const client = getClient();
  const body = buildCollectionImageBody(
    JSON.stringify(args.manifest, null, 2),
    args.collectionPrompt,
  );

  try {
    const sourceFile = await imageBase64ToFile(args.sourceImageBase64, "source.png");

    const res = await client.images.edit({
      model: MODEL_ROLES.collectionImageModel,
      image: sourceFile,
      prompt: body,
      n: 1,
      size: "1024x1024",
      // The collection image is a presentation surface (dark navy), not a
      // transparent asset — let the model pick the best background.
      background: "auto",
      quality: "high",
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      throw new IconPipelineError(
        "collection_image",
        "No collection image returned.",
      );
    }

    return {
      id: crypto.randomUUID(),
      imageUrl: `data:image/png;base64,${b64}`,
      promptUsed: args.collectionPrompt,
      modelUsed: MODEL_ROLES.collectionImageModel,
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "collection_image",
      err instanceof Error
        ? err.message
        : "Unexpected error while generating the collection image.",
      err,
    );
  }
}
