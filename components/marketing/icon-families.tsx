/**
 * Definitions for the 5 distinct icon families used across the marketing site.
 * Each family is a full "brand": a palette, a style descriptor that drives how
 * the icon renderer draws glyphs, plus copy + the matching mockup style.
 *
 * Pure data — no JSX here. Consumed by icons.tsx (rendering), mockups.tsx
 * (the BEFORE design image) and BeforeAfter.tsx (the composed unit).
 */

export type FamilyId = "saas" | "arcade" | "nova" | "ember" | "vault";

/** How the icon renderer should treat fills/strokes for a family. */
export type FillTreatment = "line" | "duotone" | "filled";
export type CornerStyle = "round" | "soft" | "sharp";

export interface FamilyPalette {
  /** Primary accent — main stroke / key shapes. */
  accent: string;
  /** Secondary accent — duotone fills, gradients, highlights. */
  accent2: string;
  /** Panel/canvas background for the mockup + tiles. */
  bg: string;
  /** Raised surface (cards, tiles) color. */
  surface: string;
  /** Hairline / border color. */
  stroke: string;
  /** Low-emphasis text / placeholder bars. */
  muted: string;
  /** High-emphasis text on the family bg. */
  text: string;
}

export interface FamilyStyle {
  /** Icon stroke width in the 24x24 viewBox. */
  strokeWidth: number;
  /** Fill vs line vs duotone treatment. */
  fill: FillTreatment;
  /** Corner / join treatment. */
  cornerStyle: CornerStyle;
  /** Whether glyphs get a neon glow halo. */
  glow: boolean;
  /** Tile corner radius (Tailwind class) for the icon-pack grid. */
  tileRadius: string;
}

export interface IconFamily {
  id: FamilyId;
  /** Short brand label, e.g. "Nova". */
  label: string;
  /** What the mockup represents, e.g. "SaaS dashboard". */
  mockupTitle: string;
  /** Right-column blurb describing the extracted pack. */
  tagline: string;
  /** Fake app/URL shown in the browser chrome. */
  appUrl: string;
  palette: FamilyPalette;
  style: FamilyStyle;
}

export const FAMILIES: Record<FamilyId, IconFamily> = {
  saas: {
    id: "saas",
    label: "Helio",
    mockupTitle: "SaaS dashboard",
    tagline:
      "A clean analytics product with thin 1.5px line icons, rounded joins and a cool indigo accent — extracted as a tidy, even nav + metrics set.",
    appUrl: "app.helio.io",
    palette: {
      accent: "#6d5efc",
      accent2: "#38bdf8",
      bg: "#0b0d16",
      surface: "#141826",
      stroke: "#252a3d",
      muted: "#6b7390",
      text: "#eef1fb",
    },
    style: {
      strokeWidth: 1.5,
      fill: "line",
      cornerStyle: "round",
      glow: false,
      tileRadius: "rounded-xl",
    },
  },
  arcade: {
    id: "arcade",
    label: "Pixeltron",
    mockupTitle: "Stream overlay",
    tagline:
      "A neon gaming overlay rendered as bold, glowing duotone badges — angular cyan + lime icons that pop on dark, ready for alerts and HUDs.",
    appUrl: "overlay.pixeltron.gg",
    palette: {
      accent: "#22d3ee",
      accent2: "#a3e635",
      bg: "#05060a",
      surface: "#0c1018",
      stroke: "#1b2230",
      muted: "#5a6678",
      text: "#e8fbff",
    },
    style: {
      strokeWidth: 2.25,
      fill: "duotone",
      cornerStyle: "sharp",
      glow: true,
      tileRadius: "rounded-lg",
    },
  },
  nova: {
    id: "nova",
    label: "Nova",
    mockupTitle: "AI assistant",
    tagline:
      "A violet→magenta AI chat product turned into soft duotone icons — filled secondaries under rounded line primaries, generous radius, a gentle glow.",
    appUrl: "nova.ai/chat",
    palette: {
      accent: "#8b5cf6",
      accent2: "#ec4899",
      bg: "#0e0a18",
      surface: "#1a1428",
      stroke: "#2c2342",
      muted: "#897da6",
      text: "#f6eefe",
    },
    style: {
      strokeWidth: 1.75,
      fill: "duotone",
      cornerStyle: "round",
      glow: true,
      tileRadius: "rounded-2xl",
    },
  },
  ember: {
    id: "ember",
    label: "Ember",
    mockupTitle: "Creator studio",
    tagline:
      "A warm creator dashboard in amber + coral on warm-dark — friendly, medium-weight rounded icons with cream highlights and a playful feel.",
    appUrl: "studio.ember.tv",
    palette: {
      accent: "#fbbf24",
      accent2: "#fb7185",
      bg: "#16100c",
      surface: "#241a13",
      stroke: "#3a2a1d",
      muted: "#a08a72",
      text: "#fdf2e4",
    },
    style: {
      strokeWidth: 2,
      fill: "duotone",
      cornerStyle: "round",
      glow: false,
      tileRadius: "rounded-2xl",
    },
  },
  vault: {
    id: "vault",
    label: "Vault",
    mockupTitle: "Finance dashboard",
    tagline:
      "A premium fintech dashboard distilled to crisp 2px geometric icons in emerald + teal — minimal, sharp-cornered and clean, no glow.",
    appUrl: "app.vault.finance",
    palette: {
      accent: "#10b981",
      accent2: "#2dd4bf",
      bg: "#04090a",
      surface: "#0a1413",
      stroke: "#16302b",
      muted: "#5a7a73",
      text: "#e6fbf4",
    },
    style: {
      strokeWidth: 2,
      fill: "line",
      cornerStyle: "sharp",
      glow: false,
      tileRadius: "rounded-md",
    },
  },
};

export const FAMILY_ORDER: FamilyId[] = [
  "saas",
  "arcade",
  "nova",
  "ember",
  "vault",
];

export const DEFAULT_FAMILY: FamilyId = "saas";

/** The 12 canonical icon concepts each family renders. */
export type GlyphName =
  | "home"
  | "chart"
  | "bell"
  | "user"
  | "settings"
  | "search"
  | "calendar"
  | "lock"
  | "heart"
  | "star"
  | "folder"
  | "bolt";

export const GLYPH_ORDER: GlyphName[] = [
  "home",
  "chart",
  "bell",
  "user",
  "settings",
  "search",
  "calendar",
  "lock",
  "heart",
  "star",
  "folder",
  "bolt",
];

export function getFamily(id: FamilyId = DEFAULT_FAMILY): IconFamily {
  return FAMILIES[id];
}
