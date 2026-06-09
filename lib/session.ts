/**
 * Session helpers for the authenticated app surface.
 *
 * `getCurrentUser()` returns the signed-in user, or null when there is no
 * session. There is NO demo / mock user — every app feature requires login.
 */

import { auth } from "@/lib/auth";

export interface CurrentUser {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
  creditsBalance: number;
  isAdmin: boolean;
}

/** Returns the current signed-in user, or null when there is no session. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
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

/**
 * Returns the current user or null. Callers gate on null (redirect to /login in
 * pages, 401 in API routes). Kept as a thin alias so intent reads clearly.
 */
export async function requireUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}
