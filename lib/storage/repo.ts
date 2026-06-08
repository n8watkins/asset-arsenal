/**
 * Typed repository layer over IndexedDB for Asset Arsenal.
 * All functions are async and browser-only (they all call getDB() internally).
 * Data URLs are converted to/from Blobs here — callers pass/receive plain data.
 */

import { getDB, StoredSource, StoredRun, StoredIcon } from "@/lib/storage/db";
import type { SourceImage, GeneratedIcon } from "@/types/icon-pipeline";

// ---- Helpers ----

/** Convert a data URL to a Blob via fetch (works in any modern browser). */
export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** Create a fresh object URL from a Blob. Caller is responsible for revoking it. */
export function blobToObjectUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/** Read a Blob back to a data URL. */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ---- Sources ----

/**
 * Persist a SourceImage. Converts imageUrl (data URL or object URL) → Blob.
 * Note: if imageUrl is an object URL (blob:...) it is still fetchable in the
 * same tab, so fetch() handles both forms correctly.
 */
export async function saveSource(
  source: SourceImage,
  category?: "source" | "icon-collection" | "icon"
): Promise<void> {
  const blob = await dataUrlToBlob(source.imageUrl);
  const db = await getDB();
  const record: StoredSource = {
    id: source.id,
    fileName: source.fileName,
    mimeType: source.mimeType,
    width: source.width,
    height: source.height,
    uploadedAt: source.uploadedAt,
    category,
    blob,
  };
  await db.put("sources", record);
}

/** List all sources, newest first, each with a fresh object URL. */
export async function listSources(): Promise<
  Array<StoredSource & { objectUrl: string }>
> {
  const db = await getDB();
  const all = await db.getAll("sources");
  all.sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  return all.map((s) => ({ ...s, objectUrl: blobToObjectUrl(s.blob) }));
}

/** Get a single source record (no object URL — caller decides). */
export async function getSource(
  id: string
): Promise<StoredSource | undefined> {
  const db = await getDB();
  return db.get("sources", id);
}

/**
 * Get a source's image as a data URL (needed for re-sending to the API as
 * base64). Returns undefined if the source doesn't exist.
 */
export async function getSourceAsDataUrl(
  id: string
): Promise<string | undefined> {
  const record = await getSource(id);
  if (!record) return undefined;
  return blobToDataUrl(record.blob);
}

/** Delete a source record. Does NOT cascade-delete runs or icons. */
export async function deleteSource(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("sources", id);
}

// ---- Runs ----

export type SaveRunInput = {
  id: string;
  sourceId: string;
  createdAt: string;
  manifest?: StoredRun["manifest"];
  promptPack?: StoredRun["promptPack"];
  iconCount: number;
};

/** Persist or update a run record. */
export async function saveRun(run: SaveRunInput): Promise<void> {
  const db = await getDB();
  const record: StoredRun = {
    id: run.id,
    sourceId: run.sourceId,
    createdAt: run.createdAt,
    manifest: run.manifest,
    promptPack: run.promptPack,
    iconCount: run.iconCount,
  };
  await db.put("runs", record);
}

/** List all runs, newest first. */
export async function listRuns(): Promise<StoredRun[]> {
  const db = await getDB();
  const all = await db.getAll("runs");
  all.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return all;
}

/** Get a single run record. */
export async function getRun(id: string): Promise<StoredRun | undefined> {
  const db = await getDB();
  return db.get("runs", id);
}

/**
 * Delete a run and all of its icons (cascading delete).
 */
export async function deleteRun(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["runs", "icons"], "readwrite");

  // Gather icon IDs for this run
  const iconIndex = tx.objectStore("icons").index("by-run");
  const iconKeys = await iconIndex.getAllKeys(id);

  // Delete all icons
  await Promise.all(
    iconKeys.map((key) => tx.objectStore("icons").delete(key))
  );

  // Delete the run itself
  await tx.objectStore("runs").delete(id);
  await tx.done;
}

// ---- Icons ----

/**
 * Persist a generated icon. Only icons with status "success" and a non-empty
 * imageUrl are accepted; throws clearly otherwise.
 */
export async function saveIcon(
  icon: GeneratedIcon,
  runId: string
): Promise<void> {
  if (icon.status !== "success") {
    throw new Error(
      `saveIcon: cannot persist icon "${icon.id}" with status "${icon.status}" — only "success" icons may be stored.`
    );
  }
  if (!icon.imageUrl) {
    throw new Error(
      `saveIcon: cannot persist icon "${icon.id}" — imageUrl is empty.`
    );
  }

  const blob = await dataUrlToBlob(icon.imageUrl);
  const db = await getDB();
  const record: StoredIcon = {
    id: icon.id,
    runId,
    iconId: icon.iconId,
    iconName: icon.iconName,
    prompt: icon.prompt,
    modelUsed: icon.modelUsed,
    status: icon.status,
    createdAt: icon.createdAt,
    blob,
  };
  await db.put("icons", record);
}

/** List all icons, newest first, each with a fresh object URL. */
export async function listIcons(): Promise<
  Array<StoredIcon & { objectUrl: string }>
> {
  const db = await getDB();
  const all = await db.getAll("icons");
  all.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return all.map((ic) => ({ ...ic, objectUrl: blobToObjectUrl(ic.blob) }));
}

/** Get all icons belonging to a specific run, newest first, with object URLs. */
export async function getIconsByRun(
  runId: string
): Promise<Array<StoredIcon & { objectUrl: string }>> {
  const db = await getDB();
  const all = await db.getAllFromIndex("icons", "by-run", runId);
  all.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return all.map((ic) => ({ ...ic, objectUrl: blobToObjectUrl(ic.blob) }));
}

/**
 * Get a single icon's image as a data URL (useful for re-sending to generation
 * or downloading). Returns undefined if the icon doesn't exist.
 */
export async function getIconAsDataUrl(
  id: string
): Promise<string | undefined> {
  const db = await getDB();
  const record = await db.get("icons", id);
  if (!record) return undefined;
  return blobToDataUrl(record.blob);
}

/** Delete a single icon record. */
export async function deleteIcon(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("icons", id);
}

// ---- Reset ----

/** Clear all stored data (sources, runs, and icons). */
export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["sources", "runs", "icons"], "readwrite");
  await Promise.all([
    tx.objectStore("sources").clear(),
    tx.objectStore("runs").clear(),
    tx.objectStore("icons").clear(),
  ]);
  await tx.done;
}
