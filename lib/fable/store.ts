// Fable Bench — IndexedDB persistence.
//
// The database "fable-bench" (deliberately separate from the existing
// "asset-arsenal" DB in lib/storage/db.ts — we never touch that one) holds
// "projects" (the JSON documents) plus "images" (raw blobs, owned by
// lib/fable/images.ts — the shared connection lives there too).
//
// Image fields on the document are opaque refs ("idb-image:<uuid>") into the
// blob store; legacy projects still embed data URLs and are migrated lazily on
// open (migrateProjectImages). saveProject deliberately accepts EITHER shape —
// an old in-memory project mid-session may still carry data URLs, and
// stripping them synchronously here would risk losing pixels.
//
// Best-effort error handling: failures are swallowed (logged) so a
// missing/blocked IndexedDB never crashes the workspace.

import { deleteImagesForProject, getFableDB, putImageDataUrl } from "./images";
import {
  approvedSource,
  DEFAULT_FABLE_MODEL_CONFIG,
  type FableEvent,
  type FableProject,
  type FableSourceImage,
  type FableStage,
  type FableUsageRecord,
} from "./types";

// Lightweight summary returned by listProjects() for the Projects panel.
export type FableProjectSummary = {
  id: string;
  name: string;
  stage: FableStage;
  updatedAt: string;
  thumbUrl: string | null;
  counts: {
    candidates: number;
    sheets: number;
    finals: number;
  };
};

/** Records persisted before `models` existed get the defaults backfilled. */
function withDefaults(p: FableProject): FableProject {
  return p.models ? p : { ...p, models: { ...DEFAULT_FABLE_MODEL_CONFIG } };
}

/** An empty leftover row: never got a message or an image — not worth keeping. */
function isEmptyProject(p: FableProject): boolean {
  return p.events.length === 0 && !p.original && p.improved.length === 0;
}

/** Persist the whole project as-is. Best-effort. Safety net: image fields are
 *  normally refs, but a document still carrying raw `data:` URLs (an old
 *  in-memory project mid-session) is saved verbatim — never stripped
 *  synchronously; it gets slimmed by migrateProjectImages on its next open. */
export async function saveProject(p: FableProject): Promise<void> {
  try {
    const db = await getFableDB();
    await db.put("projects", p);
  } catch (err) {
    console.error("[fable/store] saveProject failed", err);
  }
}

/** Lazy migration: move every embedded `data:` image (original, improved[],
 *  sheets[], finals[], user_message events) into the blob store and replace it
 *  with a ref. Candidate sourceCrops stay inline by design (≤256px, tiny).
 *  Best-effort per image: a failed blob write keeps that data URL inline. */
export async function migrateProjectImages(
  p: FableProject,
): Promise<{ project: FableProject; changed: boolean }> {
  let changed = false;
  const put = async (dataUrl: string): Promise<string> => {
    try {
      const ref = await putImageDataUrl(p.id, dataUrl);
      changed = true;
      return ref;
    } catch (err) {
      console.error("[fable/store] image migration write failed — keeping inline", err);
      return dataUrl;
    }
  };
  const migrateSource = async (s: FableSourceImage): Promise<FableSourceImage> =>
    s.imageUrl.startsWith("data:") ? { ...s, imageUrl: await put(s.imageUrl) } : s;

  const original = p.original ? await migrateSource(p.original) : p.original;
  const improved: FableSourceImage[] = [];
  for (const s of p.improved) improved.push(await migrateSource(s));
  const sheets = [];
  for (const s of p.sheets) {
    sheets.push(s.imageUrl.startsWith("data:") ? { ...s, imageUrl: await put(s.imageUrl) } : s);
  }
  const finals = [];
  for (const f of p.finals) {
    finals.push(f.imageUrl.startsWith("data:") ? { ...f, imageUrl: await put(f.imageUrl) } : f);
  }
  const events: FableEvent[] = [];
  for (const e of p.events) {
    events.push(
      e.kind === "user_message" && e.imageUrl?.startsWith("data:")
        ? { ...e, imageUrl: await put(e.imageUrl) }
        : e,
    );
  }
  if (!changed) return { project: p, changed: false };
  return { project: { ...p, original, improved, sheets, finals, events }, changed: true };
}

/** Load one project by id, or null if missing / on error. This is the
 *  open-for-editing path (Sidebar → openProject), so legacy embedded data-URL
 *  images are migrated to blob refs here and the slimmed document persisted
 *  immediately. listProjects deliberately does NOT migrate (cheap listing). */
export async function loadProject(id: string): Promise<FableProject | null> {
  try {
    const db = await getFableDB();
    const p = await db.get("projects", id);
    if (!p) return null;
    const { project, changed } = await migrateProjectImages(withDefaults(p));
    if (changed) await db.put("projects", project);
    return project;
  } catch (err) {
    console.error("[fable/store] loadProject failed", err);
    return null;
  }
}

/** Newest-first lightweight summaries for the Projects panel. Empty leftover
 *  rows (no events, no image) are garbage-collected on the way through. */
export async function listProjects(): Promise<FableProjectSummary[]> {
  try {
    const db = await getFableDB();
    const all = await db.getAllFromIndex("projects", "by-updatedAt");
    const empties = all.filter(isEmptyProject);
    for (const p of empties) {
      void db.delete("projects", p.id);
      void deleteImagesForProject(p.id); // mirror the project-delete cleanup
    }
    return all
      .filter((p) => !isEmptyProject(p))
      .slice()
      .reverse() // by-updatedAt is ascending; we want newest first
      .map((p) => {
        const thumb = approvedSource(p) ?? p.original ?? p.improved[0] ?? null;
        return {
          id: p.id,
          name: p.name,
          stage: p.stage,
          updatedAt: p.updatedAt,
          thumbUrl: thumb?.imageUrl ?? null,
          counts: {
            candidates: p.candidates.filter((c) => c.status === "active").length,
            sheets: p.sheets.filter((s) => s.status !== "superseded").length,
            finals: p.finals.filter((f) => f.status === "success").length,
          },
        };
      });
  } catch (err) {
    console.error("[fable/store] listProjects failed", err);
    return [];
  }
}

/** Per-project usage ledgers across every saved project (for the Usage panel).
 *  The caller merges in the live in-memory project (which may be ahead of, or
 *  absent from, the store). */
export type FableProjectUsage = { projectId: string; usage: FableUsageRecord[] };

export async function getAllUsage(): Promise<FableProjectUsage[]> {
  try {
    const db = await getFableDB();
    const all = await db.getAll("projects");
    return all.map((p) => ({ projectId: p.id, usage: p.usage ?? [] }));
  } catch (err) {
    console.error("[fable/store] getAllUsage failed", err);
    return [];
  }
}

// ---- Recent images (for the composer plus-menu "Recent"; wired in Phase 2) --

/** One recent image across all fable projects. */
export type FableRecentImage = {
  projectId: string;
  projectName: string;
  kind: "source" | "sheet" | "final";
  name: string;
  /** Image ref ("idb-image:<id>") for migrated projects, or a data URL for
   *  legacy ones — consumers resolve via lib/fable/images (getDisplayUrl for
   *  thumbnails, resolveToBlob to attach). */
  imageUrl: string;
  createdAt: string;
};

/** Newest-first images (sources, sheets, successful finals) across every saved
 *  project. `imageUrl` values are refs-or-data-urls — see FableRecentImage.
 *  Best-effort: returns [] on error. */
export async function listRecentImages(limit = 12): Promise<FableRecentImage[]> {
  try {
    const db = await getFableDB();
    const all = await db.getAll("projects");
    const out: FableRecentImage[] = [];
    for (const p of all) {
      if (p.original?.imageUrl) {
        out.push({
          projectId: p.id,
          projectName: p.name,
          kind: "source",
          name: p.original.fileName ?? "original source",
          imageUrl: p.original.imageUrl,
          createdAt: p.original.createdAt,
        });
      }
      for (const s of p.improved) {
        if (!s.imageUrl) continue;
        out.push({
          projectId: p.id,
          projectName: p.name,
          kind: "source",
          name: "improved source",
          imageUrl: s.imageUrl,
          createdAt: s.createdAt,
        });
      }
      for (const sh of p.sheets) {
        if (!sh.imageUrl) continue;
        out.push({
          projectId: p.id,
          projectName: p.name,
          kind: "sheet",
          name: `sheet ${sh.index}`,
          imageUrl: sh.imageUrl,
          createdAt: sh.createdAt,
        });
      }
      for (const f of p.finals) {
        if (f.status !== "success" || !f.imageUrl) continue;
        out.push({
          projectId: p.id,
          projectName: p.name,
          kind: "final",
          name: f.name,
          imageUrl: f.imageUrl,
          createdAt: f.createdAt,
        });
      }
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return out.slice(0, limit);
  } catch (err) {
    console.error("[fable/store] listRecentImages failed", err);
    return [];
  }
}

/** Delete a project AND its stored image blobs. Best-effort. */
export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await getFableDB();
    await db.delete("projects", id);
    await deleteImagesForProject(id);
  } catch (err) {
    console.error("[fable/store] deleteProject failed", err);
  }
}
