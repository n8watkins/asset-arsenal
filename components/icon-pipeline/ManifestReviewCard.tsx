"use client";

import { useState } from "react";
import type { IconManifest, DecomposedIcon, Confidence } from "@/types/icon-pipeline";

export interface ManifestReviewCardProps {
  manifest: IconManifest;
  onEditIcon: (iconId: string, patch: Partial<DecomposedIcon>) => void;
  onRemoveIcon: (iconId: string) => void;
  onApprove: () => void;
  onRerun: () => void;
  busy?: boolean;
}

const CONFIDENCE_BADGE: Record<
  Confidence,
  { label: string; className: string }
> = {
  high: {
    label: "High",
    className:
      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  },
  low: {
    label: "Low",
    className: "bg-zinc-700 text-zinc-400 border border-zinc-600",
  },
};

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const cfg = CONFIDENCE_BADGE[confidence];
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}

function IconRow({
  icon,
  onEdit,
  onRemove,
  busy,
}: {
  icon: DecomposedIcon;
  onEdit: (patch: Partial<DecomposedIcon>) => void;
  onRemove: () => void;
  busy?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  // Local draft state — only committed on save
  const [draft, setDraft] = useState<DecomposedIcon>({ ...icon });

  const save = () => {
    onEdit(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft({ ...icon });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col gap-3">
        {(
          [
            ["name", "Name"],
            ["meaning", "Meaning"],
            ["locationInImage", "Location"],
            ["visualDescription", "Visual Description"],
            ["styleNotes", "Style Notes"],
          ] as [keyof DecomposedIcon, string][]
        ).map(([field, label]) => (
          <div key={field} className="flex flex-col gap-1">
            <label className="text-zinc-400 text-xs font-medium uppercase tracking-wide">
              {label}
            </label>
            <input
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={draft[field] as string}
              onChange={(e) =>
                setDraft((d) => ({ ...d, [field]: e.target.value }))
              }
            />
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="text-zinc-400 text-xs font-medium uppercase tracking-wide">
            Confidence
          </label>
          <select
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            value={draft.confidence}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                confidence: e.target.value as Confidence,
              }))
            }
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="flex gap-2 mt-1">
          <button
            onClick={save}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            Save
          </button>
          <button
            onClick={cancel}
            className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-sm font-medium px-4 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/60 rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-zinc-100 font-semibold text-sm">{icon.name}</span>
          <ConfidenceBadge confidence={icon.confidence} />
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="text-zinc-400 hover:text-cyan-400 text-xs px-2 py-1 rounded-lg border border-zinc-700 hover:border-cyan-500/50 transition-colors disabled:opacity-40"
          >
            Edit
          </button>
          <button
            onClick={onRemove}
            disabled={busy}
            className="text-zinc-400 hover:text-red-400 text-xs px-2 py-1 rounded-lg border border-zinc-700 hover:border-red-500/50 transition-colors disabled:opacity-40"
          >
            Remove
          </button>
        </div>
      </div>
      <p className="text-zinc-400 text-xs">
        <span className="text-zinc-500 uppercase tracking-wide">Meaning: </span>
        {icon.meaning}
      </p>
      <p className="text-zinc-400 text-xs">
        <span className="text-zinc-500 uppercase tracking-wide">Location: </span>
        {icon.locationInImage}
      </p>
      <p className="text-zinc-400 text-xs">
        <span className="text-zinc-500 uppercase tracking-wide">Visual: </span>
        {icon.visualDescription}
      </p>
      <p className="text-zinc-400 text-xs">
        <span className="text-zinc-500 uppercase tracking-wide">Style: </span>
        {icon.styleNotes}
      </p>
    </div>
  );
}

export default function ManifestReviewCard({
  manifest,
  onEditIcon,
  onRemoveIcon,
  onApprove,
  onRerun,
  busy = false,
}: ManifestReviewCardProps) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-zinc-100 text-lg font-semibold">
            Icon Manifest
          </h2>
          <p className="text-zinc-400 text-sm mt-0.5">
            {manifest.iconCount} icon{manifest.iconCount !== 1 ? "s" : ""}{" "}
            detected
          </p>
        </div>
        <button
          onClick={() => setShowJson((v) => !v)}
          className="text-xs text-cyan-400 border border-zinc-700 hover:border-cyan-500/50 px-3 py-1.5 rounded-lg transition-colors shrink-0"
        >
          {showJson ? "Hide JSON" : "Show JSON"}
        </button>
      </div>

      {/* Family style summary */}
      <div className="bg-zinc-800/40 border border-zinc-700/40 rounded-xl p-4 flex flex-col gap-2">
        <p className="text-zinc-400 text-xs font-medium uppercase tracking-wide">
          Family Style
        </p>
        <p className="text-zinc-200 text-sm">{manifest.iconFamilyStyle.summary}</p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {manifest.iconFamilyStyle.colorPalette.map((hex) => (
            <span
              key={hex}
              className="inline-flex items-center gap-1.5 text-zinc-400 text-xs border border-zinc-700 rounded-md px-2 py-0.5"
            >
              <span
                className="w-3 h-3 rounded-sm inline-block border border-zinc-600"
                style={{ background: hex }}
              />
              {hex}
            </span>
          ))}
        </div>
      </div>

      {/* JSON viewer */}
      {showJson && (
        <pre className="bg-zinc-950 border border-zinc-700 rounded-xl p-4 text-xs text-zinc-300 overflow-auto max-h-72 font-mono">
          {JSON.stringify(manifest, null, 2)}
        </pre>
      )}

      {/* Icon list */}
      <div className="flex flex-col gap-3">
        {manifest.icons.map((icon) => (
          <IconRow
            key={icon.id}
            icon={icon}
            onEdit={(patch) => onEditIcon(icon.id, patch)}
            onRemove={() => onRemoveIcon(icon.id)}
            busy={busy}
          />
        ))}
      </div>

      {/* Notes */}
      {manifest.notes.length > 0 && (
        <div className="border-t border-zinc-800 pt-4">
          <p className="text-zinc-500 text-xs font-medium uppercase tracking-wide mb-2">
            Analysis Notes
          </p>
          <ul className="flex flex-col gap-1">
            {manifest.notes.map((note, i) => (
              <li key={i} className="text-zinc-400 text-xs flex gap-2">
                <span className="text-zinc-600">–</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          onClick={onApprove}
          disabled={busy || manifest.icons.length === 0}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none text-white font-semibold py-2.5 px-5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 flex items-center gap-2"
        >
          {busy ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full inline-block" />
              Working…
            </>
          ) : (
            "Approve"
          )}
        </button>
        <button
          onClick={onRerun}
          disabled={busy}
          className="border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:pointer-events-none text-zinc-300 font-semibold py-2.5 px-5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900"
        >
          Rerun analysis
        </button>
      </div>
    </div>
  );
}
