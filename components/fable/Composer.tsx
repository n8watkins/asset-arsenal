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

import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from "react";
import { IMAGE_UPLOAD_LIMITS } from "@/lib/icon/models";

export type ComposerHandle = {
  /** Drop an externally-provided file into the composer (page-level drag-drop). */
  attach: (file: File) => void;
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

  const hero = variant === "hero";

  useImperativeHandle(ref, () => ({ attach: (f: File) => setImage(f) }), []);

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
    ta.style.height = `${Math.min(ta.scrollHeight, hero ? 220 : 160)}px`;
  }, [text, hero]);

  function submit() {
    if (busy) return;
    if (!text.trim() && !image) return;
    onSend(text.trim(), image);
    setText("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  }

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
          <div className="group relative inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950/60 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="attachment" className="h-12 w-12 rounded-lg object-cover" />
            <span className="max-w-[140px] truncate pr-1 text-xs text-zinc-400">
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
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className={`flex shrink-0 items-center justify-center rounded-2xl border border-zinc-700 text-zinc-400 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 disabled:opacity-40 ${
            hero ? "h-11 w-11 text-lg" : "h-9 w-9"
          }`}
          aria-label="Attach image"
          title="Attach image"
        >
          ＋
        </button>
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
            hero ? "px-2 py-2.5 text-base" : "px-1.5 py-2 text-sm"
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
