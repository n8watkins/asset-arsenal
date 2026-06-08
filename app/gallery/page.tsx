"use client";

import Nav from "@/components/Nav";
import GalleryView from "@/components/gallery/GalleryView";

export default function GalleryPage() {
  return (
    <>
      <Nav />
      <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          {/* Title */}
          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-bold text-zinc-100">Gallery</h1>
            <p className="text-base text-zinc-400">
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
    </>
  );
}
