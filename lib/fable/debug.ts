// Fable Bench — W4 debug payload scrubbing for the Dev drawer's raw I/O view.
//
// Routes accept `debug?: boolean`; when true they attach a `debugRaw` field to
// SUCCESS responses: { request, response } where both sides have been deep-
// scrubbed so image payloads never ride along — any data URL or long base64
// string is truncated to its first 64 chars. Prompts, models, sizes, usage
// metadata, etc. survive intact.

const TRUNCATE_TO = 64;
const LONG_STRING_THRESHOLD = 512;
const MAX_DEPTH = 8;

/** Heuristic: a long string of pure base64 alphabet is an image payload. */
function looksLikeBase64(s: string): boolean {
  return s.length > LONG_STRING_THRESHOLD && /^[A-Za-z0-9+/=\s]+$/.test(s.slice(0, 256));
}

function scrubString(s: string): string {
  if (s.startsWith("data:") || looksLikeBase64(s)) {
    return `${s.slice(0, TRUNCATE_TO)}… [truncated ${s.length} chars]`;
  }
  return s;
}

/** Deep-copy `value` with every image-ish string truncated to 64 chars. */
export function scrubForDebug(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return "[max depth]";
  if (Array.isArray(value)) return value.map((v) => scrubForDebug(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = scrubForDebug(v, depth + 1);
  }
  return out;
}

/** Build the success-path debugRaw for a route: scrubbed request + response. */
export function buildDebugRaw(
  request: unknown,
  response: unknown,
): { request: unknown; response: unknown } {
  return { request: scrubForDebug(request), response: scrubForDebug(response) };
}
