"use client";

// Page skins prototype - type a concept, get the fixed sample landing page back
// fully skinned (palette, type, component styling, three generated images).

import { useState } from "react";
import Nav from "@/components/Nav";
import type { SkinResult } from "@/lib/skins/generate";

const EXAMPLES = ["retro arcade", "botanical journal", "brutalist newspaper", "space mission control", "cozy bakery"];

export default function SkinsPage() {
  const [concept, setConcept] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SkinResult | null>(null);
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");

  async function run(c: string) {
    if (!c.trim() || busy) return;
    setConcept(c);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/skins/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ concept: c }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Generation failed.");
      setResult(json as SkinResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <Nav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="text-2xl font-semibold">Page skins</h1>
        <p className="mt-1 text-sm text-zinc-600">
          One concept in, the sample landing page out in a full skin. Prototype: spec by gpt-5.4-mini, images by gpt-image-2 and gpt-image-1.5.
        </p>
        <form
          className="mt-5 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(concept);
          }}
        >
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            placeholder="A concept, e.g. retro arcade"
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
          />
          <button className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-50" disabled={busy}>
            {busy ? "Generating..." : "Generate skin"}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs hover:bg-zinc-100" onClick={() => run(ex)} disabled={busy}>
              {ex}
            </button>
          ))}
        </div>
        {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {result && (
          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <strong>{result.spec.name}</strong>
              <span className="text-zinc-600">{(result.totalMs / 1000).toFixed(1)}s</span>
              <span className="text-zinc-600">${result.totalCostUSD.toFixed(3)}</span>
              <span className="text-zinc-600">
                {result.spec.fonts.display} / {result.spec.fonts.body}
              </span>
              <span className="ml-auto flex gap-1">
                {(["desktop", "mobile"] as const).map((w) => (
                  <button key={w} onClick={() => setWidth(w)} className={`rounded px-2 py-1 text-xs ${width === w ? "bg-zinc-900 text-white" : "bg-zinc-200"}`}>
                    {w}
                  </button>
                ))}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{result.spec.rationale}</p>
            <iframe
              title="Skinned page"
              srcDoc={result.html}
              sandbox=""
              className="mx-auto mt-4 block h-[80vh] rounded-lg border border-zinc-300 bg-white"
              style={{ width: width === "desktop" ? "100%" : 390 }}
            />
          </section>
        )}
      </main>
    </div>
  );
}
