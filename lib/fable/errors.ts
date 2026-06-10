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
