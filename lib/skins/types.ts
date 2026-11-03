export type SkinUsage = {
  step: "spec" | "hero" | "texture" | "emblem";
  model: string;
  durationMs: number;
  costUSD: number;
  detail?: string;
  error?: string;
};

export type SkinAssets = {
  /** Data URLs (webp/png). null when that image failed; the page still renders. */
  hero: string | null;
  texture: string | null;
  emblem: string | null;
};
