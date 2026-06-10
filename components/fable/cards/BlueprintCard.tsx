"use client";

// Fable Bench — blueprint artifact card (inline in the chat feed).
//
// Style name + summary, palette swatches, mood/line/shape tags, a collapsible
// candidate list with per-row rename/remove, and a "Generate preview sheets"
// action. B10: an explicit "✎ Edit" toggle makes the style fields editable
// (read-only until pressed — no silent free-editing); Save applies the patch
// via the hook's updateStyle. B15: when source crops exist, each candidate
// shows its crop thumbnail to the LEFT of the name/concept text, and a
// "Find on source" button re-runs the locate step (gated on the sourceCrops
// setting).

import { useState } from "react";
import {
  chunkForSheets,
  type FableProject,
  type FableStyle,
  type IconCandidate,
} from "@/lib/fable/types";
import { useFableSettings } from "@/lib/fable/settings";
import { ArtifactCard, CardAction, Pill } from "../ui";

function isHex(s: string): boolean {
  return /^#?[0-9a-fA-F]{3,8}$/.test(s.trim());
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-md bg-zinc-800/80 px-2 py-0.5 text-[11px] text-zinc-300 ring-1 ring-zinc-700/40">
      {children}
    </span>
  );
}

/** Editable string-list as removable chips + an add input. */
function ChipListEditor({
  items,
  onChange,
  placeholder,
  swatches = false,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  swatches?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className="inline-flex items-center gap-1 rounded-md bg-zinc-950/60 px-1.5 py-1 ring-1 ring-zinc-800"
        >
          {swatches && (
            <span
              className="h-4 w-4 rounded ring-1 ring-zinc-700"
              style={{
                backgroundColor: isHex(item)
                  ? item.startsWith("#")
                    ? item
                    : `#${item}`
                  : "#3f3f46",
              }}
            />
          )}
          <span className="text-[10px] text-zinc-400">{item}</span>
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-zinc-600 hover:text-red-400"
            aria-label={`Remove ${item}`}
          >
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="w-24 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-1 text-[10px] text-zinc-300 placeholder:text-zinc-600 focus:border-cyan-500/60 focus:outline-none"
      />
    </div>
  );
}

export default function BlueprintCard({
  project,
  busy,
  onGeneratePreviews,
  onRemoveCandidate,
  onUpdateCandidate,
  onUpdateStyle,
  onLocateCrops,
}: {
  project: FableProject;
  busy: boolean;
  onGeneratePreviews: () => void;
  onRemoveCandidate: (id: string) => void;
  onUpdateCandidate: (id: string, patch: Partial<IconCandidate>) => void;
  /** B10: apply the edited style fields (hook updateStyle — local mutate). */
  onUpdateStyle: (patch: Partial<FableStyle>) => void;
  /** B15: re-run the locate step over the current candidates. */
  onLocateCrops: () => void;
}) {
  const style = project.style;
  const active = project.candidates.filter((c) => c.status === "active");
  const sheetCount = chunkForSheets(project.candidates).length;
  const [showIcons, setShowIcons] = useState(true);
  const [settings] = useFableSettings();

  // B10: edit mode — a local draft of the editable fields; fields stay
  // read-only until ✎ Edit is pressed (owner requirement).
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<{
    styleName: string;
    colorPalette: string[];
    mood: string[];
    lineStyle: string;
    shapeLanguage: string;
  } | null>(null);

  const startEdit = () => {
    if (!style) return;
    setDraft({
      styleName: style.styleName,
      colorPalette: [...style.colorPalette],
      mood: [...style.mood],
      lineStyle: style.lineStyle,
      shapeLanguage: style.shapeLanguage,
    });
    setEditing(true);
  };

  const saveEdit = () => {
    if (draft) {
      onUpdateStyle({
        styleName: draft.styleName.trim() || style?.styleName,
        colorPalette: draft.colorPalette,
        mood: draft.mood,
        lineStyle: draft.lineStyle.trim() || style?.lineStyle,
        shapeLanguage: draft.shapeLanguage.trim() || style?.shapeLanguage,
      });
    }
    setEditing(false);
    setDraft(null);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft(null);
  };

  return (
    <ArtifactCard title="Blueprint" badge={<Pill tone="cyan">style</Pill>}>
      {style && (
        <>
          <div className="flex flex-wrap items-baseline gap-2">
            {editing && draft ? (
              <input
                value={draft.styleName}
                onChange={(e) => setDraft({ ...draft, styleName: e.target.value })}
                className="rounded border border-cyan-700/50 bg-zinc-950 px-2 py-0.5 text-base font-semibold text-zinc-100 focus:border-cyan-500/70 focus:outline-none"
                aria-label="Style name"
              />
            ) : (
              <h3 className="text-base font-semibold text-zinc-100">{style.styleName}</h3>
            )}
            <span className="ml-auto flex gap-1.5">
              {editing ? (
                <>
                  <button
                    onClick={saveEdit}
                    className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200 ring-1 ring-emerald-600/40 hover:bg-emerald-500/25"
                  >
                    ✓ Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={startEdit}
                  disabled={busy}
                  className="rounded-lg border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
                  title="Edit the style fields"
                >
                  ✎ Edit
                </button>
              )}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{style.summary}</p>

          {editing && draft ? (
            <div className="mt-3 flex flex-col gap-2.5 rounded-xl border border-cyan-900/40 bg-cyan-950/10 p-2.5">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Palette</p>
                <ChipListEditor
                  items={draft.colorPalette}
                  onChange={(colorPalette) => setDraft({ ...draft, colorPalette })}
                  placeholder="+ #hex"
                  swatches
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">Mood</p>
                <ChipListEditor
                  items={draft.mood}
                  onChange={(mood) => setDraft({ ...draft, mood })}
                  placeholder="+ tag"
                />
              </div>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Line style</span>
                <input
                  value={draft.lineStyle}
                  onChange={(e) => setDraft({ ...draft, lineStyle: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/60 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Shape language</span>
                <input
                  value={draft.shapeLanguage}
                  onChange={(e) => setDraft({ ...draft, shapeLanguage: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-200 focus:border-cyan-500/60 focus:outline-none"
                />
              </label>
              <p className="text-[10px] text-zinc-600">
                Saved edits apply locally; generation prompts pick them up on the next revision.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {style.colorPalette.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-950/60 px-1.5 py-1 ring-1 ring-zinc-800"
                  >
                    <span
                      className="h-4 w-4 rounded ring-1 ring-zinc-700"
                      style={
                        isHex(c)
                          ? { backgroundColor: c.startsWith("#") ? c : `#${c}` }
                          : { backgroundColor: "#3f3f46" }
                      }
                    />
                    <span className="text-[10px] text-zinc-400">{c}</span>
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <Tag>{style.lineStyle}</Tag>
                <Tag>{style.shapeLanguage}</Tag>
                <Tag>{style.lighting}</Tag>
                {style.iconBackground && <Tag>bg: {style.iconBackground}</Tag>}
                {style.mood.map((m, i) => (
                  <Tag key={i}>{m}</Tag>
                ))}
              </div>
            </>
          )}

          {!editing && style.negativeRules.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-zinc-500">Never</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {style.negativeRules.map((r, i) => (
                  <span
                    key={i}
                    className="rounded-md bg-red-950/30 px-1.5 py-0.5 text-[10px] text-red-300/80 ring-1 ring-red-900/40"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-4 border-t border-zinc-800 pt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIcons((v) => !v)}
            className="text-xs font-medium text-zinc-300 hover:text-zinc-100"
          >
            {showIcons ? "▾" : "▸"} Icon set <span className="text-zinc-500">· {active.length}</span>
          </button>
          {settings.sourceCrops && (
            <button
              onClick={onLocateCrops}
              disabled={busy || active.length === 0}
              className="ml-auto rounded-lg border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-40"
              title="Locate each candidate on the source image and crop a thumbnail (one free Gemini call)"
            >
              ⌖ Find on source
            </button>
          )}
        </div>
        {showIcons && (
          <div className="mt-2 flex flex-col gap-1.5">
            {active.map((c) => (
              <div
                key={c.id}
                className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2"
              >
                <span className="mt-0.5 font-mono text-[10px] text-zinc-600">{c.id}</span>
                {/* B15: crop from the source, left of the name/concept text. */}
                {c.sourceCrop && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.sourceCrop}
                    alt={`${c.name} on source`}
                    title="As seen on the source image"
                    className="h-9 w-9 shrink-0 rounded-md object-contain ring-1 ring-zinc-700"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <input
                    value={c.name}
                    onChange={(e) => onUpdateCandidate(c.id, { name: e.target.value })}
                    className="w-full bg-transparent text-sm font-medium text-zinc-100 focus:outline-none"
                  />
                  <p className="truncate text-xs text-zinc-500" title={c.rationale}>
                    {c.concept}
                  </p>
                </div>
                <button
                  onClick={() => onRemoveCandidate(c.id)}
                  className="text-zinc-600 hover:text-red-400"
                  aria-label={`Remove ${c.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {active.length === 0 && <p className="text-sm text-zinc-600">No active candidates.</p>}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <CardAction tone="cyan" onClick={onGeneratePreviews} disabled={busy || active.length === 0}>
          Generate preview sheets →
        </CardAction>
        <span className="text-xs text-zinc-500">
          {sheetCount} sheet{sheetCount === 1 ? "" : "s"} · {active.length} icons
        </span>
      </div>
    </ArtifactCard>
  );
}
