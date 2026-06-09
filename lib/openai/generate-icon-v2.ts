import type { GeneratedIcon, GenerateIconV2Item } from "@/types/icon-pipeline";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildV2IconGenerationWrapper } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";
import { imageBase64ToFile } from "./to-file";

export type GenerateIconV2Args = {
  referenceImageBase64: string;
  sharedStylePrompt: string;
  icon: GenerateIconV2Item;
  model?: string;
  quality?: "low" | "medium" | "high";
};

/**
 * Bench V2 — generate one standalone icon using the ORIGINAL source image as the
 * style reference (no collection image step). The wrapper explicitly tells the
 * model to read only the family style from the reference and ignore its layout,
 * so dashboard noise doesn't leak into the icon.
 */
export async function generateIconV2(
  args: GenerateIconV2Args,
): Promise<GeneratedIcon> {
  const client = getClient();
  const model = args.model ?? MODEL_ROLES.imageGeneratorModel;
  const wrappedPrompt = buildV2IconGenerationWrapper({
    sharedStylePrompt: args.sharedStylePrompt,
    iconName: args.icon.iconName,
    iconConcept: args.icon.concept,
    iconPrompt: args.icon.prompt,
  });

  try {
    const referenceFile = await imageBase64ToFile(
      args.referenceImageBase64,
      "reference.png",
    );

    const res = await client.images.edit({
      model,
      image: referenceFile,
      prompt: wrappedPrompt,
      n: 1,
      size: "1024x1024",
      background: "transparent",
      quality: args.quality ?? "medium",
    });

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) {
      throw new IconPipelineError("icon_generation", "No image data returned.");
    }

    return {
      id: crypto.randomUUID(),
      iconId: args.icon.iconId,
      iconName: args.icon.iconName,
      prompt: wrappedPrompt,
      imageUrl: `data:image/png;base64,${b64}`,
      modelUsed: model,
      status: "success",
      createdAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "icon_generation",
      err instanceof Error ? err.message : "Unexpected error during icon generation.",
      err,
    );
  }
}

/** Non-throwing variant — returns a "failed" icon instead of throwing. */
export async function generateIconV2Safe(
  args: GenerateIconV2Args,
): Promise<GeneratedIcon> {
  try {
    return await generateIconV2(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Icon generation failed.";
    return {
      id: crypto.randomUUID(),
      iconId: args.icon.iconId,
      iconName: args.icon.iconName,
      prompt: args.icon.prompt,
      imageUrl: "",
      modelUsed: args.model ?? MODEL_ROLES.imageGeneratorModel,
      status: "failed",
      error: message,
      createdAt: new Date().toISOString(),
    };
  }
}
