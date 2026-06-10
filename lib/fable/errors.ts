import type { FableStepKey } from "./types";

// Thrown by the Fable server pipeline; caught by route handlers and mapped to
// a friendly { error, usage? } response. Mirrors lib/icon/errors.ts but
// carries a FableStepKey instead of PipelineErrorStep, and optionally carries
// usage records accumulated before the failure (so the route can still append
// them to the ledger).
export class FableError extends Error {
  constructor(
    public step: FableStepKey,
    message: string,
    public usage: import("./types").FableUsageRecord[] = [],
    public rawError?: unknown,
  ) {
    super(message);
    this.name = "FableError";
  }
}

/** JSON-safe rendering of a raw provider error for the { raw } error payload
 *  (surfaced in the Dev drawer). Errors aren't JSON-serializable as-is. */
export function serializeRawError(raw: unknown): unknown {
  if (raw == null) return undefined;
  if (raw instanceof Error) {
    const extra = raw as Error & { status?: unknown; code?: unknown; error?: unknown };
    return {
      name: raw.name,
      message: raw.message,
      ...(extra.status !== undefined ? { status: extra.status } : {}),
      ...(extra.code !== undefined ? { code: extra.code } : {}),
      ...(extra.error !== undefined ? { error: serializeRawError(extra.error) } : {}),
    };
  }
  try {
    JSON.stringify(raw);
    return raw;
  } catch {
    return String(raw);
  }
}
