// The experiment executor: run ONE cell ({model, text, optional image, settings})
// and return its output. Dispatches by the model's registered I/O signature, so
// the same entry point handles text→image, text→text, and (text+image)→text
// across OpenAI and Gemini. This is the keystone the runner UI calls per cell.

import type { TokenUsage } from "@/types/icon-pipeline";
import { getClient } from "@/lib/openai/client";
import { imageBase64ToFile } from "@/lib/openai/to-file";
import { getGeminiClient } from "@/lib/gemini/client";
import { getExperimentModel } from "./model-registry";
import { ExperimentError } from "./errors";
import {
  imageCostUSD,
  realizedTextCostUSD,
  type ImageQuality,
} from "@/lib/icon/model-reference";

export type CellSettings = {
  quality?: ImageQuality;
  background?: "auto" | "transparent" | "opaque";
  size?: string;
};

export type CellInput = {
  model: string;
  text: string;
  image?: string; // data URL or bare base64 (when the signature has image input)
  settings?: CellSettings;
};

export type CellResult = {
  kind: "text" | "image";
  text?: string;
  image?: string; // data URL
  usage?: TokenUsage;
  costUSD?: number;
};

function geminiUsage(meta: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined): TokenUsage | undefined {
  return meta
    ? { inputTokens: meta.promptTokenCount ?? 0, outputTokens: meta.candidatesTokenCount ?? 0 }
    : undefined;
}

function splitDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (m) return { mimeType: m[1], data: m[2] };
  return { mimeType: "image/png", data: dataUrl };
}

// ── OpenAI: text / vision → text ─────────────────────────────────────────────
async function runOpenAIText(input: CellInput): Promise<CellResult> {
  const client = getClient();
  const content = input.image
    ? [
        { type: "input_text" as const, text: input.text },
        {
          type: "input_image" as const,
          image_url: input.image.startsWith("data:")
            ? input.image
            : `data:image/png;base64,${input.image}`,
          detail: "auto" as const,
        },
      ]
    : input.text;

  const res = await client.responses.create({
    model: input.model,
    input: [{ role: "user", content }],
  });

  const usage: TokenUsage | undefined = res.usage
    ? { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens }
    : undefined;
  return {
    kind: "text",
    text: res.output_text?.trim() ?? "",
    usage,
    costUSD: usage ? realizedTextCostUSD(input.model, usage) : undefined,
  };
}

// ── Gemini: text / (text+image) → text ───────────────────────────────────────
async function runGeminiText(input: CellInput): Promise<CellResult> {
  const ai = getGeminiClient();
  const parts: ({ text: string } | { inlineData: { mimeType: string; data: string } })[] = [
    { text: input.text },
  ];
  if (input.image) {
    const { mimeType, data } = splitDataUrl(input.image);
    parts.push({ inlineData: { mimeType, data } });
  }
  const res = await ai.models.generateContent({
    model: input.model,
    contents: [{ role: "user", parts }],
  });
  return {
    kind: "text",
    text: res.text?.trim() ?? "",
    usage: geminiUsage(res.usageMetadata),
    costUSD: 0, // Gemini judging is free here
  };
}

// ── OpenAI: text (+ optional reference image) → image ────────────────────────
async function runOpenAIImage(input: CellInput): Promise<CellResult> {
  const client = getClient();
  const quality: ImageQuality = input.settings?.quality ?? "medium";
  const size = input.settings?.size ?? "1024x1024";
  const background = input.settings?.background ?? "auto";

  let b64: string | undefined;
  if (input.image) {
    const file = await imageBase64ToFile(input.image, "reference.png");
    const res = await client.images.edit({
      model: input.model,
      image: file,
      prompt: input.text,
      n: 1,
      size,
      background,
      quality,
    });
    b64 = res.data?.[0]?.b64_json;
  } else {
    const res = await client.images.generate({
      model: input.model,
      prompt: input.text,
      n: 1,
      size,
      background,
      quality,
    });
    b64 = res.data?.[0]?.b64_json;
  }

  if (!b64) throw new ExperimentError("No image was returned.");
  return {
    kind: "image",
    image: `data:image/png;base64,${b64}`,
    costUSD: imageCostUSD(input.model, quality, 1),
  };
}

/** Run a single experiment cell. Throws ExperimentError / provider errors. */
export async function runCell(input: CellInput): Promise<CellResult> {
  const model = getExperimentModel(input.model);
  if (!model) throw new ExperimentError(`Unknown model: ${input.model}`);

  if (model.output === "image") return runOpenAIImage(input);
  if (model.provider === "google") return runGeminiText(input);
  return runOpenAIText(input);
}
