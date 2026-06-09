/**
 * Credit ledger — the ONE place credits change.
 *
 * Every mutation updates users.creditsBalance AND appends a creditTransactions
 * row, inside a transaction. 1 credit = 1 generated icon (see lib/pricing.ts).
 *
 * Used by:
 *  - the Stripe webhook (grantCredits, type "purchase")
 *  - signup (grantCredits, type "free_grant")
 *  - the generation pipeline (spendCredits / refundCredits)
 */

import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, creditTransactions } from "@/lib/db/schema";

export type CreditTxType =
  | "purchase"
  | "free_grant"
  | "spend"
  | "refund"
  | "admin_adjustment";

export class InsufficientCreditsError extends Error {
  constructor(
    public needed: number,
    public available: number,
  ) {
    super(`Insufficient credits: need ${needed}, have ${available}`);
    this.name = "InsufficientCreditsError";
  }
}

export async function getBalance(userId: string): Promise<number> {
  const db = getDb();
  const row = await db
    .select({ balance: users.creditsBalance })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return row?.balance ?? 0;
}

interface GrantOpts {
  type?: Extract<CreditTxType, "purchase" | "free_grant" | "admin_adjustment">;
  description?: string;
  /** Stripe event id — makes purchase grants idempotent (unique column). */
  stripeEventId?: string;
  /** Request IP — recorded on free_grant rows for per-IP farming caps. */
  ip?: string;
}

/**
 * Add credits. If stripeEventId is supplied and already recorded, this is a
 * no-op (returns the current balance) so webhook retries never double-grant.
 */
export async function grantCredits(
  userId: string,
  amount: number,
  opts: GrantOpts = {},
): Promise<number> {
  if (amount <= 0) throw new Error("grantCredits amount must be positive");
  const db = getDb();

  if (opts.stripeEventId) {
    const existing = await db
      .select({ id: creditTransactions.id })
      .from(creditTransactions)
      .where(eq(creditTransactions.stripeEventId, opts.stripeEventId))
      .get();
    if (existing) return getBalance(userId);
  }

  return db.transaction(async (tx) => {
    const updated = await tx
      .update(users)
      .set({ creditsBalance: sql`${users.creditsBalance} + ${amount}` })
      .where(eq(users.id, userId))
      .returning({ balance: users.creditsBalance })
      .get();
    const balanceAfter = updated?.balance ?? amount;
    await tx.insert(creditTransactions).values({
      userId,
      type: opts.type ?? "purchase",
      amount,
      balanceAfter,
      description: opts.description,
      stripeEventId: opts.stripeEventId,
      ip: opts.ip,
    });
    return balanceAfter;
  });
}

/** True if this user has ever received a free_grant (signup bonus). */
export async function hasReceivedFreeGrant(userId: string): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select({ id: creditTransactions.id })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, "free_grant"),
      ),
    )
    .get();
  return Boolean(row);
}

/** Count free_grant rows from a given IP within the last `windowSeconds`. */
export async function countFreeGrantsByIp(
  ip: string,
  windowSeconds: number,
): Promise<number> {
  const cutoff = Math.floor(Date.now() / 1000) - windowSeconds;
  const row = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.ip, ip),
        eq(creditTransactions.type, "free_grant"),
        gte(creditTransactions.createdAt, cutoff),
      ),
    )
    .get();
  return row?.count ?? 0;
}

/**
 * Deduct credits. Throws InsufficientCreditsError if the balance can't cover it
 * (checked inside the transaction to avoid races). runId links the spend to a run.
 */
export async function spendCredits(
  userId: string,
  amount: number,
  opts: { runId?: string; description?: string } = {},
): Promise<number> {
  if (amount <= 0) throw new Error("spendCredits amount must be positive");
  const db = getDb();
  return db.transaction(async (tx) => {
    const row = await tx
      .select({ balance: users.creditsBalance })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    const balance = row?.balance ?? 0;
    if (balance < amount) throw new InsufficientCreditsError(amount, balance);
    const balanceAfter = balance - amount;
    await tx
      .update(users)
      .set({ creditsBalance: balanceAfter })
      .where(eq(users.id, userId));
    await tx.insert(creditTransactions).values({
      userId,
      runId: opts.runId,
      type: "spend",
      amount: -amount,
      balanceAfter,
      description: opts.description,
    });
    return balanceAfter;
  });
}

/** Refund credits (system/API failure only). */
export async function refundCredits(
  userId: string,
  amount: number,
  opts: { runId?: string; description?: string } = {},
): Promise<number> {
  return grantCredits(userId, amount, {
    type: "admin_adjustment",
    description: opts.description ?? "refund",
  });
}
