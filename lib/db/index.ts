/**
 * Turso (libSQL) client + Drizzle instance.
 *
 * Lazily constructed so the app builds without DB credentials. Import `db` and
 * use it inside request handlers; if env is missing it throws there, not at
 * build time. Check `features.db` before relying on it.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");
  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  _db = drizzle(client, { schema });
  return _db;
}

export { schema };
