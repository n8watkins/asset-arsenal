"use client";

// Live preview of the whole pack under one style — the magic moment. Each tile
// renders the styled SVG string (the same string we'll rasterize at export)
// inside a badge/background wrapper.

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { buildStyledSvg } from "@/lib/svg/restyle";
import type { SvgIconRecord, SvgStyle, BadgeShape } from "@/lib/svg/types";

const HEX_CLIP = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

function badgeRadius(shape: BadgeShape): string {
  if (shape === "circle") return "9999px";
  if (shape === "rounded") return "22%";
  return "0";
}

function Tile({
  record,
  style,
}: {
  record: SvgIconRecord;
  style: SvgStyle;
}) {
  // Recompute only when this record or the style changes.
  const svg = useMemo(() => buildStyledSvg(record, style), [record, style]);

  const showBadge = style.badge.shape !== "none";
  const padPct = `${Math.round(style.badge.padding * 100)}%`;

  const badgeStyle: CSSProperties = showBadge
    ? {
        background: style.badge.bg,
        borderRadius: badgeRadius(style.badge.shape),
        clipPath: style.badge.shape === "hex" ? HEX_CLIP : undefined,
        padding: padPct,
      }
    : { padding: padPct };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex aspect-square w-full items-center justify-center rounded-xl"
        style={{
          background:
            style.background === "transparent"
              ? "repeating-conic-gradient(#27272a 0% 25%, #18181b 0% 50%) 50% / 16px 16px"
              : style.background,
        }}
      >
        <div
          className="flex aspect-square w-3/4 items-center justify-center"
          style={badgeStyle}
        >
          {/* The styled SVG string — same source of truth as export. */}
          <div
            className="h-full w-full"
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
      <span className="truncate text-xs text-zinc-500" title={record.id}>
        {record.name}
      </span>
    </div>
  );
}

export default function PackPreview({
  records,
  style,
}: {
  records: SvgIconRecord[];
  style: SvgStyle;
}) {
  if (records.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-sm text-zinc-500">
        No icons in the pack yet — search and add some.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {records.map((r) => (
        <Tile key={r.id} record={r} style={style} />
      ))}
    </div>
  );
}
