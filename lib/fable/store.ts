// Fable Bench — IndexedDB persistence.
//
// A NEW database "fable-bench" with one object store "projects" keyed by id and
// indexed by-updatedAt. This is deliberately separate from the existing
// "asset-arsenal" DB (lib/storage/db.ts) — we never touch that one.
//
// Projects embed data-URL images directly inside the JSON, so we store the whole
// FableProject object as-is. Best-effort error handling: failures are swallowed
// (logged) so a missing/blocked IndexedDB never crashes the workspace.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  approvedSource,
  DEFAULT_FABLE_MODEL_CONFIG,
  type FableProject,
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

interface FableBenchDB extends DBSchema {
  projects: {
    key: string;
    value: FableProject;
    indexes: { "by-updatedAt": string };
  };
}

let _dbPromise: Promise<IDBPDatabase<FableBenchDB>> | null = null;

function getDB(): Promise<IDBPDatabase<FableBenchDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "Fable Bench: IndexedDB is not available. The store must only be used in a browser context.",
    );
  }
  if (!_dbPromise) {
    _dbPromise = openDB<FableBenchDB>("fable-bench", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("projects")) {
          const store = db.createObjectStore("projects", { keyPath: "id" });
          store.createIndex("by-updatedAt", "updatedAt");
        }
      },
    });
  }
  return _dbPromise;
}

/** Records persisted before `models` existed get the defaults backfilled. */
function withDefaults(p: FableProject): FableProject {
  return p.models ? p : { ...p, models: { ...DEFAULT_FABLE_MODEL_CONFIG } };
}

/** An empty leftover row: never got a message or an image — not worth keeping. */
function isEmptyProject(p: FableProject): boolean {
  return p.events.length === 0 && !p.original && p.improved.length === 0;
}

/** Persist the whole project as-is (data URLs included). Best-effort. */
export async function saveProject(p: FableProject): Promise<void> {
  try {
    const db = await getDB();
    await db.put("projects", p);
  } catch (err) {
    console.error("[fable/store] saveProject failed", err);
  }
}

/** Load one project by id, or null if missing / on error. */
export async function loadProject(id: string): Promise<FableProject | null> {
  try {
    const db = await getDB();
    const p = await db.get("projects", id);
    return p ? withDefaults(p) : null;
  } catch (err) {
    console.error("[fable/store] loadProject failed", err);
    return null;
  }
}

/** Newest-first lightweight summaries for the Projects panel. Empty leftover
 *  rows (no events, no image) are garbage-collected on the way through. */
export async function listProjects(): Promise<FableProjectSummary[]> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex("projects", "by-updatedAt");
    const empties = all.filter(isEmptyProject);
    for (const p of empties) void db.delete("projects", p.id);
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
    const db = await getDB();
    const all = await db.getAll("projects");
    return all.map((p) => ({ projectId: p.id, usage: p.usage ?? [] }));
  } catch (err) {
    console.error("[fable/store] getAllUsage failed", err);
    return [];
  }
}

/** Delete a project. Best-effort. */
export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("projects", id);
  } catch (err) {
    console.error("[fable/store] deleteProject failed", err);
  }
}
