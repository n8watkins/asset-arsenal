"use client";

// Fable Bench — resolve stored images (refs or data URLs) to a renderable src.
//
// Image fields are either opaque blob-store refs ("idb-image:<id>",
// lib/fable/images.ts) or legacy multi-MB base64 data URLs. Neither belongs in
// an <img src>: refs aren't URLs at all, and browsers refuse to open giant
// data URLs in a new tab while they bloat the DOM. This hook resolves both to
// an object URL for DISPLAY:
//
//   - refs        → getDisplayUrl()'s session-cached object URL (the cache owns
//                   it — never revoked here)
//   - data URLs   → a locally created object URL, revoked on change/unmount
//   - http/object → pass through untouched
//
// The persisted format never changes — only the rendered src does.

import { useEffect, useState } from "react";
import { getDisplayUrl, isImageRef } from "./images";

function dataUrlToObjectUrl(dataUrl: string): string | null {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  try {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: m[1] }));
  } catch {
    return null;
  }
}

/** Display URL for an image ref or data URL (see module comment). Falls back
 *  to the input itself for plain URLs; returns undefined while a ref is still
 *  resolving (a raw ref must NEVER land in an <img src>) or when absent. */
export function useObjectUrl(refOrDataUrl: string | null | undefined): string | undefined {
  // Track WHICH input the object URL belongs to, so a changed input never
  // renders the previous (about-to-be-revoked) blob for a frame.
  const [entry, setEntry] = useState<{ src: string; url: string } | null>(null);

  useEffect(() => {
    if (!refOrDataUrl) return;
    if (isImageRef(refOrDataUrl)) {
      // The session cache owns the object URL — no revocation on cleanup.
      let alive = true;
      getDisplayUrl(refOrDataUrl)
        .then((url) => {
          if (alive) setEntry({ src: refOrDataUrl, url });
        })
        .catch(() => {
          /* missing image — leave src undefined */
        });
      return () => {
        alive = false;
      };
    }
    if (!refOrDataUrl.startsWith("data:")) return;
    const obj = dataUrlToObjectUrl(refOrDataUrl);
    if (!obj) return;
    setEntry({ src: refOrDataUrl, url: obj });
    return () => URL.revokeObjectURL(obj);
  }, [refOrDataUrl]);

  if (refOrDataUrl && entry?.src === refOrDataUrl) return entry.url;
  if (isImageRef(refOrDataUrl)) return undefined; // still resolving / missing
  return refOrDataUrl || undefined;
}
