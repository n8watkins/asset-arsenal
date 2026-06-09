/**
 * Stripe client + helpers.
 *
 * The client is constructed lazily inside getStripe() — never at module load,
 * so the app builds/runs without STRIPE_SECRET_KEY (the front-end stays
 * clickable in dev). Guard callers with features.stripe.
 */

import Stripe from "stripe";
import { getEnv, requireEnv } from "@/lib/env";
import type { Pack } from "@/lib/pricing";

let _stripe: Stripe | null = null;

/** Lazily build the Stripe client. Throws if STRIPE_SECRET_KEY is missing. */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  // Omit apiVersion so we ride the SDK's pinned default.
  _stripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"));
  return _stripe;
}

/**
 * Build the Checkout line-item price args for a pack.
 *
 * If the pack has a configured Stripe Price (via env), reference it directly.
 * Otherwise fall back to an inline one-time price_data built from the pack — so
 * checkout works even before Prices are created in the Stripe dashboard.
 */
export function priceArgsForPack(
  pack: Pack,
): { price: string } | { price_data: Stripe.Checkout.SessionCreateParams.LineItem.PriceData } {
  const envPriceId = pack.stripePriceEnvKey
    ? getEnv(pack.stripePriceEnvKey)
    : undefined;

  if (envPriceId) {
    return { price: envPriceId };
  }

  return {
    price_data: {
      currency: "usd",
      unit_amount: pack.priceCents,
      product_data: {
        name: pack.name,
      },
    },
  };
}
