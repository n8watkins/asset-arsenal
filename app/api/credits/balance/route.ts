/**
 * GET /api/credits/balance
 * Returns: { balance }  — or { balance: 5, mock: true } in dev/demo.
 *
 * Reads the current user's credit balance from the ledger. Falls back to a mock
 * balance when there's no DB or no real authenticated user, so the UI shows
 * something sensible without secrets.
 */

import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/credits";
import { features } from "@/lib/env";

export async function GET() {
  const userId = (await auth())?.user?.id ?? "demo-user";

  if (!features.db || userId === "demo-user") {
    return Response.json({ balance: 5, mock: true });
  }

  const balance = await getBalance(userId);
  return Response.json({ balance });
}
