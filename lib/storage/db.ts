/**
 * IndexedDB schema and singleton accessor for Asset Arsenal.
 * Browser-only — never import at module top-level on the server.
 * Only call getDB() inside async functions / effects.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  IconManifest,
  IconPromptPack,
  GeneratedIcon,
} from "@/types/icon-pipeline";

// ---- Stored record types ----

export type StoredSource = {
  id: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  uploadedAt: string;
  blob: Blob;
};

export type StoredRun = {
  id: string;
  sourceId: string;
  createdAt: string;
  manifest?: IconManifest;
  promptPack?: IconPromptPack;
  iconCount: number;
};

export type StoredIcon = {
  id: string;
  runId: string;
  iconId: string;
  iconName: string;
  prompt: string;
  modelUsed: string;
  status: GeneratedIcon["status"];
  createdAt: string;
  blob: Blob;
};

// ---- IDB schema ----

interface AssetArsenalDB extends DBSchema {
  sources: {
    key: string;
    value: StoredSource;
    indexes: Record<never, never>;
  };
  runs: {
    key: string;
    value: StoredRun;
    indexes: { "by-createdAt": string };
  };
  icons: {
    key: string;
    value: StoredIcon;
    indexes: { "by-run": string; "by-createdAt": string };
  };
}

// ---- Singleton ----

let _dbPromise: Promise<IDBPDatabase<AssetArsenalDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<AssetArsenalDB>> {
  if (typeof indexedDB === "undefined") {
    throw new Error(
      "Asset Arsenal: IndexedDB is not available. getDB() must only be called in a browser context."
    );
  }

  if (!_dbPromise) {
    _dbPromise = openDB<AssetArsenalDB>("asset-arsenal", 1, {
      upgrade(db) {
        // sources store
        if (!db.objectStoreNames.contains("sources")) {
          db.createObjectStore("sources", { keyPath: "id" });
        }

        // runs store
        if (!db.objectStoreNames.contains("runs")) {
          const runsStore = db.createObjectStore("runs", { keyPath: "id" });
          runsStore.createIndex("by-createdAt", "createdAt");
        }

        // icons store
        if (!db.objectStoreNames.contains("icons")) {
          const iconsStore = db.createObjectStore("icons", { keyPath: "id" });
          iconsStore.createIndex("by-run", "runId");
          iconsStore.createIndex("by-createdAt", "createdAt");
        }
      },
    });
  }

  return _dbPromise;
}
