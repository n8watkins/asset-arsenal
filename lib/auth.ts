/**
 * NextAuth v5 (beta) configuration.
 *
 * Exports the canonical `{ handlers, auth, signIn, signOut }` contract — other
 * agents import `auth` from `@/lib/auth`.
 *
 * Robustness: importing this module must NOT throw when env/db are absent.
 *  - The Drizzle adapter is given the db instance lazily (only built when auth
 *    is actually configured), so we never call getDb() at module top-level in a
 *    way that throws on a missing TURSO_DATABASE_URL.
 *  - When `features.auth` is false (no Google creds) we fall back to an empty
 *    providers array and no adapter, so the app surface stays viewable in demo
 *    mode without crashing.
 */

import NextAuth, {
  type NextAuthConfig,
  type DefaultSession,
} from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { features } from "@/lib/env";
import { getDb } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import { grantCredits } from "@/lib/credits";
import { SIGNUP_FREE_CREDITS } from "@/lib/pricing";

/* Augment the session user with our product fields. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      creditsBalance: number;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

/**
 * Build the adapter only when both auth + db are configured. We pass the live
 * db instance, but constructing it is gated behind `features.db` so a missing
 * TURSO_DATABASE_URL can never throw at import time.
 */
function buildAdapter() {
  if (!features.db) return undefined;
  return DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
}

const authConfig: NextAuthConfig = {
  // Empty array when not configured → NextAuth import stays safe in demo mode.
  providers: features.auth
    ? [
        Google({
          clientId: process.env.AUTH_GOOGLE_ID,
          clientSecret: process.env.AUTH_GOOGLE_SECRET,
        }),
      ]
    : [],
  adapter: buildAdapter(),
  // Real secret in any configured env; a throwaway dev fallback keeps auth()
  // from throwing MissingSecret in demo mode (production MUST set AUTH_SECRET).
  secret: process.env.AUTH_SECRET ?? "dev-insecure-secret-asset-arsenal",
  trustHost: true,
  session: { strategy: "database" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /**
     * Database-session callback. Attach product fields (id, creditsBalance,
     * isAdmin) onto the session user. With the database strategy we receive the
     * adapter `user`; we re-query for the freshest credit balance when possible.
     */
    async session({ session, user }) {
      if (!session.user) return session;
      if (user?.id) {
        session.user.id = user.id;
      }

      // Prefer fresh values from the db; fall back to whatever is on `user`.
      let creditsBalance =
        (user as { creditsBalance?: number } | undefined)?.creditsBalance ?? 0;
      let isAdmin =
        (user as { isAdmin?: boolean } | undefined)?.isAdmin ?? false;

      if (features.db && user?.id) {
        try {
          const row = await getDb()
            .select({
              creditsBalance: users.creditsBalance,
              isAdmin: users.isAdmin,
            })
            .from(users)
            .where(eq(users.id, user.id))
            .get();
          if (row) {
            creditsBalance = row.creditsBalance ?? creditsBalance;
            isAdmin = row.isAdmin ?? isAdmin;
          }
        } catch {
          // Non-fatal: keep adapter-provided values.
        }
      }

      session.user.creditsBalance = creditsBalance;
      session.user.isAdmin = isAdmin;
      return session;
    },
  },
  events: {
    /** Grant the signup bonus exactly once, when the user row is created. */
    async createUser({ user }) {
      if (!features.db || !user?.id) return;
      try {
        await grantCredits(user.id, SIGNUP_FREE_CREDITS, {
          type: "free_grant",
          description: "signup bonus",
        });
      } catch {
        // Don't block account creation if the grant fails.
      }
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
