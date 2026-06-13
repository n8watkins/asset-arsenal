// SVG lane — domain types. The deterministic fetch-and-restyle lane.
// See docs/SVG-ICON-BENCH.md for the full design.

/** A reference to one icon in a bundled (or, later, API-fetched) set. */
export interface SvgIconRef {
  /** `prefix:name`, e.g. "lucide:crosshair" — the cache key. */
  id: string;
  prefix: string;
  name: string;
}

/**
 * Raw vector data for one icon, resolved from a bundled set (or the Iconify API
 * for the long tail). This is what we cache and restyle — never a rendered SVG.
 */
export interface SvgIconRecord extends SvgIconRef {
  /** Inner SVG markup (paths/groups), `currentColor`-based for monochrome sets. */
  body: string;
  width: number;
  height: number;
  /** monochrome = fully restyleable; multicolor = recolor is partial (flagged). */
  colorMode: "monochrome" | "multicolor";
  /** Whether the icon paints with stroke, fill, or both — picks the paint target. */
  drawMode: "stroke" | "fill" | "mixed";
  license: { title: string; url: string };
}

/** A gradient stop: 0..1 offset + color. */
export interface GradientStop {
  offset: number;
  color: string;
}

/** Color is a union — flat OR gradient. The whole point of §4. */
export type ColorSpec =
  | { type: "solid"; value: string }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      /** Degrees, linear only. 0 = left→right, 90 = top→bottom. */
      angle: number;
      stops: GradientStop[];
    };

export interface GlowSpec {
  color: string;
  /** Blur radius in viewBox units. 0 = off. */
  blur: number;
}

export type BadgeShape = "none" | "circle" | "rounded" | "hex";

export interface BadgeSpec {
  shape: BadgeShape;
  /** Background fill of the badge (ignored when shape === "none"). */
  bg: string;
  /** Inner padding as a fraction of the icon box, 0..0.4. */
  padding: number;
}

/** The full restyle recipe applied uniformly across a pack. */
export interface SvgStyle {
  color: ColorSpec;
  strokeWidth: number;
  glow: GlowSpec;
  badge: BadgeSpec;
  /** "transparent" or a CSS color for the canvas behind the icon. */
  background: string;
}

export const DEFAULT_STYLE: SvgStyle = {
  color: { type: "solid", value: "#67e8f9" },
  strokeWidth: 2,
  glow: { color: "#67e8f9", blur: 0 },
  badge: { shape: "none", bg: "#0b1220", padding: 0.18 },
  background: "transparent",
};
