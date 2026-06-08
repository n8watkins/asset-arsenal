"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { StoredSource, StoredRun, StoredIcon } from "@/lib/storage/db";
import type { SourceImage } from "@/types/icon-pipeline";
import {
  listSources,
  listRuns,
  listIcons,
  deleteSource,
  deleteRun,
  deleteIcon,
  clearAll,
  saveSource,
} from "@/lib/storage/repo";
import { readImageFile } from "@/lib/icon/download";
import {
  IMAGE_UPLOAD_LIMITS,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/icon/models";

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
  addImages: (
    files: File[] | FileList
  ) => Promise<{ added: number; errors: string[] }>;
}

/** Validate an upload file against the shared image limits. */
function validateImageFile(file: File): string | null {
  if (
    !(IMAGE_UPLOAD_LIMITS.allowedMimeTypes as readonly string[]).includes(
      file.type
    )
  ) {
    return `${file.name || "file"}: unsupported type "${file.type || "unknown"}". Allowed: PNG, JPEG, WebP.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `${file.name || "file"}: ${mb} MB exceeds the ${IMAGE_UPLOAD_LIMITS.maxFileSizeMB} MB limit.`;
  }
  return null;
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

  const addImages = useCallback(
    async (files: File[] | FileList) => {
      const list = Array.from(files);
      const errors: string[] = [];
      let added = 0;

      for (const file of list) {
        const validationError = validateImageFile(file);
        if (validationError) {
          errors.push(validationError);
          continue;
        }
        try {
          const { dataUrl, width, height } = await readImageFile(file);
          const source: SourceImage = {
            id: crypto.randomUUID(),
            imageUrl: dataUrl,
            fileName: file.name,
            mimeType: file.type,
            width,
            height,
            uploadedAt: new Date().toISOString(),
          };
          await saveSource(source);
          added += 1;
        } catch (e) {
          errors.push(
            `${file.name || "file"}: ${e instanceof Error ? e.message : "could not be added."}`
          );
        }
      }

      if (added > 0) await refresh();
      return { added, errors };
    },
    [refresh]
  );

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
    addImages,
  };
}
