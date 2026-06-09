import { zodTextFormat } from "openai/helpers/zod";
import type { MegaAnalysis, TokenUsage } from "@/types/icon-pipeline";
import { MegaAnalysisSchema } from "@/lib/icon/schemas/mega-analysis.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { buildMegaAnalysisComposer } from "@/lib/icon/prompts";
import { MODEL_ROLES } from "@/lib/icon/models";
import { getClient } from "./client";

/** Normalises the incoming value to a full data URL. */
function toDataUrl(imageBase64: string): string {
  if (imageBase64.startsWith("data:")) return imageBase64;
  return `data:image/png;base64,${imageBase64}`;
}

/**
 * Bench V2 — collapsed §1+§2+§4 in a single vision pass.
 *
 * The model reads the source image once and returns the full manifest, the
 * shared style paragraph, and a ready-to-generate prompt for every icon — all
 * grounded only in the source image (there is no collection image in V2).
 */
export async function megaAnalyze(
  imageBase64: string,
  _fileName?: string,
  opts?: { model?: string },
): Promise<{ analysis: MegaAnalysis; usage?: TokenUsage }> {
  const client = getClient();
  const dataUrl = toDataUrl(imageBase64);

  try {
    const res = await client.responses.parse({
      model: opts?.model ?? MODEL_ROLES.visionAnalyzerModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildMegaAnalysisComposer() },
            { type: "input_image", image_url: dataUrl, detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(MegaAnalysisSchema, "mega_analysis") },
    });

    const analysis = res.output_parsed;
    if (!analysis) {
      throw new IconPipelineError("analysis", "Model returned no analysis.");
    }
    const usage: TokenUsage | undefined = res.usage
      ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
      : undefined;
    return { analysis: analysis as MegaAnalysis, usage };
  } catch (err) {
    if (err instanceof IconPipelineError) throw err;
    throw new IconPipelineError(
      "analysis",
      err instanceof Error ? err.message : "Unexpected error during mega-analysis.",
      err,
    );
  }
}
