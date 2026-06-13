"use client";

// The restyle controls — every input maps to a deterministic SVG/CSS transform
// (SVG-ICON-BENCH.md §4). No model calls; changes flow straight to the preview.

import type { ColorSpec, SvgStyle } from "@/lib/svg/types";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function Swatch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-9 cursor-pointer rounded border border-zinc-700 bg-transparent"
    />
  );
}

// Read the two ends of the current color so the gradient/solid toggle keeps
// continuity instead of resetting to defaults.
function colorEnds(c: ColorSpec): [string, string] {
  if (c.type === "solid") return [c.value, "#a78bfa"];
  const sorted = [...c.stops].sort((a, b) => a.offset - b.offset);
  return [sorted[0]?.color ?? "#67e8f9", sorted[1]?.color ?? "#a78bfa"];
}

export default function RestyleControls({
  style,
  onChange,
}: {
  style: SvgStyle;
  onChange: (next: SvgStyle) => void;
}) {
  const patch = (p: Partial<SvgStyle>) => onChange({ ...style, ...p });
  const [c0, c1] = colorEnds(style.color);

  const colorKind =
    style.color.type === "solid" ? "solid" : style.color.kind;

  const setColorKind = (kind: "solid" | "linear" | "radial") => {
    if (kind === "solid") {
      patch({ color: { type: "solid", value: c0 } });
    } else {
      const angle =
        style.color.type === "gradient" ? style.color.angle : 45;
      patch({
        color: {
          type: "gradient",
          kind,
          angle,
          stops: [
            { offset: 0, color: c0 },
            { offset: 1, color: c1 },
          ],
        },
      });
    }
  };

  const setStop = (idx: 0 | 1, color: string) => {
    if (style.color.type === "solid") {
      patch({ color: { type: "solid", value: color } });
      return;
    }
    const stops = [...style.color.stops];
    stops[idx] = { offset: idx, color };
    patch({ color: { ...style.color, stops } });
  };

  const isGradient = style.color.type === "gradient";

  return (
    <div className="divide-y divide-zinc-800/70">
      {/* Color */}
      <Row label="Color">
        <select
          value={colorKind}
          onChange={(e) =>
            setColorKind(e.target.value as "solid" | "linear" | "radial")
          }
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
        >
          <option value="solid">Solid</option>
          <option value="linear">Linear</option>
          <option value="radial">Radial</option>
        </select>
        <Swatch value={c0} onChange={(v) => setStop(0, v)} />
        {isGradient && <Swatch value={c1} onChange={(v) => setStop(1, v)} />}
      </Row>

      {/* Gradient angle (linear only) */}
      {style.color.type === "gradient" && style.color.kind === "linear" && (
        <Row label={`Angle · ${style.color.angle}°`}>
          <input
            type="range"
            min={0}
            max={360}
            value={style.color.angle}
            onChange={(e) => {
              if (style.color.type !== "gradient") return;
              patch({
                color: { ...style.color, angle: Number(e.target.value) },
              });
            }}
            className="w-40 accent-cyan-500"
          />
        </Row>
      )}

      {/* Stroke width */}
      <Row label={`Stroke · ${style.strokeWidth.toFixed(1)}`}>
        <input
          type="range"
          min={0.5}
          max={4}
          step={0.25}
          value={style.strokeWidth}
          onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
          className="w-40 accent-cyan-500"
        />
      </Row>

      {/* Glow */}
      <Row label={`Glow · ${style.glow.blur.toFixed(1)}`}>
        <input
          type="range"
          min={0}
          max={4}
          step={0.25}
          value={style.glow.blur}
          onChange={(e) =>
            patch({ glow: { ...style.glow, blur: Number(e.target.value) } })
          }
          className="w-32 accent-cyan-500"
        />
        <Swatch
          value={style.glow.color}
          onChange={(v) => patch({ glow: { ...style.glow, color: v } })}
        />
      </Row>

      {/* Badge */}
      <Row label="Badge">
        <select
          value={style.badge.shape}
          onChange={(e) =>
            patch({
              badge: {
                ...style.badge,
                shape: e.target.value as SvgStyle["badge"]["shape"],
              },
            })
          }
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
        >
          <option value="none">None</option>
          <option value="circle">Circle</option>
          <option value="rounded">Rounded</option>
          <option value="hex">Hex</option>
        </select>
        {style.badge.shape !== "none" && (
          <Swatch
            value={style.badge.bg}
            onChange={(v) => patch({ badge: { ...style.badge, bg: v } })}
          />
        )}
      </Row>

      {/* Background */}
      <Row label="Background">
        <select
          value={style.background === "transparent" ? "transparent" : "solid"}
          onChange={(e) =>
            patch({
              background:
                e.target.value === "transparent" ? "transparent" : "#0b1220",
            })
          }
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
        >
          <option value="transparent">Transparent</option>
          <option value="solid">Solid</option>
        </select>
        {style.background !== "transparent" && (
          <Swatch
            value={style.background}
            onChange={(v) => patch({ background: v })}
          />
        )}
      </Row>
    </div>
  );
}
