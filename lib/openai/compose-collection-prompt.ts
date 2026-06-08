import type { IconManifest } from "@/types/icon-pipeline";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildCollectionPromptComposer } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";

/**
 * Step 2 — icon manifest -> a single icon collection image prompt.
 *
 * This is a text-only call. The composer is instructed to return only the
 * final image-generation prompt text (no JSON), so we read output_text.
 */
export async function composeCollectionPrompt(
  manifest: IconManifest,
): Promise<string> {
  const client = getClient();
  const input = buildCollectionPromptComposer(JSON.stringify(manifest, null, 2));

  try {
    const res = await client.responses.create({
      model: MODEL_ROLES.collectionPromptModel,
      input: [{ role: "user", content: input }],
    });

    const collectionPrompt = res.output_text?.trim();
    if (!collectionPrompt) {
      throw new IconPipelineError(
        "collection_prompt",
        "Model returned no collection prompt.",
      );
    }
    return collectionPrompt;
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "collection_prompt",
      err instanceof Error
        ? err.message
        : "Unexpected error while composing the collection prompt.",
      err,
    );
  }
}
