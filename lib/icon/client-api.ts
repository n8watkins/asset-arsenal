// Client-side typed fetch wrappers for the pipeline API routes (PRD §14).
// Each throws Error(<friendly message>) on non-2xx so callers can route the
// message into the pipeline's error state.

import type {
  IconAnalysisResponse,
  IconPromptsResponse,
  GenerateIconResponse,
  GenerateIconRequest,
  IconManifest,
} from "@/types/icon-pipeline";

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

export function analyzeImage(imageBase64: string, fileName?: string) {
  return postJSON<IconAnalysisResponse>("/api/icon-analysis", {
    imageBase64,
    fileName,
  });
}

export function fetchPrompts(manifest: IconManifest) {
  return postJSON<IconPromptsResponse>("/api/icon-prompts", { manifest });
}

export function generateOneIcon(req: GenerateIconRequest) {
  return postJSON<GenerateIconResponse>("/api/generate-icon", req);
}
