// Fable Bench → global gallery archiver.
//
// Every image Fable produces (uploads, improved sources, preview sheets, final
// icons) gets archived into the EXISTING asset-arsenal gallery (lib/storage),
// tagged with bench/project/step provenance so the gallery can segment by
// project. Regenerations archive the outgoing version BEFORE it is replaced,
// so history is never lost.
//
// Fire-and-forget by contract: these functions NEVER throw and never block the
// pipeline — a blocked/missing IndexedDB just logs a warning. Phase 2 wires the
// calls into use-fable at each generation point.

import type { StoredSource } from "@/lib/storage/db";
import { archiveGalleryBlob, dataUrlToBlob } from "@/lib/storage/repo";

export type ArchiveImageArgs = {
  /** The image as a data URL (Fable's persisted format). */
  dataUrl: string;
  /** Human name for the gallery tile (e.g. icon name, "sheet 2", file name). */
  name: string;
  bench: "fable";
  projectId: string;
  projectName: string;
  /** Which pipeline step produced it, e.g. "improve_source_image", "final_icon". */
  step: string;
  /**
   * Gallery category — decides where the record lands:
   * "icon" → icons store (AI-generated, checkerboard); "icon-collection" →
   * sheets; "elevated" → improved sources; "source" → user uploads.
   * (StoredSource["category"] already includes "icon"; the explicit union
   * keeps the call-site contract obvious.)
   */
  category: StoredSource["category"] | "icon";
  /** Optional generation prompt, kept on archived icon records. */
  prompt?: string;
};

/**
 * Archive one Fable image into the global gallery. Safe to call without
 * awaiting (`void archiveImage(...)`) — it swallows every failure.
 */
export async function archiveImage(args: ArchiveImageArgs): Promise<void> {
  try {
    if (!args.dataUrl) return;
    const blob = await dataUrlToBlob(args.dataUrl);
    await archiveGalleryBlob({
      blob,
      name: args.name,
      category: args.category as StoredSource["category"],
      prompt: args.prompt,
      meta: {
        bench: args.bench,
        projectId: args.projectId,
        projectName: args.projectName,
        step: args.step,
      },
    });
  } catch (err) {
    // Never let gallery archiving break (or even surface in) the pipeline.
    console.warn("[fable/gallery-sync] archiveImage failed (ignored)", err);
  }
}
