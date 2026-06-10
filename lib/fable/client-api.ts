// Fable Bench — client-side typed fetch wrappers for the six agent/step routes.
//
// Mirrors lib/icon/client-api.ts: POST JSON, parse the server's { error } payload
// into a thrown Error carrying the server's message, otherwise return the typed
// response. No usage logging side effects here — the orchestrating hook owns the
// usage ledger (every response carries its own `usage` array per types.ts).

import type {
  AgentRequest,
  AgentResponse,
  AnalyzeStyleRequest,
  AnalyzeStyleResponse,
  FableUsageRecord,
  FinalIconRequest,
  FinalIconResponse,
  ImproveSourceRequest,
  ImproveSourceResponse,
  PreviewSheetRequest,
  PreviewSheetResponse,
  RevisePromptsRequest,
  RevisePromptsResponse,
} from "./types";

/** Thrown when a route responds non-OK. Carries any usage the server accumulated
 *  before failing (FableApiError.usage) plus the serialized raw provider error,
 *  so the hook can still ledger the spend and surface the payload in dev. */
export class FableRequestError extends Error {
  usage?: FableUsageRecord[];
  raw?: unknown;
  constructor(message: string, usage?: FableUsageRecord[], raw?: unknown) {
    super(message);
    this.name = "FableRequestError";
    this.usage = usage;
    this.raw = raw;
  }
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new FableRequestError(
      (typeof data.error === "string" && data.error) || "Request failed.",
      Array.isArray(data.usage) ? (data.usage as FableUsageRecord[]) : undefined,
      data.raw,
    );
  }
  return data as T;
}

export function postAgent(body: AgentRequest): Promise<AgentResponse> {
  return postJSON<AgentResponse>("/api/fable/agent", body);
}

export function postImproveSource(
  body: ImproveSourceRequest,
): Promise<ImproveSourceResponse> {
  return postJSON<ImproveSourceResponse>("/api/fable/improve-source", body);
}

export function postAnalyze(
  body: AnalyzeStyleRequest,
): Promise<AnalyzeStyleResponse> {
  return postJSON<AnalyzeStyleResponse>("/api/fable/analyze", body);
}

export function postRevisePrompts(
  body: RevisePromptsRequest,
): Promise<RevisePromptsResponse> {
  return postJSON<RevisePromptsResponse>("/api/fable/revise-prompts", body);
}

export function postPreviewSheet(
  body: PreviewSheetRequest,
): Promise<PreviewSheetResponse> {
  return postJSON<PreviewSheetResponse>("/api/fable/preview-sheet", body);
}

export function postFinalIcon(
  body: FinalIconRequest,
): Promise<FinalIconResponse> {
  return postJSON<FinalIconResponse>("/api/fable/final-icon", body);
}
