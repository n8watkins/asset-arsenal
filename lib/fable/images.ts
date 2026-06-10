// Fable Bench — image blob store + ref resolver.
//
// Project documents used to embed every image as a multi-MB base64 data URL,
// so each debounced autosave rewrote megabytes of JSON. Images now live in a
// separate IndexedDB object store ("images") keyed by id, and project
// documents hold only opaque refs ("idb-image:<uuid>"). This indirection is
// deliberate future-proofing: when the doc later lives in Turso and the bytes
// in object storage, only this resolver layer changes — callers keep using
// useObjectUrl / resolveToDataUrl / resolveToBlob exactly as today.
//
// INVARIANT: a ref must never be sent to an API route or the gallery, and
// never rendered raw into an <img src> — always resolve first.
//
// This module also owns the shared "fable-bench" DB connection. It moved here
// from store.ts (a documented deviation) so the dependency graph stays
// one-directional (types ← images ← store) instead of store ↔ images circular,
// and so both object stores share one versioned upgrade path.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { FableProject } from "./types";

export const IMAGE_REF_PREFIX = "idb-image:";

/** True when the value is an opaque image ref ("idb-image:<uuid>"). */
export function isImageRef(v: string | null | undefined): boolean {
  return typeof v === "string" && v.startsWith(IMAGE_REF_PREFIX);
}

/** One stored image: raw bytes + the owning project (for bulk deletion). */
export type StoredImage = {
  id: string;
  projectId: string;
  blob: Blob;
  createdAt: string;
};

export interface FableBenchDB extends DBSchema {
  projects: {
    key: string;
    value: FableProject;
    indexes: { "by-updatedAt": string };
  };
  images: {
    key: string;
    value: StoredImage;
    indexes: { byProject: string };
  };
}

let _dbPromise: Promise<IDBPDatabase<FableBenchDB>> | null = null;

/** The shared "fable-bench" connection (projects + images). v1 created the
 *  projects store; v2 adds images. The upgrade keeps existing stores intact
 *  and creates whatever is missing, so fresh installs jump straight to v2. */
export function getFableDB(): Promise<IDBPDatabase<FableBenchDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "Fable Bench: IndexedDB is not available. The store must only be used in a browser context.",
    );
  }
  if (!_dbPromise) {
    _dbPromise = openDB<FableBenchDB>("fable-bench", 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          const store = db.createObjectStore("projects", { keyPath: "id" });
          store.createIndex("by-updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains("images")) {
          const store = db.createObjectStore("images", { keyPath: "id" });
          store.createIndex("byProject", "projectId");
        }
      },
    });
  }
  return _dbPromise;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

/** Store raw image bytes under `projectId`; returns the opaque ref. */
export async function putImageBlob(projectId: string, blob: Blob): Promise<string> {
  const db = await getFableDB();
  const id = crypto.randomUUID();
  await db.put("images", {
    id,
    projectId,
    blob,
    createdAt: new Date().toISOString(),
  });
  return IMAGE_REF_PREFIX + id;
}

/** Store a data URL's bytes under `projectId`; returns the opaque ref. */
export async function putImageDataUrl(projectId: string, dataUrl: string): Promise<string> {
  return putImageBlob(projectId, await dataUrlToBlob(dataUrl));
}

// ---------------------------------------------------------------------------
// Reads / resolution
// ---------------------------------------------------------------------------

async function getStored(ref: string): Promise<StoredImage | undefined> {
  const db = await getFableDB();
  return db.get("images", ref.slice(IMAGE_REF_PREFIX.length));
}

/** Bytes for a ref (null when the record is missing) or a data URL (converted).
 *  Other inputs (http/object URLs) are fetched best-effort; empty → null. */
export async function resolveToBlob(refOrUrl: string): Promise<Blob | null> {
  if (!refOrUrl) return null;
  if (isImageRef(refOrUrl)) return (await getStored(refOrUrl))?.blob ?? null;
  if (refOrUrl.startsWith("data:")) return dataUrlToBlob(refOrUrl);
  try {
    return await (await fetch(refOrUrl)).blob();
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the stored image."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

/** Data URL for a ref (FileReader over the stored blob). Non-ref inputs
 *  (data:/http/empty) pass through unchanged. Throws on a missing record —
 *  API request builders must surface that, not silently send a ref. */
export async function resolveToDataUrl(refOrUrl: string): Promise<string> {
  if (!isImageRef(refOrUrl)) return refOrUrl;
  const stored = await getStored(refOrUrl);
  if (!stored) {
    throw new Error(
      `Stored image "${refOrUrl}" is missing from this browser's image store — it may have been deleted with its project.`,
    );
  }
  return blobToDataUrl(stored.blob);
}

// ref → object URL, created once per session. INTENTIONAL modest leak: cached
// URLs are never revoked while cached (revoking would blank every <img> still
// pointing at one), so a session holds one object URL per distinct image
// viewed — a small, bounded cost. Entries ARE revoked + dropped when their
// project's images are deleted (deleteImagesForProject). The cache stores
// promises so concurrent callers share one lookup / one URL.
const displayUrlCache = new Map<string, Promise<string>>();

/** Display URL for an <img src>: refs resolve to a session-cached object URL;
 *  anything else (data:/http) returns as-is — callers using useObjectUrl keep
 *  handling revocation of data-URL-derived object URLs themselves, as today. */
export function getDisplayUrl(refOrUrl: string): Promise<string> {
  if (!isImageRef(refOrUrl)) return Promise.resolve(refOrUrl);
  const hit = displayUrlCache.get(refOrUrl);
  if (hit) return hit;
  const promise = (async () => {
    const stored = await getStored(refOrUrl);
    if (!stored) {
      throw new Error(`Stored image "${refOrUrl}" is missing from this browser's image store.`);
    }
    return URL.createObjectURL(stored.blob);
  })();
  // A failed lookup must not poison the cache — drop it so retries can work.
  promise.catch(() => displayUrlCache.delete(refOrUrl));
  displayUrlCache.set(refOrUrl, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

/** Delete every stored image owned by `projectId` (byProject index scan), and
 *  revoke + drop any display object URLs cached for them. Best-effort. */
export async function deleteImagesForProject(projectId: string): Promise<void> {
  try {
    const db = await getFableDB();
    const ids = await db.getAllKeysFromIndex("images", "byProject", projectId);
    const tx = db.transaction("images", "readwrite");
    for (const id of ids) {
      void tx.store.delete(id);
      const ref = IMAGE_REF_PREFIX + id;
      const cached = displayUrlCache.get(ref);
      if (cached) {
        displayUrlCache.delete(ref);
        cached.then((url) => URL.revokeObjectURL(url)).catch(() => {});
      }
    }
    await tx.done;
  } catch (err) {
    console.error("[fable/images] deleteImagesForProject failed", err);
  }
}
