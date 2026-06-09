/**
 * POST /api/billing/portal
 * Returns: { url } to the Stripe Billing Portal, OR a guarded error.
 *
 * Asset Arsenal sells credits via one-time payments, so most users have no
 * Stripe Customer / subscription to manage. We only open a portal when a
 * customerId is supplied; otherwise we return a clear 400. Kept intentionally
 * simple and guarded.
 */

import { features } from "@/lib/env";
import { getStripe } from "@/lib/stripe";
import { SITE } from "@/lib/site";

export async function POST(req: Request) {
  if (!features.stripe) {
    return Response.json({ error: "Billing not configured" }, { status: 503 });
  }

  let body: { customerId?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const customerId = body.customerId;
  if (!customerId) {
    // One-time purchases have no portal-managed customer by default.
    return Response.json(
      { error: "No billing portal for one-time purchases" },
      { status: 400 },
    );
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE.url}/app/credits`,
  });

  return Response.json({ url: session.url });
}
