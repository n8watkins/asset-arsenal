/**
 * GET /api/credits/balance
 * Returns: { balance } for the signed-in user.
 *
 * Requires a logged-in user (401 otherwise). Reads the current balance from the
 * credit ledger.
 */

import { auth } from "@/lib/auth";
import { getBalance } from "@/lib/credits";

export async function GET() {
  const userId = (await auth())?.user?.id;
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const balance = await getBalance(userId);
  return Response.json({ balance });
}
