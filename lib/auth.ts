/**
 * NextAuth v5 (beta) configuration.
 *
 * Exports the canonical `{ handlers, auth, signIn, signOut }` contract — other
 * modules import `auth` from `@/lib/auth`.
 *
 * Auth model:
 *  - Session strategy is JWT (required to support the Credentials provider).
 *  - The Drizzle adapter is kept so OAuth (Google) users persist in the DB.
 *  - Google provider is registered when AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET are
 *    present.
 *  - A dev-only "Dev Login" Credentials provider is registered ONLY when
 *    NODE_ENV !== "production". It upserts a user by email (no password) so the
 *    app is fully testable locally without Google OAuth. It is NEVER registered
 *    in production.
 *
 * Robustness: importing this module must NOT throw, even if env/db are absent.
 * DB access inside callbacks is wrapped in try/catch.
 */

import NextAuth, {
  type NextAuthConfig,
  type DefaultSession,
} from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
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

/* Augment the session/jwt with our product fields. */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      creditsBalance: number;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }
}

const isProd = process.env.NODE_ENV === "production";

/**
 * Build the adapter only when a DB is available (always true in dev via the
 * local file; in prod when TURSO_DATABASE_URL is set). Constructing it is gated
 * behind `features.db` so it can never throw at import time.
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

/**
 * Dev-only Credentials provider. Upserts a user by email (no password) and
 * grants the signup bonus to brand-new users. Returns the minimal user shape
 * NextAuth needs to mint a JWT.
 */
function devCredentialsProvider() {
  return Credentials({
    id: "credentials",
    name: "Dev Login",
    credentials: { email: { label: "Email", type: "email" } },
    async authorize(raw) {
      const email =
        typeof raw?.email === "string" ? raw.email.trim().toLowerCase() : "";
      if (!email) return null;
      if (!features.db) return null;

      try {
        const db = getDb();
        const existing = await db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.email, email))
          .get();

        if (existing) {
          return {
            id: existing.id,
            email: existing.email ?? email,
            name: existing.name ?? null,
          };
        }

        // New dev user — insert and grant the signup bonus once.
        const id = crypto.randomUUID();
        const name = email.split("@")[0] || "Dev User";
        await db.insert(users).values({ id, email, name });
        try {
          await grantCredits(id, SIGNUP_FREE_CREDITS, {
            type: "free_grant",
            description: "signup bonus",
          });
        } catch {
          // Don't block dev login if the grant fails.
        }
        return { id, email, name };
      } catch {
        return null;
      }
    },
  });
}

const providers: NextAuthConfig["providers"] = [];
if (features.auth) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}
// Dev-only credentials login — NEVER registered in production.
if (!isProd) {
  providers.push(devCredentialsProvider());
}

const authConfig: NextAuthConfig = {
  providers,
  adapter: buildAdapter(),
  // Real secret in any configured env; a throwaway dev fallback keeps auth()
  // from throwing MissingSecret locally (production MUST set AUTH_SECRET).
  secret: process.env.AUTH_SECRET ?? "dev-insecure-secret-asset-arsenal",
  trustHost: true,
  // JWT strategy is required to support the Credentials provider.
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    /** Persist the user id onto the token. */
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    /**
     * Attach product fields (id, creditsBalance, isAdmin) onto the session
     * user. Read fresh credit balance / admin flag from the DB by id.
     */
    async session({ session, token }) {
      if (!session.user) return session;
      const id = typeof token.id === "string" ? token.id : (token.sub ?? "");
      session.user.id = id;

      let creditsBalance = 0;
      let isAdmin = false;
      if (features.db && id) {
        try {
          const row = await getDb()
            .select({
              creditsBalance: users.creditsBalance,
              isAdmin: users.isAdmin,
            })
            .from(users)
            .where(eq(users.id, id))
            .get();
          if (row) {
            creditsBalance = row.creditsBalance ?? 0;
            isAdmin = row.isAdmin ?? false;
          }
        } catch {
          // Non-fatal: leave defaults.
        }
      }
      session.user.creditsBalance = creditsBalance;
      session.user.isAdmin = isAdmin;
      return session;
    },
  },
  events: {
    /**
     * Grant the signup bonus exactly once when an OAuth (Google) user row is
     * created via the adapter. (Dev credentials grants its own bonus in
     * authorize() since it bypasses the adapter's createUser.)
     */
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
