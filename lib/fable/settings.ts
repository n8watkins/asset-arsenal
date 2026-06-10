"use client";

// Fable Bench — global, localStorage-backed user settings.
//
// Settings apply across ALL Fable projects (unlike per-project model config):
//   - downscaleMaxEdge: client-side downscale cap for uploaded images.
//     0 = off; 1024 / 2048 = longest edge in px. Saves payload size, IndexedDB
//     bloat, and upload time (OpenAI already downscales server-side, so the
//     dollar savings are pennies — see docs/FABLE-V2-PLAN.md A8).
//   - sourceCrops: experimental source-icon bounding-box crops (B15).
//
// SSR-safe: every window/localStorage access is guarded; the server (and the
// first client render, for hydration consistency) sees the defaults.

import { useCallback, useEffect, useState } from "react";

export type FableDownscaleMaxEdge = 0 | 1024 | 2048;

export type FableSettings = {
  /** Longest-edge cap applied to uploads client-side; 0 disables downscaling. */
  downscaleMaxEdge: FableDownscaleMaxEdge;
  /** Experimental: crop candidate icons out of the approved source. */
  sourceCrops: boolean;
};

export const DEFAULT_FABLE_SETTINGS: FableSettings = {
  downscaleMaxEdge: 1024,
  sourceCrops: true,
};

const STORAGE_KEY = "fable:settings";

// Same-tab subscribers (the `storage` event only fires in OTHER tabs).
const listeners = new Set<(s: FableSettings) => void>();

function sanitize(raw: unknown): FableSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FABLE_SETTINGS };
  const o = raw as Partial<Record<keyof FableSettings, unknown>>;
  const edge = o.downscaleMaxEdge;
  return {
    downscaleMaxEdge:
      edge === 0 || edge === 1024 || edge === 2048
        ? edge
        : DEFAULT_FABLE_SETTINGS.downscaleMaxEdge,
    sourceCrops:
      typeof o.sourceCrops === "boolean"
        ? o.sourceCrops
        : DEFAULT_FABLE_SETTINGS.sourceCrops,
  };
}

/** Read the current settings (defaults on the server / on parse failure). */
export function getFableSettings(): FableSettings {
  if (typeof window === "undefined") return { ...DEFAULT_FABLE_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FABLE_SETTINGS };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FABLE_SETTINGS };
  }
}

/** Patch + persist the settings; notifies same-tab useFableSettings hooks. */
export function setFableSettings(patch: Partial<FableSettings>): FableSettings {
  const next = sanitize({ ...getFableSettings(), ...patch });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full / blocked — keep the in-memory value */
    }
  }
  for (const fn of listeners) fn(next);
  return next;
}

/** React hook: live settings + an updater. Syncs across tabs via `storage`. */
export function useFableSettings(): [
  FableSettings,
  (patch: Partial<FableSettings>) => void,
] {
  // Initial render uses defaults so SSR markup and the client's first paint
  // match; the real stored value lands in an effect right after mount.
  const [settings, setSettings] = useState<FableSettings>(DEFAULT_FABLE_SETTINGS);

  useEffect(() => {
    setSettings(getFableSettings());
    const onLocal = (s: FableSettings) => setSettings(s);
    listeners.add(onLocal);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSettings(getFableSettings());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((patch: Partial<FableSettings>) => {
    setFableSettings(patch); // listeners (incl. this hook) update state
  }, []);

  return [settings, update];
}
