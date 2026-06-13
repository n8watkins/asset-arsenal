/**
 * Single source of truth for packs + credit math.
 *
 * Model: 1 credit = 1 generated icon.
 * Analysis, the collection image, and prompt composition are baked into the
 * pack price — they are our cost, not a line item the user sees. This keeps the
 * math legible: "icons cost credits, credits come in packs."
 *
 * See docs/PRICING.md for the full rationale.
 */

export type PackId = "free" | "mini" | "standard" | "builder" | "studio";

export interface Pack {
  id: PackId;
  name: string;
  /** Price in US cents. 0 = free. */
  priceCents: number;
  /** Credits granted = icons the user can generate. */
  credits: number;
  /** Marketing one-liner. */
  tagline: string;
  /** Feature bullets shown on the pricing card. */
  features: string[];
  /** Highlight as the primary/recommended offer. */
  featured?: boolean;
  /** Stripe Price ID — set per-environment via env, looked up at runtime. */
  stripePriceEnvKey?: string;
}

export const PACKS: Pack[] = [
  {
    id: "free",
    name: "Free Preview",
    priceCents: 0,
    credits: 3,
    tagline: "See the magic. No card required.",
    features: [
      "Upload 1 image",
      "Detect the icon system",
      "Generate up to 3 icons",
      "Individual PNG previews",
      "No ZIP export",
    ],
  },
  {
    id: "mini",
    name: "Mini Pack",
    priceCents: 500,
    credits: 10,
    tagline: "Test one small set.",
    features: [
      "10 generated icons",
      "Individual PNG downloads",
      "Prompt pack export",
      "Manifest JSON",
    ],
    stripePriceEnvKey: "STRIPE_PRICE_MINI",
  },
  {
    id: "standard",
    name: "Standard Pack",
    priceCents: 900,
    credits: 25,
    tagline: "The everyday icon pack.",
    features: [
      "25 generated icons",
      "Collection image included",
      "ZIP + individual PNGs",
      "Prompt pack + manifest JSON",
      "Retries on failed generations",
    ],
    featured: true,
    stripePriceEnvKey: "STRIPE_PRICE_STANDARD",
  },
  {
    id: "builder",
    name: "Builder Pack",
    priceCents: 1900,
    credits: 75,
    tagline: "For a real product or brand kit.",
    features: [
      "75 generated icons",
      "Multiple runs",
      "Saved history",
      "Batch downloads",
      "Regenerate selected icons",
    ],
    stripePriceEnvKey: "STRIPE_PRICE_BUILDER",
  },
  {
    id: "studio",
    name: "Studio Pack",
    priceCents: 4900,
    credits: 250,
    tagline: "For agencies and heavy users.",
    features: [
      "250 generated icons",
      "Multiple source images",
      "Saved projects",
      "Batch downloads",
      "Priority queue (coming soon)",
    ],
    stripePriceEnvKey: "STRIPE_PRICE_STUDIO",
  },
];

export const PACKS_BY_ID: Record<PackId, Pack> = Object.fromEntries(
  PACKS.map((p) => [p.id, p]),
) as Record<PackId, Pack>;

/** Credits granted to a new account on signup (the Free Preview). */
export const SIGNUP_FREE_CREDITS = PACKS_BY_ID.free.credits;

/** Cost in credits to generate a single icon. The whole model in one constant. */
export const CREDITS_PER_ICON = 1;

/** Dollars, formatted. e.g. priceLabel(900) => "$9". */
export function priceLabel(priceCents: number): string {
  if (priceCents === 0) return "Free";
  const dollars = priceCents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

/** Effective price per icon, formatted, or null for the free pack. */
export function pricePerIconLabel(pack: Pack): string | null {
  if (pack.priceCents === 0) return null;
  const perIcon = pack.priceCents / 100 / pack.credits;
  return `$${perIcon.toFixed(2)}/icon`;
}

/**
 * Internal cost estimate (NOT shown to users) — for margin sanity only.
 * raw AI cost = fixed pipeline cost + per-icon cost, then a safety multiplier.
 */
export const COST_MODEL = {
  fixedPipelineCostUsd: 0.058,
  perIconCostUsd: 0.011,
  safetyMultiplier: 2.5,
} as const;

export function estimateRunCostUsd(iconCount: number): number {
  const raw =
    COST_MODEL.fixedPipelineCostUsd + COST_MODEL.perIconCostUsd * iconCount;
  return raw * COST_MODEL.safetyMultiplier;
}
