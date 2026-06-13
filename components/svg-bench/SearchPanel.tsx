"use client";

// Local search across bundled sets → click to add to the pack. This is the
// offline discovery path; cross-set Iconify API discovery is a later step.

import { useEffect, useRef, useState } from "react";
import { searchLocal } from "@/lib/svg/iconify";
import { resolveAndCache } from "@/lib/svg/cache";
import type { SvgIconRecord } from "@/lib/svg/types";

export default function SearchPanel({
  onAdd,
  inPack,
}: {
  onAdd: (record: SvgIconRecord) => void;
  inPack: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SvgIconRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const id = ++runId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      const hits = await searchLocal(q, 36);
      const resolved = await Promise.all(
        hits.map((h) => resolveAndCache(h.prefix, h.name))
      );
      if (id !== runId.current) return; // a newer query superseded this one
      setResults(
        resolved
          .map((r) => r.record)
          .filter((r): r is SvgIconRecord => r !== null)
      );
      setLoading(false);
    }, 180);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search icons (e.g. rocket, signal, shield)…"
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-cyan-600 focus:outline-none"
      />

      {loading && <p className="text-xs text-zinc-500">Searching…</p>}

      {results.length > 0 && (
        <div className="grid max-h-72 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-6">
          {results.map((r) => {
            const added = inPack.has(r.id);
            return (
              <button
                key={r.id}
                type="button"
                disabled={added}
                onClick={() => onAdd(r)}
                title={r.id}
                className={`flex aspect-square items-center justify-center rounded-lg border p-2 transition-colors ${
                  added
                    ? "border-cyan-700/50 bg-cyan-500/10 text-cyan-600"
                    : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600 hover:text-white"
                }`}
              >
                <svg
                  viewBox={`0 0 ${r.width} ${r.height}`}
                  className="h-7 w-7"
                  style={{ color: "currentColor" }}
                  // eslint-disable-next-line react/no-danger
                  dangerouslySetInnerHTML={{ __html: r.body }}
                />
              </button>
            );
          })}
        </div>
      )}

      {query.trim() && !loading && results.length === 0 && (
        <p className="text-xs text-zinc-500">No matches in bundled sets.</p>
      )}
    </div>
  );
}
