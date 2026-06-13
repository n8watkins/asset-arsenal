/**
 * IndexedDB schema and singleton accessor for Asset Arsenal.
 * Browser-only — never import at module top-level on the server.
 * Only call getDB() inside async functions / effects.
 */

import { openDB, DBSchema, IDBPDatabase } from "idb";
import type {
  IconManifest,
  IndividualIconPrompts,
  GeneratedIcon,
} from "@/types/icon-pipeline";
// Type-only import (erased at runtime) — avoids a real cycle with usage-log,
// which imports getDB() from here.
import type { UsageEntry } from "@/lib/icon/usage-log";
// Same pattern for the Gemini analysis chat sidebar.
import type { GeminiChat } from "@/lib/gemini/chat-store";
// SVG lane — cached raw vector records (the lazy fetch cache).
import type { CachedSvgIcon } from "@/lib/svg/cache";

// ---- Stored record types ----

export type StoredSource = {
  id: string;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  uploadedAt: string;
  /**
   * Optional gallery category. IndexedDB records are schemaless, so this is
   * additive and needs no DB version bump. Records written before this field
   * existed will simply have `category === undefined`.
   * "elevated" = an AI-elevated source produced by Bench S (still usable as a
   * source everywhere, but badged honestly in the gallery).
   */
  category?: "source" | "icon-collection" | "icon" | "elevated";
  /**
   * Optional provenance, same additive/schemaless pattern as `category` (no DB
   * version bump): which bench / project / pipeline step produced this record.
   * Older records simply have these undefined. Filtered in memory — no index.
   */
  bench?: string;
  projectId?: string;
  projectName?: string;
  step?: string;
  blob: Blob;
};

export type StoredRun = {
  id: string;
  sourceId: string;
  createdAt: string;
  manifest?: IconManifest;
  collectionPrompt?: string;
  individualPrompts?: IndividualIconPrompts;
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
  /** Optional provenance — see the same fields on StoredSource. */
  bench?: string;
  projectId?: string;
  projectName?: string;
  step?: string;
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
  usage: {
    key: string;
    value: UsageEntry;
    indexes: { "by-at": string };
  };
  chats: {
    key: string;
    value: GeminiChat;
    indexes: { "by-updatedAt": string };
  };
  svgIcons: {
    key: string;
    value: CachedSvgIcon;
    indexes: { "by-cachedAt": number };
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
    _dbPromise = openDB<AssetArsenalDB>("asset-arsenal", 5, {
      // Guarded creates → idempotent across versions; bumping the version runs
      // this again and only adds what's missing (existing data is untouched).
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

        // usage store (v2) — the API call + result log
        if (!db.objectStoreNames.contains("usage")) {
          const usageStore = db.createObjectStore("usage", { keyPath: "id" });
          usageStore.createIndex("by-at", "at");
        }

        // chats store (v4) — the Gemini analysis chat sidebar.
        if (!db.objectStoreNames.contains("chats")) {
          const chatStore = db.createObjectStore("chats", { keyPath: "id" });
          chatStore.createIndex("by-updatedAt", "updatedAt");
        }

        // svgIcons store (v5) — SVG lane lazy cache of raw vector data.
        if (!db.objectStoreNames.contains("svgIcons")) {
          const svgStore = db.createObjectStore("svgIcons", { keyPath: "id" });
          svgStore.createIndex("by-cachedAt", "cachedAt");
        }
      },
    });
  }

  return _dbPromise;
}
