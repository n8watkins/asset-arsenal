/**
 * Centralized env access. Read lazily — never throw at module load so the app
 * still builds without secrets configured. Call requireEnv() inside handlers.
 */

export function getEnv(key: string): string | undefined {
  return process.env[key];
}

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing required env var: ${key}`);
  return v;
}

/** True when a feature's secrets are present, so UI can degrade gracefully. */
export const features = {
  get auth() {
    return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  },
  get db() {
    return Boolean(process.env.TURSO_DATABASE_URL);
  },
  get stripe() {
    return Boolean(process.env.STRIPE_SECRET_KEY);
  },
  get storage() {
    return Boolean(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID);
  },
  get analytics() {
    return Boolean(process.env.NEXT_PUBLIC_GA_ID);
  },
};
