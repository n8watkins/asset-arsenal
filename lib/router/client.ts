import type { TokenUsage } from "@/types/icon-pipeline";
import type { RouterDecision, RouterInput } from "./types";

// Client-side fetch wrapper for the router. Intentionally NOT wired into the
// pipeline usage-log (the router isn't a pipeline step) — it's its own concern.

export type RouteResponse = { decision: RouterDecision; usage?: TokenUsage };

export async function classifyRoute(
  input: RouterInput & { model?: string },
): Promise<RouteResponse> {
  let res: Response;
  try {
    res = await fetch("/api/router", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
  } catch {
    throw new Error("Network error. Check your connection and try again.");
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error((typeof data.error === "string" && data.error) || "Request failed.");
  }
  return data as RouteResponse;
}
