import { zodTextFormat } from "openai/helpers/zod";
import type { IconManifest, IconPromptPack } from "@/types/icon-pipeline";
import { IconPromptPackSchema } from "@/lib/icon/schemas/icon-prompts.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildPromptPackPrompt } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";

export async function generateIconPrompts(
  manifest: IconManifest,
): Promise<IconPromptPack> {
  const client = getClient();
  const promptText = buildPromptPackPrompt(
    manifest.iconFamilyStyle,
    JSON.stringify(manifest),
  );

  try {
    const res = await client.responses.parse({
      model: MODEL_ROLES.promptWriterModel,
      input: [{ role: "user", content: promptText }],
      text: { format: zodTextFormat(IconPromptPackSchema, "icon_prompt_pack") },
    });

    const promptPack = res.output_parsed;
    if (!promptPack) {
      throw new IconPipelineError(
        "prompt_generation",
        "Model returned no prompt pack.",
      );
    }

    return promptPack as IconPromptPack;
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "prompt_generation",
      err instanceof Error
        ? err.message
        : "Unexpected error during prompt generation.",
      err,
    );
  }
}
