/**
 * Signup-bonus grant with anti-farming guards.
 *
 * Called once per authenticated app load (idempotent). Replaces the old
 * "grant in events.createUser" approach so we have the request IP available.
 *
 * Guards (production):
 *  - idempotent: only the user's FIRST free_grant is ever applied
 *  - verified email: in production the only sign-in is Google, whose emails are
 *    verified by Google — so an authenticated prod user is a verified user.
 *  - per-IP cap: at most MAX_FREE_GRANTS_PER_IP free grants per IP per window,
 *    so one person can't farm many accounts from the same machine for free
 *    credits. Over the cap → the account is created but gets 0 free credits.
 *
 * Development: the IP cap is skipped (so local Dev Login always works), but the
 * grant is still idempotent.
 */

import { headers } from "next/headers";
import {
  grantCredits,
  hasReceivedFreeGrant,
  countFreeGrantsByIp,
} from "@/lib/credits";
import {
  MAX_FREE_GRANTS_PER_IP,
  FREE_GRANT_IP_WINDOW_SECONDS,
} from "@/lib/limits";
import { SIGNUP_FREE_CREDITS } from "@/lib/pricing";

const isProd = process.env.NODE_ENV === "production";

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
async function getClientIp(): Promise<string | undefined> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]!.trim();
    return h.get("x-real-ip") ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Grant the signup bonus to a user exactly once, applying the per-IP farming
 * cap in production. Safe to call on every authenticated request — it no-ops
 * after the first grant. Never throws.
 */
export async function ensureSignupBonus(userId: string): Promise<void> {
  try {
    if (await hasReceivedFreeGrant(userId)) return;

    const ip = await getClientIp();

    // Production-only anti-farming: cap free grants per IP.
    if (isProd && ip) {
      const recent = await countFreeGrantsByIp(ip, FREE_GRANT_IP_WINDOW_SECONDS);
      if (recent >= MAX_FREE_GRANTS_PER_IP) {
        // Over the cap — create the account without free credits.
        return;
      }
    }

    await grantCredits(userId, SIGNUP_FREE_CREDITS, {
      type: "free_grant",
      description: "signup bonus",
      ip,
    });
  } catch {
    // Non-fatal: never block app load on the bonus grant.
  }
}
