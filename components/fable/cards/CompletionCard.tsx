"use client";

// Fable Bench — completion artifact card (inline in the chat feed).
// A compact summary once the project is saved: counts + total cost + a one-zip
// download of every successful final. The assets themselves remain browsable
// in the FinalsCard above this in the feed.

import { useState } from "react";
import { downloadZip, zipEntriesFromDataUrls } from "@/lib/zip";
import { slugify } from "@/lib/icon/download";
import { resolveToDataUrl } from "@/lib/fable/images";
import { totalCostUSD } from "@/lib/fable/pricing";
import type { FableProject } from "@/lib/fable/types";
import { ArtifactCard, CardAction, fmtUsd, Pill } from "../ui";

export default function CompletionCard({ project }: { project: FableProject }) {
  const finals = project.finals.filter((f) => f.status === "success");
  const sheets = project.sheets.filter((s) => s.status !== "superseded").length;
  const [zipping, setZipping] = useState(false);

  async function downloadAll() {
    // One zip (STORE-only, lib/zip.ts) instead of N separate downloads.
    // imageUrl values may be stored-image refs — resolve to data URLs first.
    setZipping(true);
    try {
      const items = await Promise.all(
        finals
          .filter((f) => f.imageUrl)
          .map(async (f) => ({ name: f.name, dataUrl: await resolveToDataUrl(f.imageUrl) })),
      );
      downloadZip(`${slugify(project.name)}.zip`, zipEntriesFromDataUrls(items));
    } catch (err) {
      console.error("[fable] zip build failed", err);
    } finally {
      setZipping(false);
    }
  }

  return (
    <ArtifactCard title="Pack complete" badge={<Pill tone="emerald">done</Pill>}>
      <p className="text-sm text-zinc-300">
        {finals.length} icons in the{" "}
        <span className="text-zinc-100">{project.style?.styleName ?? "extracted"}</span> style.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Icons" value={String(finals.length)} />
        <Stat label="Sheets" value={String(sheets)} />
        <Stat label="Total cost" value={fmtUsd(totalCostUSD(project.usage))} />
      </div>
      <div className="mt-3">
        <CardAction
          tone="cyan"
          onClick={() => void downloadAll()}
          disabled={zipping || finals.length === 0}
        >
          ⤓ {zipping ? "Building zip…" : "Download all (.zip)"}
        </CardAction>
      </div>
    </ArtifactCard>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-2.5">
      <p className="text-base font-semibold text-zinc-100">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</p>
    </div>
  );
}
