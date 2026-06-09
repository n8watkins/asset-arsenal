/**
 * POST /api/billing/checkout
 * Body: { packId: PackId }
 * Returns: { url } — a Stripe Checkout Session URL to redirect the user to.
 *
 * Guarded by features.stripe so the route returns a clean 503 in dev without
 * secrets rather than crashing.
 */

import { auth } from "@/lib/auth";
import { features } from "@/lib/env";
import { PACKS_BY_ID, type PackId } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import { getStripe, priceArgsForPack } from "@/lib/stripe";

export async function POST(req: Request) {
  if (!features.stripe) {
    return Response.json({ error: "Checkout not configured" }, { status: 503 });
  }

  let body: { packId?: PackId };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const packId = body.packId;
  if (!packId) {
    return Response.json({ error: "packId is required" }, { status: 400 });
  }

  const pack = PACKS_BY_ID[packId];
  if (!pack) {
    return Response.json({ error: "Unknown pack" }, { status: 400 });
  }
  if (pack.priceCents <= 0) {
    return Response.json(
      { error: "The free pack is not purchasable" },
      { status: 400 },
    );
  }

  // Resolve the buyer. Fall back to a demo user when auth is not configured.
  const userId = (await auth())?.user?.id ?? "demo-user";

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ ...priceArgsForPack(pack), quantity: 1 }],
    success_url: `${SITE.url}/app/credits?success=1`,
    cancel_url: `${SITE.url}/app/credits?canceled=1`,
    client_reference_id: userId,
    metadata: {
      userId,
      packId: pack.id,
      credits: String(pack.credits),
    },
  });

  return Response.json({ url: session.url });
}
