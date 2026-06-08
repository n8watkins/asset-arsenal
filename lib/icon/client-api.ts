// Client-side typed fetch wrappers for the six pipeline API routes.
// Each throws Error(<friendly message>) on non-2xx so callers can route the
// message into the pipeline's error state.

import type {
  AnalyzeResponse,
  ComposeCollectionPromptResponse,
  GenerateCollectionImageResponse,
  ComposeIndividualPromptsResponse,
  GenerateOneResponse,
  GenerateBatchResponse,
  IconManifest,
  IndividualIconPrompt,
  IndividualIconPrompts,
} from "@/types/icon-pipeline";
import type { ImageQuality } from "@/lib/icon/model-reference";

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

// Step 1
export function analyzeImage(
  imageBase64: string,
  fileName?: string,
  model?: string,
) {
  return postJSON<AnalyzeResponse>("/api/icons/analyze", {
    imageBase64,
    fileName,
    model,
  });
}

// Step 2
export function composeCollectionPrompt(manifest: IconManifest, model?: string) {
  return postJSON<ComposeCollectionPromptResponse>(
    "/api/icons/compose-collection-prompt",
    { manifest, model },
  );
}

// Step 3
export function generateCollectionImage(args: {
  sourceImageBase64: string;
  manifest: IconManifest;
  collectionPrompt: string;
  model?: string;
  quality?: ImageQuality;
}) {
  return postJSON<GenerateCollectionImageResponse>(
    "/api/icons/generate-collection-image",
    args,
  );
}

// Step 4
export function composeIndividualPrompts(args: {
  collectionImageBase64: string;
  manifest: IconManifest;
  model?: string;
}) {
  return postJSON<ComposeIndividualPromptsResponse>(
    "/api/icons/compose-individual-prompts",
    args,
  );
}

// Step 5 (single)
export function generateOneIcon(args: {
  collectionImageBase64: string;
  sharedStylePrompt: string;
  iconPrompt: IndividualIconPrompt;
  model?: string;
  quality?: ImageQuality;
}) {
  return postJSON<GenerateOneResponse>("/api/icons/generate-one", args);
}

// Step 5 (batch)
export function generateIconsBatch(args: {
  collectionImageBase64: string;
  individualPrompts: IndividualIconPrompts;
  model?: string;
  quality?: ImageQuality;
}) {
  return postJSON<GenerateBatchResponse>("/api/icons/generate-batch", args);
}
