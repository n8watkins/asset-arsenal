import type { GenerateIconRequest, GeneratedIcon } from "@/types/icon-pipeline";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildIconGenerationPrompt } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";

export async function generateIcon(
  args: GenerateIconRequest,
): Promise<GeneratedIcon> {
  const client = getClient();
  const wrappedPrompt = buildIconGenerationPrompt(
    args.iconFamilyStyle,
    args.prompt.prompt,
  );

  try {
    const res = await client.images.generate({
      model: MODEL_ROLES.imageGeneratorModel,
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
      iconId: args.icon.id,
      iconName: args.icon.name,
      prompt: args.prompt.prompt,
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
  args: GenerateIconRequest,
): Promise<GeneratedIcon> {
  try {
    return await generateIcon(args);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Icon generation failed.";
    return {
      id: crypto.randomUUID(),
      iconId: args.icon.id,
      iconName: args.icon.name,
      prompt: args.prompt.prompt,
      imageUrl: "",
      modelUsed: MODEL_ROLES.imageGeneratorModel,
      status: "failed",
      error: message,
      createdAt: new Date().toISOString(),
    };
  }
}
