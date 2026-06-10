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
import { approvedSource, type FableProject, type FableStage } from "./types";

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
    return (await db.get("projects", id)) ?? null;
  } catch (err) {
    console.error("[fable/store] loadProject failed", err);
    return null;
  }
}

/** Newest-first lightweight summaries for the Projects panel. */
export async function listProjects(): Promise<FableProjectSummary[]> {
  try {
    const db = await getDB();
    const all = await db.getAllFromIndex("projects", "by-updatedAt");
    return all
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

/** Delete a project. Best-effort. */
export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete("projects", id);
  } catch (err) {
    console.error("[fable/store] deleteProject failed", err);
  }
}
