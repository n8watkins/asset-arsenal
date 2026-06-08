import { GenerateBatchRequestSchema } from "@/lib/icon/schemas/request.schema";
import { IconPipelineError } from "@/lib/icon/errors";
import { generateIconSafe } from "@/lib/openai/generate-icon";
import { HARD_MAX_ICONS } from "@/lib/icon/models";
import type { GeneratedIcon, GenerateOneRequest } from "@/types/icon-pipeline";

const CONCURRENCY = 4;

/** Runs an array of async tasks with a bounded concurrency pool. */
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

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    worker,
  );
  await Promise.all(workers);
  return results;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = GenerateBatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: `Invalid request: ${parsed.error.issues[0]?.message ?? "validation failed."}` },
      { status: 400 },
    );
  }

  const { collectionImageBase64, individualPrompts, model, quality } = parsed.data;

  if (individualPrompts.iconPrompts.length > HARD_MAX_ICONS) {
    return Response.json(
      { error: `Batch exceeds the maximum of ${HARD_MAX_ICONS} icons per run.` },
      { status: 400 },
    );
  }

  const tasks = individualPrompts.iconPrompts.map((iconPrompt) => {
    const args: GenerateOneRequest = {
      collectionImageBase64,
      sharedStylePrompt: individualPrompts.sharedStylePrompt,
      iconPrompt,
      model,
      quality,
    };
    return () => generateIconSafe(args);
  });

  try {
    const generatedIcons = await runWithConcurrency<GeneratedIcon>(
      tasks,
      CONCURRENCY,
    );
    return Response.json({ generatedIcons });
  } catch (err) {
    console.error("[icons/generate-batch]", err);
    if (err instanceof IconPipelineError) {
      return Response.json({ error: err.message }, { status: 500 });
    }
    return Response.json(
      { error: "An unexpected error occurred during batch icon generation." },
      { status: 500 },
    );
  }
}
