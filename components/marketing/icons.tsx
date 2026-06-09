/**
 * Style-aware inline SVG icon set.
 *
 * The same 12 icon CONCEPTS (home, chart, bell, …) are drawn once as geometry,
 * but the renderer paints them in a given family's STYLE — stroke width, line vs
 * duotone vs filled treatment, corner joins, palette and (optional) neon glow.
 *
 * Result: one concept set that visibly looks like a different "brand" per
 * family. No external assets; everything is vector.
 */
import type { CSSProperties, SVGProps } from "react";
import {
  FAMILIES,
  GLYPH_ORDER,
  getFamily,
  type FamilyId,
  type FamilyStyle,
  type GlyphName,
  type IconFamily,
} from "./icon-families";

/* ------------------------------------------------------------------ */
/* Geometry: each glyph as { strokes, fills }.                         */
/* `strokes` are drawn with the family stroke; `fills` (the secondary  */
/* shapes) only render for duotone/filled treatments, in accent2.      */
/* ------------------------------------------------------------------ */

interface GlyphGeometry {
  strokes: React.ReactNode;
  /** Secondary "duotone" shapes, filled with accent2 at low opacity. */
  fills?: React.ReactNode;
}

const GEOMETRY: Record<GlyphName, GlyphGeometry> = {
  home: {
    fills: <path d="M5 10.5 12 5l7 5.5V19a1 1 0 0 1-1 1h-3v-5h-6v5H6a1 1 0 0 1-1-1Z" />,
    strokes: (
      <>
        <path d="M3.5 11.5 12 4.5l8.5 7" />
        <path d="M5 10v9h14v-9" />
        <path d="M9.5 19v-5h5v5" />
      </>
    ),
  },
  chart: {
    fills: (
      <>
        <rect x="6.5" y="12" width="2.6" height="6" rx="0.6" />
        <rect x="11" y="8.5" width="2.6" height="9.5" rx="0.6" />
        <rect x="15.5" y="5" width="2.6" height="13" rx="0.6" />
      </>
    ),
    strokes: (
      <>
        <path d="M4 4v15.5h16" />
        <path d="M7.8 17v-4" />
        <path d="M12.3 17v-7.5" />
        <path d="M16.8 17V7" />
      </>
    ),
  },
  bell: {
    fills: <path d="M12 4a6 6 0 0 1 6 6c0 4 1.6 5.2 1.6 5.2H4.4S6 14 6 10a6 6 0 0 1 6-6Z" />,
    strokes: (
      <>
        <path d="M18 10a6 6 0 1 0-12 0c0 4.5-1.8 5.6-1.8 5.6h15.6S18 14.5 18 10" />
        <path d="M10.2 19a2 2 0 0 0 3.6 0" />
      </>
    ),
  },
  user: {
    fills: (
      <>
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4.5 20.5c0-4 3.4-6 7.5-6s7.5 2 7.5 6Z" />
      </>
    ),
    strokes: (
      <>
        <circle cx="12" cy="8.5" r="3.6" />
        <path d="M5 20.5c0-3.7 3.1-5.8 7-5.8s7 2.1 7 5.8" />
      </>
    ),
  },
  settings: {
    fills: <circle cx="12" cy="12" r="3.4" />,
    strokes: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2.5v3.2M12 18.3v3.2M4.3 4.3l2.3 2.3M17.4 17.4l2.3 2.3M2.5 12h3.2M18.3 12h3.2M4.3 19.7l2.3-2.3M17.4 6.6l2.3-2.3" />
      </>
    ),
  },
  search: {
    fills: <circle cx="11" cy="11" r="5.4" />,
    strokes: (
      <>
        <circle cx="11" cy="11" r="6" />
        <path d="m20 20-3.8-3.8" />
      </>
    ),
  },
  calendar: {
    fills: <rect x="4.5" y="6" width="15" height="14" rx="2.4" />,
    strokes: (
      <>
        <rect x="4" y="5.5" width="16" height="15" rx="2.4" />
        <path d="M4 10h16M8.5 3.2v4M15.5 3.2v4" />
        <path d="M8 14h2M14 14h2M8 17.2h2M14 17.2h2" />
      </>
    ),
  },
  lock: {
    fills: <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" />,
    strokes: (
      <>
        <rect x="5" y="10.5" width="14" height="9.5" rx="2.4" />
        <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        <path d="M12 14.5v2.5" />
      </>
    ),
  },
  heart: {
    fills: <path d="M12 20.5C5.5 16.4 4 12.6 4 9.8 4 7 6 5 8.6 5c1.7 0 2.9.9 3.4 1.9C12.5 5.9 13.7 5 15.4 5 18 5 20 7 20 9.8c0 2.8-1.5 6.6-8 10.7Z" />,
    strokes: <path d="M12 20s-7.5-4.6-7.5-10A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7.5 2C19.5 15.4 12 20 12 20Z" />,
  },
  star: {
    fills: <path d="m12 3.5 2.5 5.4 5.9.7-4.4 4 1.2 5.8L12 16.6 6.8 19.4 8 13.6l-4.4-4 5.9-.7Z" />,
    strokes: <path d="m12 4 2.3 5 5.5.6-4.1 3.8 1.1 5.4L12 16.2 7.2 18.8l1.1-5.4L4.2 9.6l5.5-.6Z" />,
  },
  folder: {
    fills: <path d="M4 7.5A2 2 0 0 1 6 5.5h3.2l2 2.4H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />,
    strokes: <path d="M4 7.5A2 2 0 0 1 6 5.5h3l2 2.5h7a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />,
  },
  bolt: {
    fills: <path d="M13.5 2.5 5 13.2h5.2L9.2 21.5 19 10.4h-5.4Z" />,
    strokes: <path d="M13 3 5 13.2h6l-1 7.8 8-10.4h-6L13 3Z" />,
  },
};

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

const JOIN: Record<FamilyStyle["cornerStyle"], "round" | "miter" | "bevel"> = {
  round: "round",
  soft: "round",
  sharp: "miter",
};

const CAP: Record<FamilyStyle["cornerStyle"], "round" | "butt" | "square"> = {
  round: "round",
  soft: "round",
  sharp: "square",
};

export interface FamilyIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  family: FamilyId;
  name: GlyphName;
  /** Override pixel size; defaults to className-driven sizing. */
  size?: number;
}

/**
 * Render a single glyph in a family's style. Self-contained: pulls palette +
 * style from the family id, applies the right fill treatment and an optional
 * glow filter (scoped by a unique id so multiple icons can coexist).
 */
export function FamilyIcon({
  family: familyId,
  name,
  size,
  style,
  ...rest
}: FamilyIconProps) {
  const family = getFamily(familyId);
  const { palette, style: s } = family;
  const geo = GEOMETRY[name];
  const filterId = `aa-glow-${familyId}-${name}`;

  const dims = size ? { width: size, height: size } : {};
  const mergedStyle: CSSProperties = {
    color: palette.accent,
    ...(s.glow
      ? { filter: `drop-shadow(0 0 5px ${withAlpha(palette.accent, 0.55)})` }
      : {}),
    ...style,
  };

  const showFills = s.fill === "duotone" || s.fill === "filled";
  const fillOpacity = s.fill === "filled" ? 0.9 : 0.22;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={s.strokeWidth}
      strokeLinecap={CAP[s.cornerStyle]}
      strokeLinejoin={JOIN[s.cornerStyle]}
      style={mergedStyle}
      {...dims}
      {...rest}
    >
      {s.glow && (
        <defs>
          <filter id={filterId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="0.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      )}
      <g filter={s.glow ? `url(#${filterId})` : undefined}>
        {showFills && geo.fills && (
          <g fill={palette.accent2} stroke="none" opacity={fillOpacity}>
            {geo.fills}
          </g>
        )}
        <g>{geo.strokes}</g>
      </g>
    </svg>
  );
}

/** Build an rgba() string from a #rrggbb hex + alpha. */
function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h,
    16,
  );
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { withAlpha };

/* ------------------------------------------------------------------ */
/* Tiny convenience glyphs for use INSIDE mockups (single-color, plain */
/* line — they take the family color via currentColor on the parent).  */
/* These are intentionally lightweight vs the full FamilyIcon.         */
/* ------------------------------------------------------------------ */

type MiniProps = SVGProps<SVGSVGElement>;

function miniBase(props: MiniProps) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function MiniGlyph({ name, ...props }: MiniProps & { name: GlyphName }) {
  return <svg {...miniBase(props)}>{GEOMETRY[name].strokes}</svg>;
}

export function SparkleMini(props: MiniProps) {
  return (
    <svg {...miniBase(props)}>
      <path d="M12 4c.6 3.2 1.8 4.4 5 5-3.2.6-4.4 1.8-5 5-.6-3.2-1.8-4.4-5-5 3.2-.6 4.4-1.8 5-5Z" />
      <path d="M18.5 14.5c.3 1.3.7 1.7 1.8 2-1.1.3-1.5.7-1.8 1.9-.3-1.2-.7-1.6-1.8-1.9 1.1-.3 1.5-.7 1.8-2Z" />
    </svg>
  );
}

/** Ordered list of (name, family) used to render a full pack grid. */
export function familyGlyphs(family: FamilyId): {
  name: GlyphName;
  family: FamilyId;
}[] {
  return GLYPH_ORDER.map((name) => ({ name, family }));
}

export type { FamilyId, GlyphName, IconFamily };
export { GLYPH_ORDER, FAMILIES };

/* ------------------------------------------------------------------ */
/* Back-compat: simple single-color line glyphs consumed by Steps.tsx  */
/* (another component). Kept stable so that file keeps compiling.       */
/* ------------------------------------------------------------------ */

export type Glyph = (props: MiniProps) => React.JSX.Element;

export function ImageIcon(props: MiniProps) {
  return (
    <svg {...miniBase(props)}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 4.5-4 3 2.5L16 12l3 4" />
    </svg>
  );
}

export function SparkleIcon(props: MiniProps) {
  return <SparkleMini {...props} />;
}

export function CheckListIcon(props: MiniProps) {
  return (
    <svg {...miniBase(props)}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m4 5.5 1 1 1.5-2M4 11.5l1 1 1.5-2M4 17.5l1 1 1.5-2" />
    </svg>
  );
}

export function GridIcon(props: MiniProps) {
  return (
    <svg {...miniBase(props)}>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function DownloadIcon(props: MiniProps) {
  return (
    <svg {...miniBase(props)}>
      <path d="M12 4v10" />
      <path d="m8 11 4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}
