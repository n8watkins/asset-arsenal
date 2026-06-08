import { GenerateIconsBatchRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { generateIconSafe } from "@/lib/openai/generate-icon";
import { HARD_MAX_ICONS } from "@/lib/icon/models";
import type { GeneratedIcon, GenerateIconRequest } from "@/types/icon-pipeline";

const CONCURRENCY = 4;

/**
 * Runs an array of async tasks with a bounded concurrency pool.
 */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, worker);
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  // 1. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  // 2. Validate shape
  const parsed = GenerateIconsBatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { manifest, promptPack } = parsed.data;

  // 3. Guard: hard max
  if (promptPack.prompts.length > HARD_MAX_ICONS) {
    return Response.json(
      { error: `Batch exceeds the maximum of ${HARD_MAX_ICONS} icons per run.` },
      { status: 400 },
    );
  }

  // 4. Build per-icon GenerateIconRequest by matching prompt.iconId to manifest icon.
  const iconById = new Map(manifest.icons.map((ic) => [ic.id, ic]));

  const tasks = promptPack.prompts.map((prompt) => {
    const icon = iconById.get(prompt.iconId);
    if (!icon) {
      // Return a pre-failed result for prompts with no matching manifest icon.
      return (): Promise<GeneratedIcon> =>
        Promise.resolve({
          id: crypto.randomUUID(),
          iconId: prompt.iconId,
          iconName: prompt.iconName,
          prompt: prompt.prompt,
          imageUrl: "",
          modelUsed: "",
          status: "failed" as const,
          error: `No manifest icon found for iconId "${prompt.iconId}".`,
          createdAt: new Date().toISOString(),
        });
    }

    const args: GenerateIconRequest = {
      icon,
      prompt,
      iconFamilyStyle: manifest.iconFamilyStyle,
    };
    return () => generateIconSafe(args);
  });

  // 5. Run with bounded concurrency
  try {
    const generatedIcons = await runWithConcurrency(tasks, CONCURRENCY);
    return Response.json({ generatedIcons });
  } catch (err) {
    // generateIconSafe doesn't throw, but the pool infrastructure could.
    console.error("[generate-icons-batch]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during batch icon generation." },
      { status: 500 },
    );
  }
}
