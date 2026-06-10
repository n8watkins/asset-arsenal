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
  FinalIconRequest,
  FinalIconResponse,
  ImproveSourceRequest,
  ImproveSourceResponse,
  PreviewSheetRequest,
  PreviewSheetResponse,
  RevisePromptsRequest,
  RevisePromptsResponse,
} from "./types";

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
    throw new Error(
      (typeof data.error === "string" && data.error) || "Request failed.",
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
