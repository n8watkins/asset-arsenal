// Client-side fetch wrapper for the Gemini chat route.

import type { TokenUsage } from "@/types/icon-pipeline";
import type { ChatTurn } from "./chat";

export type ChatResponse = { reply: string; usage?: TokenUsage };

export async function sendChat(args: {
  turns: ChatTurn[];
  model?: string;
}): Promise<ChatResponse> {
  let res: Response;
  try {
    res = await fetch("/api/gemini/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
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
  return data as ChatResponse;
}
