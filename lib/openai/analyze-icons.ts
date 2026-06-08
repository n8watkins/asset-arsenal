import { zodTextFormat } from "openai/helpers/zod";
import type { IconManifest } from "@/types/icon-pipeline";
import { IconManifestSchema } from "@/lib/icon/schemas/icon-manifest.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { ICON_ANALYSIS_PROMPT } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";

/** Normalises the incoming value to a full data URL. */
function toDataUrl(imageBase64: string): string {
  if (imageBase64.startsWith("data:")) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
}

/** Step 1 — source image -> icon manifest. */
export async function analyzeIcons(
  imageBase64: string,
  _fileName?: string,
  opts?: { model?: string },
): Promise<IconManifest> {
  const client = getClient();
  const dataUrl = toDataUrl(imageBase64);

  try {
    const res = await client.responses.parse({
      model: opts?.model ?? MODEL_ROLES.visionAnalyzerModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: ICON_ANALYSIS_PROMPT },
            { type: "input_image", image_url: dataUrl, detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(IconManifestSchema, "icon_manifest") },
    });

    const manifest = res.output_parsed;
    if (!manifest) {
      throw new IconPipelineError("analysis", "Model returned no manifest.");
    }
    return manifest as IconManifest;
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "analysis",
      err instanceof Error ? err.message : "Unexpected error during icon analysis.",
      err,
    );
  }
}
