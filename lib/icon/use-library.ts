"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StoredSource, StoredRun, StoredIcon } from "@/lib/storage/db";
import {
  listSources,
  listRuns,
  listIcons,
  deleteSource,
  deleteRun,
  deleteIcon,
  clearAll,
} from "@/lib/storage/repo";

export type LibrarySource = StoredSource & { objectUrl: string };
export type LibraryIcon = StoredIcon & { objectUrl: string };

export interface UseLibraryReturn {
  sources: LibrarySource[];
  icons: LibraryIcon[];
  runs: StoredRun[];
  loading: boolean;
  refresh: () => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  removeIcon: (id: string) => Promise<void>;
  removeRun: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

/** Revoke all object URLs in a list of items. */
function revokeObjectUrls(items: Array<{ objectUrl: string }>) {
  for (const item of items) {
    try {
      URL.revokeObjectURL(item.objectUrl);
    } catch {
      // ignore revocation errors
    }
  }
}

export function useLibrary(): UseLibraryReturn {
  const [sources, setSources] = useState<LibrarySource[]>([]);
  const [icons, setIcons] = useState<LibraryIcon[]>([]);
  const [runs, setRuns] = useState<StoredRun[]>([]);
  const [loading, setLoading] = useState(true);

  // Refs to track current object-URL-bearing lists for cleanup
  const prevSources = useRef<LibrarySource[]>([]);
  const prevIcons = useRef<LibraryIcon[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [nextSources, nextIcons, nextRuns] = await Promise.all([
        listSources(),
        listIcons(),
        listRuns(),
      ]);

      // Revoke stale object URLs before replacing state
      revokeObjectUrls(prevSources.current);
      revokeObjectUrls(prevIcons.current);

      prevSources.current = nextSources;
      prevIcons.current = nextIcons;

      setSources(nextSources);
      setIcons(nextIcons);
      setRuns(nextRuns);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refresh();
    // Revoke all object URLs on unmount
    return () => {
      revokeObjectUrls(prevSources.current);
      revokeObjectUrls(prevIcons.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const removeSource = useCallback(
    async (id: string) => {
      await deleteSource(id);
      await refresh();
    },
    [refresh]
  );

  const removeIcon = useCallback(
    async (id: string) => {
      await deleteIcon(id);
      await refresh();
    },
    [refresh]
  );

  const removeRun = useCallback(
    async (id: string) => {
      await deleteRun(id);
      await refresh();
    },
    [refresh]
  );

  const clear = useCallback(async () => {
    await clearAll();
    await refresh();
  }, [refresh]);

  return {
    sources,
    icons,
    runs,
    loading,
    refresh,
    removeSource,
    removeIcon,
    removeRun,
    clear,
  };
}
