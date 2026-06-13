/**
 * POST /api/stripe/webhook
 * Stripe webhook receiver. Returns: { received: true }.
 *
 * Critical details:
 *  - Signature verification needs the RAW request body, so we use req.text()
 *    (NOT req.json()) and the stripe-signature header.
 *  - grantCredits is called with stripeEventId for idempotency — Stripe retries
 *    webhooks, and the unique event id guarantees we never double-grant.
 *  - Runs on the Node.js runtime (Stripe's SDK + crypto need it).
 */

import type Stripe from "stripe";
import { headers } from "next/headers";
import { grantCredits } from "@/lib/credits";
import { features, requireEnv } from "@/lib/env";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!features.stripe) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Raw body is required for signature verification — do not parse as JSON.
  const body = await req.text();
  const sig = (await headers()).get("stripe-signature");

  let event: Stripe.Event;
  try {
    if (!sig) throw new Error("Missing stripe-signature header");
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      requireEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return Response.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata ?? {};
      const userId = metadata.userId;
      const credits = Number(metadata.credits);

      if (userId && Number.isFinite(credits) && credits > 0) {
        // stripeEventId makes this idempotent across Stripe's retries.
        await grantCredits(userId, credits, {
          type: "purchase",
          stripeEventId: event.id,
          description: `Purchased ${metadata.packId ?? "pack"}`,
        });
      }
      break;
    }

    case "charge.refunded": {
      // TODO: reverse granted credits on refund (needs a credit clawback path).
      // Logging only for now.
      console.log(`charge.refunded received: ${event.id}`);
      break;
    }

    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      break;
  }

  return Response.json({ received: true });
}
