"use client";

// Fable Bench — render multi-MB base64 data URLs as object URLs.
//
// Generated images are persisted as data URLs (IndexedDB-friendly), but
// browsers refuse to open giant data URLs in a new tab and they bloat the DOM.
// This hook converts a data URL to a blob object URL for DISPLAY, revoking it
// whenever the value changes or the component unmounts. Non-data-URL inputs
// (object URLs, http urls) pass through untouched. The persisted format stays
// data URLs — only the rendered src changes.

import { useEffect, useState } from "react";

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

/** Object URL for a data URL; revoked on change/unmount. Falls back to the
 *  input itself while converting (or when the input isn't a data URL). */
export function useObjectUrl(dataUrl: string | null | undefined): string | undefined {
  // Track WHICH input the object URL belongs to, so a changed input never
  // renders the previous (about-to-be-revoked) blob for a frame.
  const [entry, setEntry] = useState<{ src: string; url: string } | null>(null);

  useEffect(() => {
    if (!dataUrl || !dataUrl.startsWith("data:")) return;
    const obj = dataUrlToObjectUrl(dataUrl);
    if (!obj) return;
    setEntry({ src: dataUrl, url: obj });
    return () => URL.revokeObjectURL(obj);
  }, [dataUrl]);

  if (dataUrl && entry?.src === dataUrl) return entry.url;
  return dataUrl || undefined;
}
