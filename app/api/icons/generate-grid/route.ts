import { GenerateGridRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { generateGridImage } from "@/lib/openai/generate-grid";
import { buildGridGenerationPrompt } from "@/lib/icon/prompts";
import { sliceGrid } from "@/lib/icon/slice-grid";
import { MODEL_ROLES } from "@/lib/icon/models";
import type { GeneratedIcon } from "@/types/icon-pipeline";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = GenerateGridRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { referenceImageBase64, sharedStylePrompt, icons, rows, cols, mode, model, quality } =
    parsed.data;

  if (icons.length > rows * cols) {
    return Response.json(
      { error: `Too many icons (${icons.length}) for a ${rows}×${cols} grid (${rows * cols} cells).` },
      { status: 400 },
    );
  }

  const usedModel = model ?? MODEL_ROLES.imageGeneratorModel;

  try {
    const prompt = buildGridGenerationPrompt({
      rows,
      cols,
      sharedStylePrompt,
      icons: icons.map((i) => ({ name: i.iconName, concept: i.concept, prompt: i.prompt })),
    });

    const { imageBase64 } = await generateGridImage({
      referenceImageBase64,
      prompt,
      model: usedModel,
      quality,
    });

    const buffer = Buffer.from(imageBase64.split(",")[1] ?? "", "base64");
    const sliced = await sliceGrid(buffer, { rows, cols, mode });

    const now = new Date().toISOString();
    const generatedIcons: GeneratedIcon[] = sliced.slices.map((slice, i) => {
      const src = icons[i];
      return {
        id: crypto.randomUUID(),
        iconId: src?.iconId ?? `slice_${i + 1}`,
        iconName: src?.iconName ?? `icon ${i + 1}`,
        prompt: src?.prompt ?? "",
        imageUrl: slice.pngBase64,
        modelUsed: usedModel,
        status: "success",
        createdAt: now,
      };
    });

    return Response.json({
      gridImageBase64: imageBase64,
      generatedIcons,
      expectedCount: icons.length,
      detectedCount: sliced.detectedCount,
      mode: sliced.mode,
    });
  } catch (err) {
    console.error("[icons/generate-grid]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during grid generation." },
      { status: 500 },
    );
  }
}
