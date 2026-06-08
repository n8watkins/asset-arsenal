"use client";

import Link from "next/link";
import GalleryView from "@/components/gallery/GalleryView";

export default function GalleryPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Title + nav */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="self-start font-mono text-xs text-cyan-400/80 hover:text-cyan-300"
            >
              ← back to app
            </Link>
            <Link
              href="/bench"
              className="rounded px-3 py-1.5 font-mono text-xs font-medium text-cyan-400/80 ring-1 ring-zinc-700 transition-colors hover:bg-zinc-800 hover:text-cyan-300 hover:ring-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              bench ↗
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-zinc-100">Gallery</h1>
          <p className="text-sm text-zinc-500">
            The home for every image in this project — images you{" "}
            <span className="text-cyan-400">uploaded</span> and icons the{" "}
            <span className="text-violet-400">AI generated</span>. Upload new
            images, view, download, delete, or drag a source into the pipeline.
          </p>
        </div>

        {/* Full gallery: upload + both groups */}
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <GalleryView title="All Images" />
        </section>
      </div>
    </main>
  );
}
