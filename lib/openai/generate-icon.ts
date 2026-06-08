import type {
  GeneratedIcon,
  GenerateOneRequest,
} from "@/types/icon-pipeline";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildIconGenerationWrapper } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";
import { imageBase64ToFile } from "./to-file";

/**
 * Step 5 — generate one standalone icon.
 *
 * The collection image is passed as the visual style reference (via images.edit)
 * alongside the wrapped per-icon prompt, so each icon matches the family.
 */
export async function generateIcon(
  args: GenerateOneRequest,
): Promise<GeneratedIcon> {
  const client = getClient();
  const wrappedPrompt = buildIconGenerationWrapper({
    sharedStylePrompt: args.sharedStylePrompt,
    iconName: args.iconPrompt.iconName,
    iconConcept: args.iconPrompt.concept,
    iconPrompt: args.iconPrompt.prompt,
  });

  try {
    const collectionImageFile = await imageBase64ToFile(
      args.collectionImageBase64,
      "collection-image.png",
    );

    const res = await client.images.edit({
      model: MODEL_ROLES.imageGeneratorModel,
      image: collectionImageFile,
      prompt: wrappedPrompt,
      n: 1,
      size: "1024x1024",
      background: "transparent",
      quality: "medium",
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      throw new IconPipelineError("icon_generation", "No image data returned.");
    }

    return {
      id: crypto.randomUUID(),
      iconId: args.iconPrompt.iconId,
      iconName: args.iconPrompt.iconName,
      prompt: wrappedPrompt,
      imageUrl: `data:image/png;base64,${b64}`,
      modelUsed: MODEL_ROLES.imageGeneratorModel,
      status: "success",
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "icon_generation",
      err instanceof Error
        ? err.message
        : "Unexpected error during icon generation.",
      err,
    );
  }
}

/**
 * Non-throwing variant. Returns a GeneratedIcon with status "failed" instead
 * of throwing — used by the batch route for partial-failure tolerance.
 */
export async function generateIconSafe(
  args: GenerateOneRequest,
): Promise<GeneratedIcon> {
  try {
    return await generateIcon(args);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Icon generation failed.";
    return {
      id: crypto.randomUUID(),
      iconId: args.iconPrompt.iconId,
      iconName: args.iconPrompt.iconName,
      prompt: args.iconPrompt.prompt,
      imageUrl: "",
      modelUsed: MODEL_ROLES.imageGeneratorModel,
      status: "failed",
      error: message,
      createdAt: new Date().toISOString(),
    };
  }
}
