/**
 * Session helpers for the authenticated app surface.
 *
 * `getCurrentUser()` returns the signed-in user. When auth is NOT configured
 * (`features.auth` false) it returns a stable MOCK demo user so the whole app
 * surface is browsable in dev without OAuth. `isDemo` is true in that case.
 */

import { features } from "@/lib/env";

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  creditsBalance: number;
  isAdmin: boolean;
}

/** True when running without auth configured — the app uses a demo user. */
export const isDemo = !features.auth;

const DEMO_USER: CurrentUser = {
  id: "demo-user",
  name: "Demo User",
  email: "demo@assetarsenal.app",
  creditsBalance: 5,
  isAdmin: false,
};

/**
 * Returns the current user, or null when auth is configured but there is no
 * session. In demo mode (no auth configured) always returns the demo user.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (isDemo) return DEMO_USER;

  // Import lazily so demo mode never touches NextAuth internals.
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    creditsBalance: session.user.creditsBalance ?? 0,
    isAdmin: session.user.isAdmin ?? false,
  };
}
