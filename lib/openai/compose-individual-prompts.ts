import { zodTextFormat } from "openai/helpers/zod";
import type { IconManifest, IndividualIconPrompts, TokenUsage } from "@/types/icon-pipeline";
import { IndividualIconPromptsSchema } from "@/lib/icon/schemas/individual-prompts.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildIndividualPromptComposer } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";

/** Normalises the incoming value to a full data URL. */
function toDataUrl(imageBase64: string): string {
  if (imageBase64.startsWith("data:")) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
}

/**
 * Step 4 — collection image + manifest -> one prompt per icon.
 *
 * Vision call: the collection image is attached as the visual style reference and
 * the manifest is the source of truth for names/concepts. Returns the shared
 * style paragraph plus an individual prompt for each icon.
 */
export async function composeIndividualPrompts(args: {
  collectionImageBase64: string;
  manifest: IconManifest;
  model?: string;
}): Promise<{ individualPrompts: IndividualIconPrompts; usage?: TokenUsage }> {
  const client = getClient();
  const promptText = buildIndividualPromptComposer(
    JSON.stringify(args.manifest, null, 2),
  );
  const dataUrl = toDataUrl(args.collectionImageBase64);

  try {
    const res = await client.responses.parse({
      model: args.model ?? MODEL_ROLES.individualPromptModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: promptText },
            { type: "input_image", image_url: dataUrl, detail: "high" },
          ],
        },
      ],
      text: {
        format: zodTextFormat(IndividualIconPromptsSchema, "individual_icon_prompts"),
      },
    });

    const prompts = res.output_parsed;
    if (!prompts) {
      throw new IconPipelineError(
        "individual_prompts",
        "Model returned no individual prompts.",
      );
    }
    const usage: TokenUsage | undefined = res.usage
      ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
      : undefined;
    return { individualPrompts: prompts as IndividualIconPrompts, usage };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "individual_prompts",
      err instanceof Error
        ? err.message
        : "Unexpected error while composing individual prompts.",
      err,
    );
  }
}
