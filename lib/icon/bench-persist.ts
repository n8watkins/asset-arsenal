"use client";

// Persistence for bench outputs. The bench is a set of independent breakpoints,
// not a single linear run, so persistence is best-effort and idempotent: a
// storage failure must never break a generation, and re-running a step simply
// appends more icons under the same per-session run record.

import { saveRun, saveIcon, saveSource } from "@/lib/storage/repo";
import type {
  GeneratedIcon,
  IconManifest,
  IndividualIconPrompts,
  SourceImage,
} from "@/types/icon-pipeline";

async function attempt(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.warn(`[bench-persist] ${label} failed:`, e);
  }
}

export type BenchRunContext = {
  runId: string;
  createdAt: string;
  /** Foreign key for the run record; on the bench this is a stable session id. */
  sourceId: string;
  manifest?: IconManifest | null;
  collectionPrompt?: string | null;
  individualPrompts?: IndividualIconPrompts | null;
};

/**
 * Persist the successful icons from a bench generation (plus their parent run
 * record) to the gallery's IndexedDB. Returns how many icons were saved.
 * Best-effort: storage errors are swallowed so generation flow is never broken.
 */
export async function persistBenchIcons(
  icons: GeneratedIcon[],
  ctx: BenchRunContext,
): Promise<number> {
  const success = icons.filter((g) => g.status === "success" && g.imageUrl);
  if (success.length === 0) return 0;

  await attempt("saveRun", () =>
    saveRun({
      id: ctx.runId,
      sourceId: ctx.sourceId,
      createdAt: ctx.createdAt,
      manifest: ctx.manifest ?? undefined,
      collectionPrompt: ctx.collectionPrompt ?? undefined,
      individualPrompts: ctx.individualPrompts ?? undefined,
      iconCount: success.length,
    }),
  );

  for (const icon of success) {
    await attempt(`saveIcon ${icon.id}`, () => saveIcon(icon, ctx.runId));
  }

  return success.length;
}

/**
 * Persist a generated collection image to the gallery. It's an AI-generated
 * artifact, so it's tagged with category "icon-collection" — today the gallery
 * shows it in the "AI-generated" group; later that tag can split it into its own
 * "collections" category without a migration. Returns 1 on save, 0 otherwise.
 */
export async function persistBenchCollectionImage(
  dataUrl: string,
): Promise<number> {
  let saved = 0;
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const source: SourceImage = {
    id: crypto.randomUUID(),
    imageUrl: dataUrl,
    fileName: `collection-image-${stamp}.png`,
    uploadedAt: new Date().toISOString(),
  };
  await attempt("saveSource(collection)", async () => {
    await saveSource(source, "icon-collection");
    saved = 1;
  });
  return saved;
}
