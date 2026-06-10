"use client";

// Fable Bench — the shared rounded composer.
//
// Used in two places with the same internals:
//   - HERO  (large, centered) on the empty state
//   - DOCKED (smaller, pinned to the bottom) during a conversation
//
// Owns its own draft text + attached image. Supports file-picker, paste, and
// drag-drop (the page lifts dragging state so a drop ANYWHERE highlights us).
// A pasted/dropped image shows as a thumbnail chip INSIDE the composer.
//
// The ＋ button opens a drop-UP menu: Upload image… / From gallery… (reuses
// GalleryPicker) / Recent (last 8 images across fable projects, lazy-loaded).

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { IMAGE_UPLOAD_LIMITS } from "@/lib/icon/models";
import GalleryPicker from "@/components/gallery/GalleryPicker";
import { listRecentImages, type FableRecentImage } from "@/lib/fable/store";

/** Decode a data URL into a File so picked images ride the normal attach flow. */
function dataUrlToFile(dataUrl: string, name: string): File | null {
  try {
    const [head, body] = dataUrl.split(",");
    if (!body) return null;
    const mime = /^data:([^;,]+)/.exec(head)?.[1] ?? "image/png";
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], name, { type: mime });
  } catch {
    return null;
  }
}

export type ComposerHandle = {
  /** Drop an externally-provided file into the composer (page-level drag-drop). */
  attach: (file: File) => void;
  /** Quick-action chip send: merges the chip text with the current draft text
   *  (chip first, draft on a new line) AND the attached image, then submits
   *  through the normal onSend and clears the composer. */
  sendQuick: (chipText: string) => void;
};

type ComposerProps = {
  variant: "hero" | "docked";
  busy: boolean;
  busyDetail?: string;
  dragging?: boolean;
  onSend: (text: string, image?: File | null) => void;
};

function Composer(
  { variant, busy, busyDetail, dragging, onSend }: ComposerProps,
  ref: React.Ref<ComposerHandle>,
) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // ＋ drop-up menu state. `recent` loads lazily each time the menu opens.
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState<FableRecentImage[] | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const hero = variant === "hero";

  // Close the menu on outside-click / Escape. The GalleryPicker dialog is a
  // DOM descendant of the menu wrapper, so clicks inside it don't count as
  // "outside" even though it's fixed-positioned.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Lazy-load recent images when the menu opens (fresh each open).
  useEffect(() => {
    if (!menuOpen) return;
    let cancelled = false;
    setRecent(null);
    listRecentImages(8).then((imgs) => {
      if (!cancelled) setRecent(imgs);
    });
    return () => {
      cancelled = true;
    };
  }, [menuOpen]);

  function attachDataUrl(dataUrl: string, name: string) {
    const f = dataUrlToFile(dataUrl, name);
    if (f) setImage(f);
    setMenuOpen(false);
  }

  // Object-URL preview for the attached image chip.
  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  // Auto-grow the textarea up to a cap.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, hero ? 320 : 260)}px`;
  }, [text, hero]);

  function send(t: string, img: File | null) {
    if (busy) return;
    if (!t.trim() && !img) return;
    onSend(t.trim(), img);
    setText("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    send(text, image);
  }

  useImperativeHandle(
    ref,
    () => ({
      attach: (f: File) => setImage(f),
      // Chip text first, then any draft text on a new line; the attached
      // image rides along — nothing in the composer gets dropped.
      sendQuick: (chipText: string) => {
        const draft = text.trim();
        send(draft ? `${chipText}\n${draft}` : chipText, image);
      },
    }),
    // send closes over text/image/busy/onSend — rebuild the handle when they move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, image, busy, onSend],
  );

  return (
    <div
      className={`relative rounded-3xl border bg-zinc-900/70 backdrop-blur transition-colors ${
        dragging
          ? "border-cyan-500/70 bg-cyan-950/30 ring-2 ring-cyan-500/30"
          : "border-zinc-700/80"
      } ${hero ? "p-3 shadow-2xl shadow-black/40" : "p-2 shadow-lg shadow-black/30"}`}
      onPaste={(e) => {
        const file = Array.from(e.clipboardData.files)[0];
        if (file) setImage(file);
      }}
    >
      {preview && (
        <div className="mb-2 flex flex-wrap gap-2 px-1 pt-1">
          <div className="group relative inline-flex flex-col items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950/60 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="attachment" className="h-16 w-16 rounded-lg object-cover" />
            <span className="max-w-[80px] truncate text-[10px] text-zinc-400">
              {image?.name ?? "image"}
            </span>
            <button
              onClick={() => setImage(null)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[11px] text-zinc-400 ring-1 ring-zinc-700 hover:text-red-300"
              aria-label="Remove attachment"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-2">
        <div ref={menuRef} className="relative shrink-0">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={busy}
            className={`flex items-center justify-center rounded-2xl border text-zinc-400 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40 ${
              menuOpen ? "border-cyan-500/50 text-cyan-200" : "border-zinc-700"
            } ${hero ? "h-11 w-11 text-lg" : "h-9 w-9"}`}
            aria-label="Add image"
            title="Add image"
            aria-expanded={menuOpen}
          >
            ＋
          </button>

          {menuOpen && (
            <div className="absolute bottom-full left-0 z-40 mb-2 w-64 rounded-2xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl shadow-black/50">
              <button
                onClick={() => {
                  fileRef.current?.click();
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-cyan-200"
              >
                <span aria-hidden>🖼</span> Upload image…
              </button>
              {/* GalleryPicker renders its own trigger button + dialog; styled
                  here as a menu row. The menu stays open behind the dialog and
                  closes once a pick lands (or on outside-click). */}
              <GalleryPicker
                label="🗂 From gallery…"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-cyan-200"
                onPick={(img) => attachDataUrl(img.dataUrl, img.fileName)}
              />

              <div className="mt-1 border-t border-zinc-800 px-3 pb-1.5 pt-2">
                <p className="mb-1.5 text-[10px] uppercase tracking-widest text-zinc-500">
                  Recent
                </p>
                {recent === null ? (
                  <p className="pb-1 text-xs text-zinc-600">Loading…</p>
                ) : recent.length === 0 ? (
                  <p className="pb-1 text-xs text-zinc-600">No recent images yet.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5 pb-1">
                    {recent.map((r, i) => (
                      <button
                        key={`${r.projectId}-${r.createdAt}-${i}`}
                        onClick={() => attachDataUrl(r.imageUrl, r.name)}
                        className="overflow-hidden rounded-lg border border-zinc-800 transition-colors hover:border-cyan-500/60"
                        title={`${r.name} · ${r.projectName}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.imageUrl}
                          alt={r.name}
                          className="aspect-square w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={IMAGE_UPLOAD_LIMITS.allowedMimeTypes.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setImage(f);
          }}
        />
        <textarea
          ref={taRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={
            busy
              ? busyDetail || "Working…"
              : hero
                ? "Describe the icon pack you want — or drop a screenshot…"
                : "Message Fable…"
          }
          disabled={busy}
          className={`flex-1 resize-none bg-transparent text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50 ${
            hero ? "px-2 py-2.5 text-base" : "px-1.5 py-2 text-base"
          }`}
        />
        <button
          onClick={submit}
          disabled={busy || (!text.trim() && !image)}
          className={`flex shrink-0 items-center justify-center rounded-2xl bg-cyan-500/20 font-medium text-cyan-200 ring-1 ring-cyan-500/40 transition-colors hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-30 ${
            hero ? "h-11 px-5 text-sm" : "h-9 px-4 text-sm"
          }`}
        >
          {hero ? "Send" : "↑"}
        </button>
      </div>
    </div>
  );
}

export default forwardRef(Composer);
