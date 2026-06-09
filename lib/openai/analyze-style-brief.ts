import { zodTextFormat } from "openai/helpers/zod";
import type { StyleBrief, TokenUsage } from "@/types/icon-pipeline";
import { StyleBriefSchema } from "@/lib/icon/schemas/style-brief.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildStyleBriefPrompt } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";

function toDataUrl(imageBase64: string): string {
  if (imageBase64.startsWith("data:")) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
}

/** Bench S step 1 — source image -> style brief (vision). */
export async function analyzeStyleBrief(
  imageBase64: string,
  opts?: { model?: string },
): Promise<{ brief: StyleBrief; usage?: TokenUsage }> {
  const client = getClient();
  const dataUrl = toDataUrl(imageBase64);

  try {
    const res = await client.responses.parse({
      model: opts?.model ?? MODEL_ROLES.visionAnalyzerModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildStyleBriefPrompt() },
            { type: "input_image", image_url: dataUrl, detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(StyleBriefSchema, "style_brief") },
    });

    const brief = res.output_parsed;
    if (!brief) {
      throw new IconPipelineError("analysis", "Model returned no style brief.");
    }
    const usage: TokenUsage | undefined = res.usage
      ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
      : undefined;
    return { brief: brief as StyleBrief, usage };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "analysis",
      err instanceof Error ? err.message : "Unexpected error during style-brief analysis.",
      err,
    );
  }
}
