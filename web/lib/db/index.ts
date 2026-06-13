/**
 * Turso (libSQL) client + Drizzle instance.
 *
 * Lazily constructed. In production a real TURSO_DATABASE_URL is required (we
 * throw if it's missing). In development we ALWAYS have a usable DB: if no
 * TURSO_DATABASE_URL is set we default to a local SQLite file ("file:local.db")
 * so login, credits, and runs work locally without any cloud credentials.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

/** Local SQLite fallback used in development when no Turso URL is configured. */
const DEV_LOCAL_DB_URL = "file:local.db";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Resolve the libSQL url, falling back to a local file in development. */
function resolveDbUrl(): string {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) return url;
  if (process.env.NODE_ENV !== "production") return DEV_LOCAL_DB_URL;
  throw new Error("TURSO_DATABASE_URL is not set");
}

export function getDb() {
  if (_db) return _db;
  const client = createClient({
    url: resolveDbUrl(),
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
